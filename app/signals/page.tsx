import Link from "next/link";
import { computeSignals } from "@/lib/signals";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  grossing_inflection: "Grossing inflection",
  new_chart_entry: "New chart entry",
  ad_creative_jump: "Ad creatives",
  breadth_change: "Chart breadth",
};

export default async function SignalsPage() {
  let signals: Awaited<ReturnType<typeof computeSignals>> = [];
  let error: string | null = null;
  try {
    signals = await computeSignals();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold">Signals</h1>
        <span className="text-xs text-[var(--text-muted)]">
          auto-flagged: grossing ±20 places WoW · new chart entries · ad creatives ±50% WoW · breadth ±2 countries
        </span>
      </div>

      {error && <div className="card p-4 text-sm text-[var(--text-secondary)]">Could not compute signals: {error}</div>}

      {!error && signals.length === 0 && (
        <div className="card p-6 text-sm text-[var(--text-secondary)]">
          No signals in the last two weeks. Signals need at least ~8 days of collected history to compare week-over-week.
        </div>
      )}

      <div className="space-y-2">
        {signals.map((s, i) => (
          <Link key={i} href={`/games/${s.gameId}`} className="card flex items-start gap-3 p-3 hover:border-[var(--text-muted)]">
            <span
              className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold"
              style={{
                color: s.direction === "up" ? "var(--good)" : "var(--critical)",
                background: "var(--surface-2)",
              }}
            >
              {s.direction === "up" ? "▲" : "▼"} {KIND_LABEL[s.kind]}
            </span>
            <span className="min-w-0 text-sm">
              <span className="font-semibold">{s.gameName}</span>
              <span className="text-[var(--text-muted)]"> ({s.company}) · {s.date}</span>
              <br />
              <span className="text-[var(--text-secondary)]">{s.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
