// Rank -> daily revenue power-law estimator.
//
//   revenue(rank) = A * rank^(-B)
//
// Calibrated per (store, country) from user-entered anchor points (Sensor
// Tower press figures, company disclosures, etc.):
//  - 0 anchors  -> no estimate. We refuse to invent dollars.
//  - 1 anchor   -> B fixed at 0.75 (industry literature puts grossing-chart
//                  decay around 0.6–0.9), A solved from the anchor. Band ±60%.
//  - 2+ anchors -> log-log least-squares fit for A and B. Band from residual
//                  spread (min ±35%).
// Every estimate is labeled MODELED in the UI, with anchor count shown.

export type Anchor = { rank: number; daily_revenue_usd: number };

export type Calibration = {
  A: number;
  B: number;
  anchors: number;
  bandLow: number; // multiplier, e.g. 0.4
  bandHigh: number;
};

const DEFAULT_B = 0.75;

export function calibrate(anchors: Anchor[]): Calibration | null {
  const pts = anchors.filter((a) => a.rank >= 1 && a.daily_revenue_usd > 0);
  if (pts.length === 0) return null;

  if (pts.length === 1) {
    const A = pts[0].daily_revenue_usd * Math.pow(pts[0].rank, DEFAULT_B);
    return { A, B: DEFAULT_B, anchors: 1, bandLow: 0.4, bandHigh: 1.6 };
  }

  // least squares on log(rev) = log(A) - B*log(rank)
  const xs = pts.map((p) => Math.log(p.rank));
  const ys = pts.map((p) => Math.log(p.daily_revenue_usd));
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  // identical ranks: fall back to single-anchor mode on the mean revenue
  if (den === 0) {
    const A = Math.exp(my) * Math.pow(Math.exp(mx), DEFAULT_B);
    return { A, B: DEFAULT_B, anchors: n, bandLow: 0.4, bandHigh: 1.6 };
  }
  let B = -num / den;
  // clamp to a sane decay; anchors that imply revenue RISING with rank are noise
  B = Math.min(Math.max(B, 0.3), 1.5);
  const logA = my + B * mx;
  const A = Math.exp(logA);

  // band from residuals in log space
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const pred = logA - B * xs[i];
    sse += (ys[i] - pred) ** 2;
  }
  const sd = Math.sqrt(sse / Math.max(n - 2, 1));
  const spread = Math.max(Math.exp(sd) - 1, 0.35);
  return { A, B, anchors: n, bandLow: 1 / (1 + spread), bandHigh: 1 + spread };
}

export function estimateRevenue(cal: Calibration, rank: number) {
  const mid = cal.A * Math.pow(rank, -cal.B);
  return { mid, low: mid * cal.bandLow, high: mid * cal.bandHigh };
}
