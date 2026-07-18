import { sql, type Game } from "@/lib/db";

export async function getGames(includeInactive = false): Promise<Game[]> {
  const rows = includeInactive
    ? await sql()`select * from games order by company, name`
    : await sql()`select * from games where active order by company, name`;
  return rows as Game[];
}

export async function getGame(id: number): Promise<Game | null> {
  const rows = await sql()`select * from games where id = ${id}`;
  return (rows[0] as Game) ?? null;
}

export type RankRow = {
  date: string;
  store: string;
  country: string;
  chart: string;
  rank: number;
};
export type AppRow = {
  date: string;
  store: string;
  country: string;
  review_count: number | null;
  rating: number | null;
  installs_text: string | null;
};
export type AdRow = { date: string; active_ads: number; region: string };

const dateText = (d: unknown) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

export async function getRankSeries(gameId: number, days = 120): Promise<RankRow[]> {
  const rows = await sql()`
    select date, store, country, chart, rank from rank_snapshots
    where game_id = ${gameId} and date > current_date - ${days}::int
    order by date`;
  return rows.map((r) => ({ ...r, date: dateText(r.date) })) as RankRow[];
}

export async function getAppSeries(gameId: number, days = 120): Promise<AppRow[]> {
  const rows = await sql()`
    select date, store, country, review_count, rating, installs_text from app_snapshots
    where game_id = ${gameId} and date > current_date - ${days}::int
    order by date`;
  return rows.map((r) => ({ ...r, date: dateText(r.date), review_count: r.review_count == null ? null : Number(r.review_count) })) as AppRow[];
}

export async function getAdSeries(gameId: number, days = 120): Promise<AdRow[]> {
  const rows = await sql()`
    select date, active_ads, region from ad_snapshots
    where game_id = ${gameId} and date > current_date - ${days}::int
    order by date`;
  return rows.map((r) => ({ ...r, date: dateText(r.date) })) as AdRow[];
}

export async function getAnchors() {
  return sql()`select * from anchors order by store, country, rank`;
}

export type ImportRow = { date: string; metric: string; value: number; country: string; source: string };

export async function getEstimatesImport(gameId: number): Promise<ImportRow[]> {
  const rows = await sql()`
    select date, metric, value, country, source from estimates_import
    where game_id = ${gameId} order by date`;
  return rows.map((r) => ({
    date: dateText(r.date),
    metric: String(r.metric),
    value: Number(r.value),
    country: String(r.country),
    source: String(r.source),
  }));
}

export async function getLogs(limit = 100) {
  const rows = await sql()`select * from collection_log order by id desc limit ${limit}`;
  return rows.map((r) => ({ ...r, run_at: String(r.run_at) }));
}

// Bundle used by the overview page: latest + 7d-ago best grossing rank, latest
// free rank, review velocity, chart breadth — computed in SQL, one round trip
// per concern.
export type OverviewRow = {
  game: Game;
  bestGrossingNow: number | null;
  bestGrossingWeekAgo: number | null;
  latestFree: number | null;
  reviewVelocity: number | null; // reviews/day, most recent delta across stores
  breadth: number; // countries with any top-200 rank today/yesterday
  spark: { date: string; rank: number }[]; // best grossing rank per day, 30d
};

export async function getOverview(): Promise<OverviewRow[]> {
  const games = await getGames();
  const db = sql();

  const bestRanks = await db`
    select game_id, date, min(rank) as best
    from rank_snapshots
    where chart = 'grossing' and date > current_date - 31
    group by game_id, date
    order by date`;

  const latestFree = await db`
    select distinct on (game_id) game_id, rank
    from rank_snapshots
    where chart = 'free' and date > current_date - 3
    order by game_id, date desc, rank asc`;

  const breadth = await db`
    select game_id, count(distinct country) as n
    from rank_snapshots
    where date > current_date - 2
    group by game_id`;

  // review velocity: latest two snapshots per (game, store, country), summed
  // deltas normalized per day, then averaged across dimensions
  const reviews = await db`
    select game_id, store, country, date, review_count
    from app_snapshots
    where review_count is not null and date > current_date - 15
    order by game_id, store, country, date`;

  const velocity = new Map<number, number>();
  {
    type R = { game_id: number; store: string; country: string; date: unknown; review_count: string | number };
    const byKey = new Map<string, R[]>();
    for (const r of reviews as R[]) {
      const k = `${r.game_id}|${r.store}|${r.country}`;
      (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r);
    }
    const perGame = new Map<number, number[]>();
    for (const arr of byKey.values()) {
      if (arr.length < 2) continue;
      const a = arr[arr.length - 2];
      const b = arr[arr.length - 1];
      const dDays =
        (new Date(dateText(b.date)).getTime() - new Date(dateText(a.date)).getTime()) / 86400000;
      if (dDays <= 0) continue;
      const v = (Number(b.review_count) - Number(a.review_count)) / dDays;
      (perGame.get(b.game_id) ?? perGame.set(b.game_id, []).get(b.game_id)!).push(v);
    }
    for (const [gid, vs] of perGame) {
      velocity.set(gid, vs.reduce((x, y) => x + y, 0));
    }
  }

  return games.map((game) => {
    const mine = (bestRanks as { game_id: number; date: unknown; best: number | string }[]).filter(
      (r) => r.game_id === game.id
    );
    const spark = mine.map((r) => ({ date: dateText(r.date), rank: Number(r.best) }));
    const today = spark.length ? spark[spark.length - 1] : null;
    const weekAgoTarget = today
      ? new Date(new Date(today.date).getTime() - 7 * 86400000).toISOString().slice(0, 10)
      : null;
    let weekAgo: number | null = null;
    if (weekAgoTarget) {
      const near = spark.filter((s) => s.date <= weekAgoTarget);
      if (near.length) weekAgo = near[near.length - 1].rank;
    }
    const free = (latestFree as { game_id: number; rank: number }[]).find((r) => r.game_id === game.id);
    const br = (breadth as { game_id: number; n: string | number }[]).find((r) => r.game_id === game.id);
    return {
      game,
      bestGrossingNow: today?.rank ?? null,
      bestGrossingWeekAgo: weekAgo,
      latestFree: free?.rank ?? null,
      reviewVelocity: velocity.get(game.id) ?? null,
      breadth: br ? Number(br.n) : 0,
      spark,
    };
  });
}
