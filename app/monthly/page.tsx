import Link from "next/link";
import { getMonthlyFigures, type MonthlyRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
const num = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n));

function monthLabel(m: string) {
  return new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type Line = { gameId: number; name: string; company: string; dl?: number; rev?: number; prevDl?: number; prevRev?: number; source: string };

export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  let rows: MonthlyRow[] = [];
  let error: string | null = null;
  try {
    rows = await getMonthlyFigures();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const months = [...new Set(rows.map((r) => r.month))].sort().reverse();
  const { month: q } = await searchParams;
  const month = q && months.includes(q) ? q : months[0];

  const lines = new Map<number, Line>();
  if (month) {
    const prev = prevMonth(month);
    for (const r of rows) {
      if (r.month !== month && r.month !== prev) continue;
      const l = lines.get(r.gameId) ?? lines.set(r.gameId, { gameId: r.gameId, name: r.name, company: r.company, source: r.source }).get(r.gameId)!;
      if (r.month === month) {
        if (r.metric === "downloads") l.dl = r.value; else l.rev = r.value;
        l.source = r.source;
      } else if (r.metric === "downloads") l.prevDl = r.value; else l.prevRev = r.value;
    }
  }
  const table = [...lines.values()].filter((l) => l.dl != null || l.rev != null).sort((a, b) => (b.rev ?? 0) - (a.rev ?? 0));
  const totDl = table.reduce((s, l) => s + (l.dl ?? 0), 0);
  const totRev = table.reduce((s, l) => s + (l.rev ?? 0), 0);
  const topDl = [...table].sort((a, b) => (b.dl ?? 0) - (a.dl ?? 0))[0];
  const topRev = table[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-bold">Monthly downloads &amp; revenue</h1>
        <span className="text-xs text-[var(--text-muted)]">
          Worldwide, prior-month figures from third-party publisher data · loaded via Admin → Import (once a month)
        </span>
      </div>

      {error && <div className="card p-4 text-sm text-[var(--text-secondary)]">Could not load figures: {error}</div>}

      {!error && months.length === 0 && (
        <div className="card p-6 text-sm text-[var(--text-secondary)]">
          No monthly figures yet. Open <Link className="underline" href="/admin">Admin</Link> and import a CSV with
          columns <code>game,date,metric,value,country,source</code> — metric <code>downloads</code> or{" "}
          <code>revenue_usd</code>, date = first of the month, country <code>ww</code>.
        </div>
      )}

      {month && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {months.map((m) => (
              <Link key={m} href={`/monthly?month=${m}`}
                className={`rounded-full border px-3 py-1 text-xs ${m === month ? "border-[var(--s1)] bg-[var(--s1)] font-semibold text-white" : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-secondary)]"}`}>
                {monthLabel(m)}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Downloads" sub={`Worldwide · ${monthLabel(month)}`} value={num(totDl)} />
            <Tile label="Revenue" sub={`Worldwide · ${monthLabel(month)}`} value={usd(totRev)} />
            <Tile label="Most downloaded" sub={topDl?.name ?? "—"} value={topDl?.dl != null ? num(topDl.dl) : "—"} small />
            <Tile label="Highest grossing" sub={topRev?.name ?? "—"} value={topRev?.rev != null ? usd(topRev.rev) : "—"} small />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-2)] text-left text-xs text-[var(--text-secondary)]">
                  <th className="px-3 py-2">Game</th>
                  <th className="px-3 py-2 text-right">Downloads</th>
                  <th className="px-3 py-2 text-right">MoM</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                  <th className="px-3 py-2 text-right">MoM</th>
                  <th className="px-3 py-2 text-right" title="Revenue per download">Rev / DL</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {table.map((l) => (
                  <tr key={l.gameId} className="border-t border-[var(--grid)]">
                    <td className="px-3 py-2">
                      <Link className="font-semibold hover:underline" href={`/games/${l.gameId}`}>{l.name}</Link>
                      <div className="text-xs text-[var(--text-muted)]">{l.company}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{l.dl != null ? num(l.dl) : "—"}</td>
                    <td className="px-3 py-2 text-right"><Delta cur={l.dl} prev={l.prevDl} /></td>
                    <td className="px-3 py-2 text-right tabular font-semibold">{l.rev != null ? usd(l.rev) : "—"}</td>
                    <td className="px-3 py-2 text-right"><Delta cur={l.rev} prev={l.prevRev} /></td>
                    <td className="px-3 py-2 text-right tabular">{l.dl && l.rev ? `$${(l.rev / l.dl).toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{l.source}</td>
                  </tr>
                ))}
                {table.length > 1 && (
                  <tr className="border-t-2 border-[var(--baseline)] bg-[var(--surface-2)] font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular">{num(totDl)}</td><td />
                    <td className="px-3 py-2 text-right tabular">{usd(totRev)}</td><td /><td /><td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Third-party estimates as imported, not store-reported or audited. MoM compares with the previous month when it has been imported.
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, sub, value, small }: { label: string; sub: string; value: string; small?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold">{label}</div>
      <div className="truncate text-xs text-[var(--text-muted)]">{sub}</div>
      <div className={`mt-2 font-semibold tabular text-[var(--s1)] ${small ? "text-xl" : "text-2xl"}`}>{value}</div>
    </div>
  );
}

function Delta({ cur, prev }: { cur?: number; prev?: number }) {
  if (cur == null || !prev) return <span className="text-[var(--text-muted)]">—</span>;
  const pct = ((cur - prev) / prev) * 100;
  return (
    <span className="tabular text-xs font-semibold" style={{ color: pct >= 0 ? "var(--good)" : "var(--critical)" }}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}
