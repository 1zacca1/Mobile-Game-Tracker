import Link from "next/link";
import { Sparkline } from "./charts";
import type { OverviewRow } from "@/lib/queries";

export function GameCard({ row }: { row: OverviewRow }) {
  const { game, bestGrossingNow, bestGrossingWeekAgo, latestFree, reviewVelocity, breadth, spark } = row;
  const wow =
    bestGrossingNow != null && bestGrossingWeekAgo != null ? bestGrossingWeekAgo - bestGrossingNow : null;

  return (
    <Link href={`/games/${game.id}`} className="card block p-3 transition-colors hover:border-[var(--text-muted)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{game.name}</div>
          <div className="text-xs text-[var(--text-muted)]">{game.company}</div>
        </div>
        {wow != null ? (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold tabular"
            style={{
              color: wow > 0 ? "var(--good)" : wow < 0 ? "var(--critical)" : "var(--text-muted)",
              background: "var(--surface-2)",
            }}
            title="Change in best grossing rank vs 7 days ago (positive = improved)"
          >
            {wow > 0 ? `▲ ${wow}` : wow < 0 ? `▼ ${-wow}` : "—"} WoW
          </span>
        ) : (
          <span className="shrink-0 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">n/a</span>
        )}
      </div>

      <div className="mt-2">
        <Sparkline data={spark} />
        <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">best grossing rank, 30d (up = better)</div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Stat label="Grossing" value={bestGrossingNow != null ? `#${bestGrossingNow}` : "—"} />
        <Stat label="Free" value={latestFree != null ? `#${latestFree}` : "—"} />
        <Stat
          label="Reviews/day"
          value={reviewVelocity != null ? `+${Math.round(reviewVelocity).toLocaleString()}` : "—"}
        />
        <Stat label="Countries charting" value={String(breadth)} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold tabular">{value}</span>
    </div>
  );
}
