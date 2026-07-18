import { withRetry } from "./util";

// REAL DATA — Apple's public marketing-tools RSS. Top-100 apps per country.
// Note: this feed is ALL apps (Apple retired the games-only RSS), so an iOS
// rank here is an overall-App-Store rank. Grossing charts are dominated by
// games, so top-grossing positions remain comparable day to day.
const RSS_BASE = "https://rss.marketingtools.apple.com/api/v2";

export type ChartKind = "free" | "grossing";

export async function fetchAppleChart(
  country: string,
  chart: ChartKind
): Promise<Map<string, number>> {
  const feed = chart === "grossing" ? "top-grossing" : "top-free";
  const url = `${RSS_BASE}/${country}/apps/${feed}/100/apps.json`;
  const data = await withRetry(async () => {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`apple rss ${country}/${feed}: HTTP ${res.status}`);
    return res.json();
  });
  const out = new Map<string, number>();
  const results: { id: string }[] = data?.feed?.results ?? [];
  results.forEach((r, idx) => out.set(String(r.id), idx + 1));
  return out;
}

// REAL DATA — iTunes lookup API. Batched (up to ~50 ids per call) per country.
// userRatingCount is cumulative; the UI derives review velocity as the
// day-over-day delta.
export async function fetchAppleAppDetails(
  ids: string[],
  country: string
): Promise<Map<string, { reviewCount: number; rating: number | null }>> {
  const out = new Map<string, { reviewCount: number; rating: number | null }>();
  if (ids.length === 0) return out;
  const url = `https://itunes.apple.com/lookup?id=${ids.join(",")}&country=${country}`;
  const data = await withRetry(async () => {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`apple lookup ${country}: HTTP ${res.status}`);
    return res.json();
  });
  for (const r of data?.results ?? []) {
    if (r.trackId != null && typeof r.userRatingCount === "number") {
      out.set(String(r.trackId), {
        reviewCount: r.userRatingCount,
        rating: typeof r.averageUserRating === "number" ? r.averageUserRating : null,
      });
    }
  }
  return out;
}
