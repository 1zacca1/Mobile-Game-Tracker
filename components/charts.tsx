"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area,
} from "recharts";

// Fixed country -> categorical slot. Color follows the entity: a country keeps
// its hue no matter which subset is on screen.
const COUNTRY_SLOT: Record<string, string> = {
  us: "var(--s1)", kr: "var(--s2)", tw: "var(--s3)", th: "var(--s4)",
  ph: "var(--s5)", id: "var(--s6)", jp: "var(--s7)",
};
export function countryColor(c: string): string {
  return COUNTRY_SLOT[c] ?? "var(--s8)";
}
export const SLOTS = [
  "var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)",
  "var(--s5)", "var(--s6)", "var(--s7)", "var(--s8)",
];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--text-primary)",
} as const;

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
    return <div className="flex h-10 items-center text-xs text-[var(--text-muted)]">no rank data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={40}>
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
      <LineChart data={data} margin={{ top: 8, right: endLabel ? 36 : 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} minTickGap={40} />
        <YAxis reversed tick={AXIS} tickLine={false} axisLine={false} width={38} domain={[1, "dataMax"]} allowDataOverflow />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--text-secondary)" }} />
        {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {seriesKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={colorFor(k, i)} strokeWidth={2}
            dot={false} connectNulls isAnimationActive={false}
            label={endLabel ? makeEndLabel(endLabel(k), colorFor(k, i), lastNonNullIndex(data, k)) : undefined} />
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
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} minTickGap={40} />
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
        <Area dataKey="band" stroke="none" fill="var(--s1)" fillOpacity={0.18} isAnimationActive={false} />
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
      <LineChart data={data} margin={{ top: 8, right: endLabel ? 36 : 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} minTickGap={40} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--text-secondary)" }} />
        {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {seriesKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={colorFor(k, i)} strokeWidth={2}
            dot={false} connectNulls isAnimationActive={false}
            label={endLabel ? makeEndLabel(endLabel(k), colorFor(k, i), lastNonNullIndex(data, k)) : undefined} />
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
