"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game } from "@/lib/db";
import { DEFAULT_MARKETS } from "@/lib/countries";

type Log = { id: number; run_at: string; job: string; status: string; detail: string | null; duration_ms: number | null };
type AnchorRow = { id: number; store: string; country: string; anchor_date: string; rank: number; daily_revenue_usd: string; note: string | null };

export function AdminPanel() {
  const [token, setToken] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [anchors, setAnchors] = useState<AnchorRow[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("admin_token") ?? "");
  }, []);

  const headers = useCallback(
    (): Record<string, string> => (token ? { "x-admin-token": token } : {}),
    [token]
  );

  const refresh = useCallback(async () => {
    try {
      const [g, a, l] = await Promise.all([
        fetch("/api/admin/games").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/admin/anchors").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/admin/logs").then((r) => (r.ok ? r.json() : [])),
      ]);
      setGames(Array.isArray(g) ? g : []);
      setAnchors(Array.isArray(a) ? a : []);
      setLogs(Array.isArray(l) ? l : []);
    } catch {
      setMsg("Could not load admin data — is the database initialized?");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function call(path: string, init: RequestInit, okMsg: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(path, { ...init, headers: { ...headers(), "content-type": init.body instanceof FormData ? undefined! : "application/json", ...(init.headers as Record<string, string>) } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`Error: ${body.error ?? res.status}`);
      } else {
        setMsg(okMsg + (body.reports ? " " + summarizeReports(body.reports) : "") + (body.seeded != null ? ` (seeded ${body.seeded} games)` : "") + (body.inserted != null ? ` (${body.inserted} rows${body.errors?.length ? `, ${body.errors.length} skipped` : ""})` : ""));
        await refresh();
      }
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-bold">Admin</h1>
        <input
          type="password"
          placeholder="admin token (if set)"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            localStorage.setItem("admin_token", e.target.value);
          }}
          className="w-44 text-xs"
        />
      </div>

      {msg && <div className="card border-[var(--s1)] p-2 text-xs">{msg}</div>}

      <section className="card space-y-2 p-3">
        <h2 className="text-sm font-semibold">Setup & collection</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy} onClick={() => call("/api/admin/setup", { method: "POST" }, "Database initialized.")}>
            Initialize database
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => call("/api/admin/collect", { method: "POST", body: JSON.stringify({ job: "all" }) }, "Collection finished.")}>
            {busy ? "Working…" : "Collect now (all)"}
          </button>
          <button className="btn" disabled={busy} onClick={() => call("/api/admin/collect", { method: "POST", body: JSON.stringify({ job: "charts" }) }, "Charts collected.")}>
            Charts only
          </button>
          <button className="btn" disabled={busy} onClick={() => call("/api/admin/collect", { method: "POST", body: JSON.stringify({ job: "details" }) }, "Details collected.")}>
            Details only
          </button>
          <button className="btn" disabled={busy} onClick={() => call("/api/admin/collect", { method: "POST", body: JSON.stringify({ job: "meta" }) }, "Meta ads collected.")}>
            Meta ads only
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">
          “Collect now” runs the same code as the daily cron. A full run takes 1–3 minutes; failures are logged below, and failed fetches write nothing (no fabricated rows).
        </p>
      </section>

      <GamesSection games={games} busy={busy} onSave={(body, isNew) =>
        call("/api/admin/games", { method: isNew ? "POST" : "PATCH", body: JSON.stringify(body) }, isNew ? "Game added." : "Game updated.")}
        onDelete={(id) => {
          if (confirm("Delete this game and ALL its collected history? Deactivating (untick active) keeps the data.")) {
            call(`/api/admin/games?id=${id}`, { method: "DELETE" }, "Game deleted.");
          }
        }} />

      <AnchorsSection anchors={anchors} busy={busy}
        onAdd={(body) => call("/api/admin/anchors", { method: "POST", body: JSON.stringify(body) }, "Anchor added.")}
        onDelete={(id) => call(`/api/admin/anchors?id=${id}`, { method: "DELETE" }, "Anchor deleted.")} />

      <ImportSection busy={busy} onImport={(text) =>
        call("/api/admin/import", { method: "POST", body: text, headers: { "content-type": "text/csv" } }, "Import finished.")} />

      <section className="card p-3">
        <h2 className="mb-2 text-sm font-semibold">Collection log</h2>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[var(--text-muted)]">
                <th className="py-1 pr-3">When (UTC)</th><th className="pr-3">Job</th><th className="pr-3">Status</th><th className="pr-3">ms</th><th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-[var(--grid)] align-top">
                  <td className="py-1 pr-3 tabular whitespace-nowrap">{l.run_at.slice(0, 19).replace("T", " ")}</td>
                  <td className="pr-3">{l.job}</td>
                  <td className="pr-3 font-semibold" style={{ color: l.status === "ok" ? "var(--good)" : l.status === "partial" ? "var(--warning)" : "var(--critical)" }}>{l.status}</td>
                  <td className="pr-3 tabular">{l.duration_ms ?? ""}</td>
                  <td className="break-all text-[var(--text-muted)]">{l.detail}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="py-3 text-[var(--text-muted)]">No runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function summarizeReports(reports: { job: string; wrote: number; errors: string[] }[]): string {
  return reports.map((r) => `${r.job}: ${r.wrote} rows${r.errors.length ? `, ${r.errors.length} errors` : ""}`).join(" · ");
}

// ---------------- games ----------------

type GameForm = {
  id?: number; name: string; company: string; appstore_id: string; play_id: string;
  meta_search: string; markets: string; active: boolean;
};
const EMPTY_FORM: GameForm = { name: "", company: "", appstore_id: "", play_id: "", meta_search: "", markets: DEFAULT_MARKETS.join(","), active: true };

function GamesSection({ games, busy, onSave, onDelete }: {
  games: Game[]; busy: boolean;
  onSave: (body: Record<string, unknown>, isNew: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [form, setForm] = useState<GameForm>(EMPTY_FORM);
  const [search, setSearch] = useState<{ ios: { id: string; name: string; developer: string }[]; android: { id: string; name: string; developer: string }[] } | null>(null);
  const [searching, setSearching] = useState(false);

  function set<K extends keyof GameForm>(k: K, v: GameForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function doSearch() {
    if (!form.name.trim()) return;
    setSearching(true);
    setSearch(null);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(form.name)}`);
      const body = await res.json();
      setSearch({
        ios: Array.isArray(body.ios) ? body.ios : [],
        android: Array.isArray(body.android) ? body.android : [],
      });
    } finally {
      setSearching(false);
    }
  }

  function submit() {
    onSave(
      {
        id: form.id, name: form.name, company: form.company,
        appstore_id: form.appstore_id.trim() || null,
        play_id: form.play_id.trim() || null,
        meta_search: form.meta_search.trim() || null,
        markets: form.markets.split(",").map((m) => m.trim()).filter(Boolean),
        active: form.active,
      },
      form.id == null
    );
    setForm(EMPTY_FORM);
    setSearch(null);
  }

  return (
    <section className="card space-y-3 p-3">
      <h2 className="text-sm font-semibold">Tracked games</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--text-muted)]">
              <th className="py-1 pr-3">Name</th><th className="pr-3">Company</th><th className="pr-3">iOS id</th>
              <th className="pr-3">Play package</th><th className="pr-3">Markets</th><th className="pr-3">Active</th><th></th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} className="border-t border-[var(--grid)]">
                <td className="py-1 pr-3 font-medium">{g.name}</td>
                <td className="pr-3">{g.company}</td>
                <td className="pr-3 tabular">{g.appstore_id ?? "—"}</td>
                <td className="pr-3 break-all">{g.play_id ?? "—"}</td>
                <td className="pr-3 uppercase">{g.markets.join(" ")}</td>
                <td className="pr-3">
                  <input type="checkbox" checked={g.active} disabled={busy}
                    onChange={(e) => onSave({ id: g.id, active: e.target.checked }, false)} />
                </td>
                <td className="whitespace-nowrap">
                  <button className="btn mr-1 px-2 py-0.5 text-[11px]" onClick={() => setForm({
                    id: g.id, name: g.name, company: g.company,
                    appstore_id: g.appstore_id ?? "", play_id: g.play_id ?? "",
                    meta_search: g.meta_search ?? "", markets: g.markets.join(","), active: g.active,
                  })}>edit</button>
                  <button className="btn px-2 py-0.5 text-[11px]" onClick={() => onDelete(g.id)}>del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-[var(--border)] p-2">
        <div className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
          {form.id == null ? "Add game" : `Editing #${form.id}`}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <input placeholder="Company (Century Games / Gravity / …)" value={form.company} onChange={(e) => set("company", e.target.value)} />
          <input placeholder="Markets, e.g. us,kr,tw" value={form.markets} onChange={(e) => set("markets", e.target.value)} />
          <input placeholder="App Store numeric id (optional)" value={form.appstore_id} onChange={(e) => set("appstore_id", e.target.value)} />
          <input placeholder="Play package, e.g. com.gof.global (optional)" value={form.play_id} onChange={(e) => set("play_id", e.target.value)} />
          <input placeholder="Meta Ad Library search term (optional)" value={form.meta_search} onChange={(e) => set("meta_search", e.target.value)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn" disabled={searching || !form.name.trim()} onClick={doSearch}>
            {searching ? "Searching…" : "🔍 Find store IDs"}
          </button>
          <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.company.trim()} onClick={submit}>
            {form.id == null ? "Add game" : "Save changes"}
          </button>
          {form.id != null && (
            <button className="btn" onClick={() => { setForm(EMPTY_FORM); setSearch(null); }}>Cancel</button>
          )}
        </div>
        {search && (
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <SearchResults title="App Store" results={search.ios} onPick={(id) => set("appstore_id", id)} />
            <SearchResults title="Google Play" results={search.android} onPick={(id) => set("play_id", id)} />
          </div>
        )}
      </div>
    </section>
  );
}

function SearchResults({ title, results, onPick }: {
  title: string; results: { id: string; name: string; developer: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 font-semibold text-[var(--text-secondary)]">{title}</div>
      {results.length === 0 && <div className="text-[var(--text-muted)]">no results / fetch failed</div>}
      <ul className="space-y-1">
        {results.map((r) => (
          <li key={r.id}>
            <button className="text-left underline decoration-[var(--text-muted)] hover:text-[var(--s1)]" onClick={() => onPick(r.id)}>
              {r.name}
            </button>
            <span className="text-[var(--text-muted)]"> — {r.developer} · {r.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- anchors ----------------

function AnchorsSection({ anchors, busy, onAdd, onDelete }: {
  anchors: AnchorRow[]; busy: boolean;
  onAdd: (body: Record<string, unknown>) => void; onDelete: (id: number) => void;
}) {
  const [f, setF] = useState({ store: "ios", country: "us", anchor_date: "", rank: "", daily_revenue_usd: "", note: "" });
  return (
    <section className="card space-y-2 p-3">
      <h2 className="text-sm font-semibold">Revenue calibration anchors</h2>
      <p className="text-[11px] text-[var(--text-muted)]">
        Enter known rank ↔ daily-revenue points per store+market (Sensor Tower press articles, company filings, AppMagic samples).
        1 anchor → power law with default slope B=0.75 and a wide ±60% band; 2+ anchors → fitted slope with a residual-based band.
        Anchors apply market-wide (to every game), since the grossing-rank→revenue curve is a property of the market, not the title.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[var(--text-muted)]">
            <th className="py-1 pr-3">Store</th><th className="pr-3">Market</th><th className="pr-3">Date</th>
            <th className="pr-3">Rank</th><th className="pr-3">Daily rev (USD)</th><th className="pr-3">Note</th><th></th>
          </tr></thead>
          <tbody>
            {anchors.map((a) => (
              <tr key={a.id} className="border-t border-[var(--grid)]">
                <td className="py-1 pr-3">{a.store}</td>
                <td className="pr-3 uppercase">{a.country}</td>
                <td className="pr-3 tabular">{String(a.anchor_date).slice(0, 10)}</td>
                <td className="pr-3 tabular">#{a.rank}</td>
                <td className="pr-3 tabular">${Number(a.daily_revenue_usd).toLocaleString()}</td>
                <td className="pr-3 text-[var(--text-muted)]">{a.note}</td>
                <td><button className="btn px-2 py-0.5 text-[11px]" disabled={busy} onClick={() => onDelete(a.id)}>del</button></td>
              </tr>
            ))}
            {anchors.length === 0 && <tr><td colSpan={7} className="py-2 text-[var(--text-muted)]">No anchors yet — revenue estimates stay off until you add some.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <select value={f.store} onChange={(e) => setF({ ...f, store: e.target.value })}>
          <option value="ios">iOS</option><option value="android">Android</option>
        </select>
        <input placeholder="market, e.g. us" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
        <input type="date" value={f.anchor_date} onChange={(e) => setF({ ...f, anchor_date: e.target.value })} />
        <input placeholder="rank, e.g. 12" inputMode="numeric" value={f.rank} onChange={(e) => setF({ ...f, rank: e.target.value })} />
        <input placeholder="daily USD, e.g. 850000" inputMode="numeric" value={f.daily_revenue_usd} onChange={(e) => setF({ ...f, daily_revenue_usd: e.target.value })} />
        <input placeholder="note / source" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>
      <button className="btn btn-primary" disabled={busy || !f.anchor_date || !f.rank || !f.daily_revenue_usd}
        onClick={() => { onAdd(f); setF({ ...f, rank: "", daily_revenue_usd: "", note: "" }); }}>
        Add anchor
      </button>
    </section>
  );
}

// ---------------- CSV import ----------------

function ImportSection({ busy, onImport }: { busy: boolean; onImport: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <section className="card space-y-2 p-3">
      <h2 className="text-sm font-semibold">Import third-party estimates (CSV)</h2>
      <p className="text-[11px] text-[var(--text-muted)]">
        Header: <code>game_id,date,metric,value,country,source</code> · metric examples: revenue_usd, downloads ·
        date as YYYY-MM-DD. Game IDs are in the table above. Imported rows are shown on the game page, labeled with their source.
      </p>
      <input type="file" accept=".csv,text/csv" className="text-xs"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) file.text().then(setText);
        }} />
      <textarea rows={5} className="w-full font-mono text-xs" placeholder={"game_id,date,metric,value,country,source\n1,2026-06-30,revenue_usd,1200000,us,SensorTower press 2026-07"} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => onImport(text)}>Import</button>
    </section>
  );
}
