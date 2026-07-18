import { sql } from "@/lib/db";
import type { Game } from "@/lib/db";

export type Signal = {
  gameId: number;
  gameName: string;
  company: string;
  kind: "grossing_inflection" | "new_chart_entry" | "ad_creative_jump" | "breadth_change";
  direction: "up" | "down";
  detail: string;
  date: string;
};

const dateText = (d: unknown) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

// Signals are recomputed at read time from raw snapshots — nothing is stored,
// so tweaking thresholds later re-flags history consistently.
export async function computeSignals(): Promise<Signal[]> {
  const db = sql();
  const games = (await db`select * from games where active`) as Game[];
  const byId = new Map(games.map((g) => [g.id, g]));
  const signals: Signal[] = [];

  // per (game, store, country): latest grossing rank vs ~7 days earlier
  const grossing = await db`
    select game_id, store, country, date, rank
    from rank_snapshots
    where chart = 'grossing' and date > current_date - 15
    order by game_id, store, country, date`;

  type R = { game_id: number; store: string; country: string; date: unknown; rank: number };
  const byKey = new Map<string, R[]>();
  for (const r of grossing as R[]) {
    const k = `${r.game_id}|${r.store}|${r.country}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r);
  }

  for (const [key, arr] of byKey) {
    const [gid, store, country] = key.split("|");
    const g = byId.get(Number(gid));
    if (!g) continue;
    const latest = arr[arr.length - 1];
    const latestDate = dateText(latest.date);
    const target = new Date(new Date(latestDate).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const prior = arr.filter((r) => dateText(r.date) <= target);

    if (prior.length === 0) {
      // in charts now, no record a week ago -> new entry
      const first = dateText(arr[0].date);
      if (arr.length <= 3) {
        signals.push({
          gameId: g.id, gameName: g.name, company: g.company,
          kind: "new_chart_entry", direction: "up",
          detail: `Entered ${store} ${country.toUpperCase()} grossing chart at #${latest.rank} (first seen ${first})`,
          date: latestDate,
        });
      }
      continue;
    }
    const before = prior[prior.length - 1].rank;
    const delta = before - latest.rank; // positive = improved
    if (Math.abs(delta) > 20) {
      signals.push({
        gameId: g.id, gameName: g.name, company: g.company,
        kind: "grossing_inflection", direction: delta > 0 ? "up" : "down",
        detail: `${store} ${country.toUpperCase()} grossing ${delta > 0 ? "improved" : "dropped"} ${Math.abs(delta)} places WoW (#${before} → #${latest.rank})`,
        date: latestDate,
      });
    }
  }

  // ad creative count jump >50% WoW
  const ads = await db`
    select game_id, date, active_ads from ad_snapshots
    where date > current_date - 15 order by game_id, date`;
  const adsByGame = new Map<number, { date: string; n: number }[]>();
  for (const r of ads as { game_id: number; date: unknown; active_ads: number }[]) {
    const arr = adsByGame.get(r.game_id) ?? adsByGame.set(r.game_id, []).get(r.game_id)!;
    arr.push({ date: dateText(r.date), n: r.active_ads });
  }
  for (const [gid, arr] of adsByGame) {
    const g = byId.get(gid);
    if (!g || arr.length < 2) continue;
    const latest = arr[arr.length - 1];
    const target = new Date(new Date(latest.date).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const prior = arr.filter((r) => r.date <= target);
    if (!prior.length) continue;
    const before = prior[prior.length - 1].n;
    if (before >= 5 && latest.n >= before * 1.5) {
      signals.push({
        gameId: g.id, gameName: g.name, company: g.company,
        kind: "ad_creative_jump", direction: "up",
        detail: `Active Meta ad creatives +${Math.round(((latest.n - before) / before) * 100)}% WoW (${before} → ${latest.n}, EU library)`,
        date: latest.date,
      });
    } else if (before >= 5 && latest.n <= before * 0.5) {
      signals.push({
        gameId: g.id, gameName: g.name, company: g.company,
        kind: "ad_creative_jump", direction: "down",
        detail: `Active Meta ad creatives ${Math.round(((latest.n - before) / before) * 100)}% WoW (${before} → ${latest.n}, EU library)`,
        date: latest.date,
      });
    }
  }

  // chart breadth change (countries with any top-200 presence)
  const breadth = await db`
    select game_id, date, count(distinct country) as n
    from rank_snapshots where date > current_date - 15
    group by game_id, date order by game_id, date`;
  const brByGame = new Map<number, { date: string; n: number }[]>();
  for (const r of breadth as { game_id: number; date: unknown; n: string | number }[]) {
    const arr = brByGame.get(r.game_id) ?? brByGame.set(r.game_id, []).get(r.game_id)!;
    arr.push({ date: dateText(r.date), n: Number(r.n) });
  }
  for (const [gid, arr] of brByGame) {
    const g = byId.get(gid);
    if (!g || arr.length < 2) continue;
    const latest = arr[arr.length - 1];
    const target = new Date(new Date(latest.date).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const prior = arr.filter((r) => r.date <= target);
    if (!prior.length) continue;
    const before = prior[prior.length - 1].n;
    if (Math.abs(latest.n - before) >= 2) {
      signals.push({
        gameId: g.id, gameName: g.name, company: g.company,
        kind: "breadth_change", direction: latest.n > before ? "up" : "down",
        detail: `Chart presence ${latest.n > before ? "expanded" : "narrowed"}: ${before} → ${latest.n} countries with a top-chart rank`,
        date: latest.date,
      });
    }
  }

  signals.sort((a, b) => (a.date < b.date ? 1 : -1));
  return signals;
}
