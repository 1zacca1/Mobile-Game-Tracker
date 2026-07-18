import { withRetry } from "./util";

// PROXY DATA — Meta Ad Library API. Counts ACTIVE ad creatives matching the
// game's search term. Two hard caveats, surfaced in the UI and README:
//  1. Requires META_AD_LIBRARY_TOKEN (a Meta Graph API user access token).
//  2. For ordinary commercial ads the Ad Library only exposes ads that reach
//     the EU (DSA transparency). So the count is "active creatives visible in
//     the EU library" — a breadth proxy for UA activity, NOT dollars and NOT
//     global coverage.
const GRAPH = "https://graph.facebook.com/v21.0/ads_archive";
const MAX_PAGES = 5; // cap at ~1250 creatives; beyond that record the cap

export async function fetchMetaAdCount(searchTerm: string): Promise<number> {
  const token = process.env.META_AD_LIBRARY_TOKEN;
  if (!token) throw new Error("META_AD_LIBRARY_TOKEN not set");

  let count = 0;
  let url =
    `${GRAPH}?search_terms=${encodeURIComponent(searchTerm)}` +
    `&ad_type=ALL&ad_active_status=ACTIVE&ad_reached_countries=['NL','DE','FR']` +
    `&fields=id&limit=250&access_token=${token}`;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const data = await withRetry(async () => {
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(`meta ads_archive HTTP ${res.status}: ${body?.error?.message ?? "unknown"}`);
      }
      return body;
    });
    count += (data.data ?? []).length;
    url = data.paging?.next ?? "";
  }
  return count;
}
