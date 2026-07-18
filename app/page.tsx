import { GameCard } from "@/components/GameCard";
import { getOverview } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let rows: Awaited<ReturnType<typeof getOverview>> = [];
  let dbError: string | null = null;
  try {
    rows = await getOverview();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  if (dbError) {
    return (
      <div className="card p-6 text-sm">
        <div className="mb-1 font-semibold">Database not ready</div>
        <p className="text-[var(--text-secondary)]">
          {dbError.includes("DATABASE_URL")
            ? "DATABASE_URL is not configured. Add it in Vercel project settings, then open the Admin page and press “Initialize database”."
            : `Query failed: ${dbError}. If tables are missing, open the Admin page and press “Initialize database”.`}
        </p>
        <Link href="/admin" className="btn btn-primary mt-3 inline-block">Go to Admin</Link>
      </div>
    );
  }

  const companies = [...new Set(rows.map((r) => r.game.company))];
  return (
    <div className="space-y-6">
      {companies.map((company) => (
        <section key={company}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            {company}
            <span className="ml-2 font-normal normal-case text-[var(--text-muted)]">
              {company === "Century Games" ? "EVC / Smadex read-through" : company === "Gravity" ? "GRVY read-through" : ""}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.filter((r) => r.game.company === company).map((r) => (
              <GameCard key={r.game.id} row={r} />
            ))}
          </div>
        </section>
      ))}
      {rows.length === 0 && (
        <div className="card p-6 text-sm text-[var(--text-secondary)]">
          No games configured yet. Open <Link className="underline" href="/admin">Admin</Link> and press
          “Initialize database” to create tables and seed the default Century Games / Gravity set.
        </div>
      )}
    </div>
  );
}
