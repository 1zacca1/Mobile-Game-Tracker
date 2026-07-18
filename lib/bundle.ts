import { getRankSeries, getAppSeries, getAdSeries, getGame, getAnchors, getEstimatesImport } from "@/lib/queries";
import { calibrate, estimateRevenue, type Anchor } from "@/lib/estimator";
import type { Game } from "@/lib/db";

export type EstimateRow = {
  date: string; store: string; country: string; rank: number;
  est_low: number; est_mid: number; est_high: number;
  anchors: number; label: string;
};

export type SeriesBundle = {
  game: Game;
  ranks: Awaited<ReturnType<typeof getRankSeries>>;
  apps: Awaited<ReturnType<typeof getAppSeries>>;
  ads: Awaited<ReturnType<typeof getAdSeries>>;
  estimates: EstimateRow[];
  imports: Awaited<ReturnType<typeof getEstimatesImport>>;
  calibratedMarkets: string[];
};

// Revenue estimates are derived at read time: stored grossing ranks + current
// anchor set -> power-law fit per (store, country). No estimate rows are ever
// persisted, so recalibrating instantly reprices history.
export async function getSeriesBundle(gameId: number, days = 120): Promise<SeriesBundle | null> {
  const game = await getGame(gameId);
  if (!game) return null;

  const [ranks, apps, ads, anchorRows, imports] = await Promise.all([
    getRankSeries(gameId, days),
    getAppSeries(gameId, days),
    getAdSeries(gameId, days),
    getAnchors(),
    getEstimatesImport(gameId),
  ]);

  const anchorsByKey = new Map<string, Anchor[]>();
  for (const a of anchorRows as { store: string; country: string; rank: number; daily_revenue_usd: string | number }[]) {
    const k = `${a.store}|${a.country}`;
    (anchorsByKey.get(k) ?? anchorsByKey.set(k, []).get(k)!).push({
      rank: Number(a.rank),
      daily_revenue_usd: Number(a.daily_revenue_usd),
    });
  }

  const estimates: EstimateRow[] = [];
  for (const r of ranks) {
    if (r.chart !== "grossing") continue;
    const key = `${r.store}|${r.country}`;
    const cal = anchorsByKey.has(key) ? calibrate(anchorsByKey.get(key)!) : null;
    if (!cal) continue;
    const e = estimateRevenue(cal, r.rank);
    estimates.push({
      date: r.date, store: r.store, country: r.country, rank: r.rank,
      est_low: Math.round(e.low), est_mid: Math.round(e.mid), est_high: Math.round(e.high),
      anchors: cal.anchors, label: "MODELED from rank via power law",
    });
  }

  return {
    game, ranks, apps, ads, estimates, imports,
    calibratedMarkets: [...anchorsByKey.keys()],
  };
}
