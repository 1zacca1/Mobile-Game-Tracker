import { withRetry } from "./util";

// REAL DATA — the App Store's own charts endpoint (the one the store app
// uses; same source the parse-tunes project documents). Apple's public RSS
// stopped carrying top-grossing, so grossing MUST come from here. We request
// the Games genre (6014), which also makes iOS ranks comparable to the
// Android games top-200.
//
// X-Apple-Store-Front wants Apple's numeric storefront id per country
// (mapping extracted from parse-tunes, MIT). Platform 29 = iPhone charts.
const STOREFRONTS: Record<string, number> = {
  dz: 143563, ao: 143564, ai: 143538, ag: 143540, ar: 143505, am: 143524, au: 143460, at: 143445,
  az: 143568, bh: 143559, bd: 143490, bb: 143541, by: 143565, be: 143446, bz: 143555, bm: 143542,
  bo: 143556, bw: 143525, br: 143503, vg: 143543, bn: 143560, bg: 143526, ca: 143455, ky: 143544,
  cl: 143483, cn: 143465, co: 143501, cr: 143495, ci: 143527, hr: 143494, cy: 143557, cz: 143489,
  dk: 143458, dm: 143545, do: 143508, ec: 143509, eg: 143516, sv: 143506, ee: 143518, fi: 143447,
  fr: 143442, de: 143443, gh: 143573, gr: 143448, gd: 143546, gt: 143504, gy: 143553, hn: 143510,
  hk: 143463, hu: 143482, is: 143558, in: 143467, id: 143476, ie: 143449, il: 143491, it: 143450,
  jm: 143511, jp: 143462, jo: 143528, kz: 143517, ke: 143529, kr: 143466, kw: 143493, lv: 143519,
  lb: 143497, li: 143522, lt: 143520, lu: 143451, mo: 143515, mk: 143530, mg: 143531, my: 143473,
  mv: 143488, ml: 143532, mt: 143521, mu: 143533, mx: 143468, md: 143523, ms: 143547, np: 143484,
  nl: 143452, nz: 143461, ni: 143512, ne: 143534, ng: 143561, no: 143457, om: 143562, pk: 143477,
  pa: 143485, py: 143513, pe: 143507, ph: 143474, pl: 143478, pt: 143453, qa: 143498, ro: 143487,
  ru: 143469, sa: 143479, sn: 143535, rs: 143500, sg: 143464, sk: 143496, si: 143499, za: 143472,
  es: 143454, lk: 143486, kn: 143548, lc: 143549, vc: 143550, sr: 143554, se: 143456, ch: 143459,
  tw: 143470, tz: 143572, th: 143475, bs: 143539, tt: 143551, tn: 143536, tr: 143480, tc: 143552,
  ug: 143537, gb: 143444, ua: 143492, ae: 143481, uy: 143514, us: 143441, uz: 143566, ve: 143502,
  vn: 143471, ye: 143571,
};

const CHART_IDS = { free: 27, grossing: 38 } as const; // iPhone charts
const GAMES_GENRE = 6014;

export type ChartKind = "free" | "grossing";

export type AppleChart = { ranks: Map<string, number>; source: string };

async function fetchViewTop(country: string, chart: ChartKind): Promise<Map<string, number>> {
  const storefront = STOREFRONTS[country];
  if (!storefront) throw new Error(`no App Store storefront id known for country "${country}"`);
  const url = `https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewTop?genreId=${GAMES_GENRE}&popId=${CHART_IDS[chart]}`;
  const data = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "X-Apple-Store-Front": `${storefront},29` },
    });
    if (!res.ok) throw new Error(`apple viewTop ${country}/${chart}: HTTP ${res.status}`);
    return res.json();
  });
  const adamIds: string[] | undefined =
    data?.pageData?.segmentedControl?.segments?.[0]?.pageData?.selectedChart?.adamIds;
  if (!Array.isArray(adamIds) || adamIds.length === 0) {
    throw new Error(`apple viewTop ${country}/${chart}: unexpected response shape`);
  }
  const out = new Map<string, number>();
  adamIds.forEach((appId, idx) => out.set(String(appId), idx + 1));
  return out;
}

// Fallback for the FREE chart only: Apple's marketing-tools RSS (top-100,
// all apps — a different population, recorded with its own source label).
// There is no fallback for grossing; a failed day stays missing.
async function fetchRssFree(country: string): Promise<Map<string, number>> {
  const url = `https://rss.marketingtools.apple.com/api/v2/${country}/apps/top-free/100/apps.json`;
  const data = await withRetry(async () => {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`apple rss ${country}/top-free: HTTP ${res.status}`);
    return res.json();
  });
  const out = new Map<string, number>();
  const results: { id: string }[] = data?.feed?.results ?? [];
  results.forEach((r, idx) => out.set(String(r.id), idx + 1));
  return out;
}

export async function fetchAppleChart(country: string, chart: ChartKind): Promise<AppleChart> {
  try {
    return { ranks: await fetchViewTop(country, chart), source: "apple_viewtop" };
  } catch (err) {
    if (chart === "free") {
      return { ranks: await fetchRssFree(country), source: "apple_rss" };
    }
    throw err;
  }
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
