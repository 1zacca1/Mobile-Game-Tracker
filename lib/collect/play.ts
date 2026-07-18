import { withRetry } from "./util";

// REAL DATA — google-play-scraper hits Google Play's public web endpoints.
// Scraping from datacenter IPs fails intermittently; callers must treat a
// throw as "no data today", never substitute a value.
// google-play-scraper is ESM-only; loaded dynamically so it stays external to
// the Next.js bundle (see next.config.ts serverExternalPackages). Its shipped
// types don't match the memoized default export, so we type the surface we use.
export type GPlay = {
  list(opts: { collection: string; category: string; country: string; num: number }): Promise<{ appId: string }[]>;
  app(opts: { appId: string; country: string }): Promise<Record<string, unknown>>;
  search(opts: { term: string; country: string; num: number }): Promise<{ appId: string; title: string; developer: string }[]>;
  collection: { GROSSING: string; TOP_FREE: string };
  category: { GAME: string };
};

export async function gplay(): Promise<GPlay> {
  const mod = (await import("google-play-scraper")) as unknown as { default?: GPlay } & GPlay;
  return mod.default ?? mod;
}

export type ChartKind = "free" | "grossing";

// Top-200 GAME chart per country. Returns package -> rank.
export async function fetchPlayChart(country: string, chart: ChartKind): Promise<Map<string, number>> {
  const g = await gplay();
  const list = await withRetry(
    () =>
      g.list({
        collection: chart === "grossing" ? g.collection.GROSSING : g.collection.TOP_FREE,
        category: g.category.GAME,
        country,
        num: 200,
      }),
    3,
    2000
  );
  const out = new Map<string, number>();
  list.forEach((r, idx) => out.set(r.appId, idx + 1));
  return out;
}

export async function fetchPlayAppDetails(
  appId: string,
  country: string
): Promise<{ reviewCount: number | null; rating: number | null; installsText: string | null }> {
  const g = await gplay();
  const app = await withRetry(() => g.app({ appId, country }), 3, 2000);
  const a = app as { ratings?: number; score?: number; installs?: string };
  return {
    // `ratings` is the cumulative rating count — our Android review-velocity base.
    reviewCount: typeof a.ratings === "number" ? a.ratings : null,
    rating: typeof a.score === "number" ? a.score : null,
    installsText: typeof a.installs === "string" ? a.installs : null,
  };
}
