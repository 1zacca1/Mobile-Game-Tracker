import { sql, type Game } from "@/lib/db";
import { fetchAppleChart, fetchAppleAppDetails } from "./apple";
import { fetchPlayChart, fetchPlayAppDetails } from "./play";
import { fetchMetaAdCount } from "./meta";
import { mapLimit, todayUtc } from "./util";

export type Job = "charts" | "details" | "meta" | "all";

export type JobReport = {
  job: Job;
  date: string;
  wrote: number;
  errors: string[];
  durationMs: number;
};

// Every write happens immediately after its fetch, so a timeout mid-run still
// persists everything collected up to that point. Failures are logged to
// collection_log; no placeholder rows are ever written.

async function activeGames(): Promise<Game[]> {
  const rows = await sql()`select * from games where active order by id`;
  return rows as Game[];
}

async function log(job: string, status: string, detail: string, durationMs: number) {
  await sql()`insert into collection_log (job, status, detail, duration_ms)
    values (${job}, ${status}, ${detail}, ${durationMs})`;
}

// ---- charts: one fetch per (store, country, chart) covers ALL games ----
async function collectCharts(games: Game[], date: string): Promise<{ wrote: number; errors: string[] }> {
  const db = sql();
  const errors: string[] = [];
  let wrote = 0;

  const countries = [...new Set(games.flatMap((g) => g.markets))];

  for (const country of countries) {
    for (const chart of ["grossing", "free"] as const) {
      // iOS — Apple RSS (top-100, all-apps chart)
      try {
        const ranks = await fetchAppleChart(country, chart);
        for (const g of games) {
          if (!g.appstore_id || !g.markets.includes(country)) continue;
          const rank = ranks.get(g.appstore_id);
          if (rank != null) {
            await db`insert into rank_snapshots (game_id, date, store, country, chart, rank, source)
              values (${g.id}, ${date}, 'ios', ${country}, ${chart}, ${rank}, 'apple_rss')
              on conflict (game_id, date, store, country, chart) do update set rank = excluded.rank`;
            wrote++;
          }
        }
      } catch (err) {
        errors.push(`ios ${country} ${chart}: ${err instanceof Error ? err.message : err}`);
      }
      // Android — google-play-scraper (top-200 games chart)
      try {
        const ranks = await fetchPlayChart(country, chart);
        for (const g of games) {
          if (!g.play_id || !g.markets.includes(country)) continue;
          const rank = ranks.get(g.play_id);
          if (rank != null) {
            await db`insert into rank_snapshots (game_id, date, store, country, chart, rank, source)
              values (${g.id}, ${date}, 'android', ${country}, ${chart}, ${rank}, 'gplay_list')
              on conflict (game_id, date, store, country, chart) do update set rank = excluded.rank`;
            wrote++;
          }
        }
      } catch (err) {
        errors.push(`android ${country} ${chart}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  return { wrote, errors };
}

// ---- details: review counts / ratings / install brackets ----
async function collectDetails(games: Game[], date: string): Promise<{ wrote: number; errors: string[] }> {
  const db = sql();
  const errors: string[] = [];
  let wrote = 0;

  // iOS: one batched lookup per country
  const countries = [...new Set(games.flatMap((g) => g.markets))];
  for (const country of countries) {
    const iosGames = games.filter((g) => g.appstore_id && g.markets.includes(country));
    if (iosGames.length === 0) continue;
    try {
      const details = await fetchAppleAppDetails(iosGames.map((g) => g.appstore_id!), country);
      for (const g of iosGames) {
        const d = details.get(g.appstore_id!);
        if (d) {
          await db`insert into app_snapshots (game_id, date, store, country, review_count, rating, source)
            values (${g.id}, ${date}, 'ios', ${country}, ${d.reviewCount}, ${d.rating}, 'itunes_lookup')
            on conflict (game_id, date, store, country) do update
              set review_count = excluded.review_count, rating = excluded.rating`;
          wrote++;
        }
      }
    } catch (err) {
      errors.push(`ios details ${country}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Android: per (game, country), bounded concurrency to stay polite + fast
  const pairs = games.flatMap((g) =>
    g.play_id ? g.markets.map((country) => ({ game: g, country })) : []
  );
  const { errors: pairErrors } = await mapLimit(pairs, 4, async ({ game, country }) => {
    const d = await fetchPlayAppDetails(game.play_id!, country);
    if (d.reviewCount == null && d.installsText == null) return;
    await db`insert into app_snapshots (game_id, date, store, country, review_count, rating, installs_text, source)
      values (${game.id}, ${date}, 'android', ${country}, ${d.reviewCount}, ${d.rating}, ${d.installsText}, 'gplay_app')
      on conflict (game_id, date, store, country) do update
        set review_count = excluded.review_count, rating = excluded.rating, installs_text = excluded.installs_text`;
    wrote++;
  });
  for (const e of pairErrors) {
    errors.push(`android details ${e.item.game.play_id} ${e.item.country}: ${e.error}`);
  }

  return { wrote, errors };
}

// ---- meta: active ad creative counts (proxy) ----
async function collectMeta(games: Game[], date: string): Promise<{ wrote: number; errors: string[] }> {
  const db = sql();
  const errors: string[] = [];
  let wrote = 0;

  if (!process.env.META_AD_LIBRARY_TOKEN) {
    return { wrote: 0, errors: ["META_AD_LIBRARY_TOKEN not set — meta job skipped"] };
  }
  for (const g of games) {
    if (!g.meta_search) continue;
    try {
      const count = await fetchMetaAdCount(g.meta_search);
      await db`insert into ad_snapshots (game_id, date, active_ads, region)
        values (${g.id}, ${date}, ${count}, 'EU')
        on conflict (game_id, date, region) do update set active_ads = excluded.active_ads`;
      wrote++;
    } catch (err) {
      errors.push(`meta ${g.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { wrote, errors };
}

export async function runCollection(job: Job): Promise<JobReport[]> {
  const date = todayUtc();
  const games = await activeGames();
  const jobs: Exclude<Job, "all">[] = job === "all" ? ["charts", "details", "meta"] : [job];
  const reports: JobReport[] = [];

  for (const j of jobs) {
    const start = Date.now();
    let wrote = 0;
    let errors: string[] = [];
    try {
      const fn = j === "charts" ? collectCharts : j === "details" ? collectDetails : collectMeta;
      ({ wrote, errors } = await fn(games, date));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    const durationMs = Date.now() - start;
    const status = errors.length === 0 ? "ok" : wrote > 0 ? "partial" : "error";
    try {
      await log(j, status, `wrote=${wrote}${errors.length ? "; " + errors.join(" | ").slice(0, 3000) : ""}`, durationMs);
    } catch {
      // logging must never mask the report
    }
    reports.push({ job: j, date, wrote, errors, durationMs });
  }
  return reports;
}
