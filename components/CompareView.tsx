"use client";

import { useEffect, useMemo, useState } from "react";
import { RankLinesChart, CsvButton, SLOTS } from "./charts";
import { COUNTRY_NAMES } from "@/lib/countries";
import type { Game } from "@/lib/db";

type Bundle = {
  ranks: { date: string; store: string; country: string; chart: string; rank: number }[];
};

// Overlay best grossing rank per day for any set of games. Colors are assigned
// by game id order (fixed), capped at 8 series — beyond that the UI refuses to
// add more rather than generating hues.
export function CompareView({ games }: { games: Game[] }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [store, setStore] = useState<"both" | "ios" | "android">("both");
  const [country, setCountry] = useState<string>("all");
  const [bundles, setBundles] = useState<Record<number, Bundle>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const missing = selected.filter((id) => !bundles[id]);
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(
      missing.map(async (id) => {
        const res = await fetch(`/api/series?game=${id}&days=180`);
        if (!res.ok) throw new Error(`series ${id}: HTTP ${res.status}`);
        return [id, await res.json()] as const;
      })
    )
      .then((pairs) => setBundles((b) => ({ ...b, ...Object.fromEntries(pairs) })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected, bundles]);

  const colorById = useMemo(() => {
    const sorted = [...games].sort((a, b) => a.id - b.id);
    const m = new Map<number, string>();
    sorted.forEach((g, i) => m.set(g.id, SLOTS[i % SLOTS.length]));
    return m;
  }, [games]);

  function toggle(id: number) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= 8 ? s : [...s, id]
    );
  }
  function preset(company: string) {
    setSelected(games.filter((g) => g.company === company).map((g) => g.id).slice(0, 8));
  }

  const { data, keys } = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number | null>>();
    const keys: string[] = [];
    for (const id of selected) {
      const b = bundles[id];
      const g = games.find((x) => x.id === id);
      if (!b || !g) continue;
      keys.push(g.name);
      const best = new Map<string, number>();
      for (const r of b.ranks) {
        if (r.chart !== "grossing") continue;
        if (store !== "both" && r.store !== store) continue;
        if (country !== "all" && r.country !== country) continue;
        best.set(r.date, Math.min(best.get(r.date) ?? Infinity, r.rank));
      }
      for (const [date, rank] of best) {
        const row = byDate.get(date) ?? byDate.set(date, { date }).get(date)!;
        row[g.name] = rank;
      }
    }
    return {
      data: [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
      keys,
    };
  }, [selected, bundles, store, country, games]);

  const colorForKey = (key: string) => {
    const g = games.find((x) => x.name === key);
    return g ? colorById.get(g.id)! : SLOTS[7];
  };

  return (
    <div className="space-y-3">
      <div className="card space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn text-xs" onClick={() => preset("Century Games")}>All Century Games</button>
          <button className="btn text-xs" onClick={() => preset("Gravity")}>All Gravity</button>
          <button className="btn text-xs" onClick={() => setSelected([])}>Clear</button>
          <span className="text-xs text-[var(--text-muted)]">{selected.length}/8 selected</span>
          <div className="ml-auto flex items-center gap-2">
            <select value={store} onChange={(e) => setStore(e.target.value as typeof store)} className="text-xs">
              <option value="both">Both stores</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
            </select>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="text-xs">
              <option value="all">All markets (best rank)</option>
              {Object.entries(COUNTRY_NAMES).filter(([c]) => c !== "ww").map(([c, n]) => (
                <option key={c} value={c}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {games.map((g) => {
            const on = selected.includes(g.id);
            return (
              <button key={g.id} onClick={() => toggle(g.id)}
                className={`rounded-full border-2 px-2.5 py-1 text-xs transition-colors ${on ? "font-semibold text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
                style={on ? { borderColor: colorById.get(g.id), background: "var(--surface-2)" } : undefined}>
                {on && (
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: colorById.get(g.id) }} />
                )}
                {g.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Top-grossing rank overlay {loading && <span className="text-xs text-[var(--text-muted)]">(loading…)</span>}</h2>
          <CsvButton rows={data} filename="compare_grossing.csv" />
        </div>
        {selected.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-[var(--text-muted)]">
            Pick games above or use a preset.
          </div>
        ) : (
          <RankLinesChart data={data} seriesKeys={keys} colorFor={colorForKey} height={320}
            endLabel={(k) => (k.length > 14 ? `${k.slice(0, 13)}…` : k)} />
        )}
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          Best (lowest) grossing rank per day within the chosen store/market filter. Inverted axis: up = better.
        </p>
      </div>
    </div>
  );
}
