"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ComposedChart, Area, CartesianGrid,
} from "recharts";

// Fixed country -> categorical slot. Color follows the entity: a country keeps
// its hue no matter which subset is on screen.
const COUNTRY_SLOT: Record<string, string> = {
  us: "var(--s1)", kr: "var(--s2)", tw: "var(--s3)", th: "var(--s4)",
  ph: "var(--s5)", id: "var(--s6)", jp: "var(--s7)",
};
// Store identity: one hue per store, used for every chart of that store.
export const STORE_COLOR = { ios: "var(--s1)", android: "var(--s2)" } as const;
export function countryColor(c: string): string {
  return COUNTRY_SLOT[c] ?? "var(--s8)";
}
export const SLOTS = [
  "var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)",
  "var(--s5)", "var(--s6)", "var(--s7)", "var(--s8)",
];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "0 6px 20px rgba(18, 21, 31, 0.12)",
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--text-primary)",
} as const;

export function fmtDate(d: string): string {
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const AXIS = { fontSize: 11, fill: "var(--text-muted)" } as const;

// Direct label at the last non-null point of a series, so lines can be mapped
// to their entity without round-tripping through the legend. The surface-color
// halo keeps it readable where lines cross.
function makeEndLabel(text: string, color: string, lastIdx: number) {
  const EndLabel = (props: { x?: number; y?: number; index?: number }) => {
    if (props.index !== lastIdx || props.x == null || props.y == null) return <g />;
    return (
      <text x={props.x + 6} y={props.y} dy={3.5} fontSize={10} fontWeight={600}
        fill={color} stroke="var(--surface-1)" strokeWidth={3} paintOrder="stroke">
        {text}
      </text>
    );
  };
  return EndLabel;
}

function lastNonNullIndex(data: Record<string, string | number | null>[], key: string): number {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][key] != null) return i;
  }
  return -1;
}

export function Sparkline({ data }: { data: { date: string; rank: number }[] }) {
  if (data.length === 0) {
    return <div className="flex h-12 items-center text-xs text-[var(--text-muted)]">no rank data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
        {/* inverted: better rank (lower number) plots higher */}
        <YAxis reversed hide domain={["dataMin", "dataMax"]} />
        <XAxis dataKey="date" hide />
        <Line type="monotone" dataKey="rank" stroke="var(--s1)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Multi-series rank chart, one line per key, inverted Y (up = better).
export function RankLinesChart({
  data, seriesKeys, colorFor, height = 260, endLabel,
}: {
  data: Record<string, string | number | null>[];
  seriesKeys: string[];
  colorFor: (key: string, idx: number) => string;
  height?: number;
  endLabel?: (key: string) => string;
}) {
  if (data.length === 0) {
    return <Empty />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: endLabel && seriesKeys.length <= 4 ? 36 : 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} minTickGap={48} tickFormatter={fmtDate} />
        <YAxis reversed domain={[1, "dataMax"]} allowDataOverflow tick={AXIS} tickLine={false} axisLine={false}
          width={40} tickFormatter={(v: number) => `#${v}`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }} cursor={{ stroke: "var(--baseline)" }} />
        {seriesKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={colorFor(k, i)} strokeWidth={2.25}
            dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }} connectNulls isAnimationActive={false}
            label={endLabel && seriesKeys.length <= 4 ? makeEndLabel(endLabel(k), colorFor(k, i), lastNonNullIndex(data, k)) : undefined} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Estimated revenue band: shaded low→high + mid line. Modeled data — the
// caller must render the methodology label next to this chart.
export function RevenueBandChart({
  data, height = 240,
}: {
  data: { date: string; low: number; mid: number; high: number; band: [number, number] }[];
  height?: number;
}) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} minTickGap={48} tickFormatter={fmtDate} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52}
          tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "var(--text-secondary)" }}
          formatter={(value, name) =>
            name === "band"
              ? [`$${(value as [number, number]).map((n) => n.toLocaleString()).join(" – $")}`, "range"]
              : [`$${Number(value).toLocaleString()}`, "midpoint"]
          }
        />
        <Area dataKey="band" stroke="none" fill="var(--s1)" fillOpacity={0.14} isAnimationActive={false} />
        <Line type="monotone" dataKey="mid" stroke="var(--s1)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Simple single/multi count chart (review velocity, ad creatives).
export function CountChart({
  data, seriesKeys, colorFor, height = 220, endLabel,
}: {
  data: Record<string, string | number | null>[];
  seriesKeys: string[];
  colorFor: (key: string, idx: number) => string;
  height?: number;
  endLabel?: (key: string) => string;
}) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: endLabel && seriesKeys.length <= 4 ? 36 : 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} minTickGap={48} tickFormatter={fmtDate} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }} cursor={{ stroke: "var(--baseline)" }} />
        {seriesKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={colorFor(k, i)} strokeWidth={2.25}
            dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }} connectNulls isAnimationActive={false}
            label={endLabel && seriesKeys.length <= 4 ? makeEndLabel(endLabel(k), colorFor(k, i), lastNonNullIndex(data, k)) : undefined} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-[var(--text-muted)]">
      No data yet — run a collection from the Admin page.
    </div>
  );
}

// CSV download from in-memory rows — every chart gets one of these.
export function CsvButton({ rows, filename }: { rows: Record<string, unknown>[]; filename: string }) {
  function download() {
    if (rows.length === 0) return;
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button onClick={download} disabled={rows.length === 0} className="btn text-xs disabled:opacity-40" title="Download this chart's data as CSV">
      ⬇ CSV
    </button>
  );
}

// Small multiples: one compact panel per series (country), single hue, shared
// y-scale so panels stay comparable. Replaces a 7-line overlay.
export function SmallMultiples({
  data, keys, color, kind, nameFor, height = 84,
}: {
  data: Record<string, string | number | null>[];
  keys: string[];
  color: string;
  kind: "rank" | "count";
  nameFor: (key: string) => string;
  height?: number;
}) {
  const rank = kind === "rank";
  const all = data.flatMap((r) => keys.map((k) => r[k])).filter((v): v is number => typeof v === "number");
  if (all.length === 0) return <Empty />;
  const lo = rank ? Math.min(...all) : Math.min(0, ...all);
  const hi = Math.max(...all);

  const panels = keys.map((k) => {
    const pts = data.filter((r) => typeof r[k] === "number").map((r) => ({ date: String(r.date), v: r[k] as number }));
    const last = pts[pts.length - 1];
    const ref = pts.length > 7 ? pts[pts.length - 8] : pts[0];
    // rank: lower is better, so improvement = fewer places; counts: higher is better
    const change = last && ref ? (rank ? ref.v - last.v : last.v - ref.v) : 0;
    // ranks share one scale (comparable); counts get their own, since markets differ by orders of magnitude
    const vals = pts.map((p) => p.v);
    const dom: [number, number] = rank ? [lo, hi] : [Math.min(0, ...vals), Math.max(...vals)];
    return { k, pts, last, change, dom };
  }).sort((a, b) => (rank ? (a.last?.v ?? 1e9) - (b.last?.v ?? 1e9) : (b.last?.v ?? 0) - (a.last?.v ?? 0)));

  const fmt = (v: number) => (rank ? `#${v}` : `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString()}`);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {panels.map(({ k, pts, last, change, dom }) => (
        <div key={k} className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{nameFor(k)}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular text-[var(--text-primary)]">{last ? fmt(last.v) : "—"}</span>
              {pts.length > 1 && change !== 0 && (
                <span className="text-[11px] font-semibold tabular"
                  style={{ color: change > 0 ? "var(--good)" : "var(--critical)" }}
                  title={rank ? "Places gained (▲) or lost (▼) vs 7 days earlier" : "Change vs 7 days earlier"}>
                  {change > 0 ? "▲" : "▼"} {Math.abs(Math.round(change)).toLocaleString()}
                </span>
              )}
            </span>
          </div>
          {pts.length === 0 ? (
            <div className="flex items-center text-xs text-[var(--text-muted)]" style={{ height }}>no data</div>
          ) : (
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={pts} margin={{ top: 10, right: 6, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="date" hide />
                <YAxis reversed={rank} domain={dom} ticks={dom[0] === dom[1] ? [dom[0]] : [dom[0], dom[1]]} interval={0} tick={AXIS}
                  tickLine={false} axisLine={false} width={rank ? 34 : 40} tickFormatter={fmt} allowDataOverflow />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => fmtDate(String(d))}
                  formatter={(v) => [fmt(Number(v)), nameFor(k)]} cursor={{ stroke: "var(--baseline)" }} />
                <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {pts.length > 1 && (
            <div className="mt-0.5 flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>{fmtDate(pts[0].date)}</span><span>{fmtDate(pts[pts.length - 1].date)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
