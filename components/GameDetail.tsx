"use client";

import { useMemo, useState } from "react";
import { RankLinesChart, RevenueBandChart, CountChart, CsvButton, countryColor } from "./charts";
import { countryName } from "@/lib/countries";
import type { SeriesBundle } from "@/lib/bundle";

type StoreFilter = "both" | "ios" | "android";

function pivotByCountry(
  rows: { date: string; country: string; value: number }[],
): { data: Record<string, string | number | null>[]; keys: string[] } {
  const keys = [...new Set(rows.map((r) => r.country))].sort();
  const byDate = new Map<string, Record<string, string | number | null>>();
  for (const r of rows) {
    const row = byDate.get(r.date) ?? byDate.set(r.date, { date: r.date }).get(r.date)!;
    // multiple stores can land on the same (date,country): keep the better rank / sum handled by caller
    row[r.country] = r.value;
  }
  return { data: [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))), keys };
}

export function GameDetail({ bundle }: { bundle: SeriesBundle }) {
  const [store, setStore] = useState<StoreFilter>("both");
  const { game, ranks, apps, ads, estimates, imports } = bundle;

  const storeMatch = (s: string) => store === "both" || s === store;

  // rank pivots are always per store — iOS and Android charts are never merged
  const rankPivotFor = (chart: string, st: "ios" | "android") =>
    pivotByCountry(
      ranks
        .filter((r) => r.chart === chart && r.store === st)
        .map((r) => ({ date: r.date, country: r.country, value: r.rank })),
    );
  const grossingIos = useMemo(() => rankPivotFor("grossing", "ios"), [ranks]); // eslint-disable-line react-hooks/exhaustive-deps
  const grossingAndroid = useMemo(() => rankPivotFor("grossing", "android"), [ranks]); // eslint-disable-line react-hooks/exhaustive-deps
  const freeIos = useMemo(() => rankPivotFor("free", "ios"), [ranks]); // eslint-disable-line react-hooks/exhaustive-deps
  const freeAndroid = useMemo(() => rankPivotFor("free", "android"), [ranks]); // eslint-disable-line react-hooks/exhaustive-deps

  // review velocity: day-over-day delta per (store, country), summed across stores
  const velocity = useMemo(() => {
    const byKey = new Map<string, { date: string; n: number }[]>();
    for (const a of apps) {
      if (a.review_count == null || !storeMatch(a.store)) continue;
      const k = `${a.store}|${a.country}`;
      (byKey.get(k) ?? byKey.set(k, []).get(k)!).push({ date: a.date, n: a.review_count });
    }
    const rows: { date: string; country: string; value: number }[] = [];
    const acc = new Map<string, number>(); // date|country -> summed velocity
    for (const [k, arr] of byKey) {
      const country = k.split("|")[1];
      arr.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < arr.length; i++) {
        const days = (Date.parse(arr[i].date) - Date.parse(arr[i - 1].date)) / 86400000;
        if (days <= 0) continue;
        const v = (arr[i].n - arr[i - 1].n) / days;
        const key = `${arr[i].date}|${country}`;
        acc.set(key, (acc.get(key) ?? 0) + v);
      }
    }
    for (const [key, v] of acc) {
      const [date, country] = key.split("|");
      rows.push({ date, country, value: Math.round(v * 10) / 10 });
    }
    return pivotByCountry(rows);
  }, [apps, store]); // eslint-disable-line react-hooks/exhaustive-deps

  // revenue band: sum modeled low/mid/high across calibrated (store, country)
  const revenue = useMemo(() => {
    const byDate = new Map<string, { low: number; mid: number; high: number; n: number }>();
    for (const e of estimates) {
      if (!storeMatch(e.store)) continue;
      const cur = byDate.get(e.date) ?? { low: 0, mid: 0, high: 0, n: 0 };
      cur.low += e.est_low; cur.mid += e.est_mid; cur.high += e.est_high; cur.n++;
      byDate.set(e.date, cur);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, low: v.low, mid: v.mid, high: v.high, band: [v.low, v.high] as [number, number] }));
  }, [estimates, store]); // eslint-disable-line react-hooks/exhaustive-deps

  const calibratedForStore = useMemo(
    () => [...new Set(estimates.filter((e) => storeMatch(e.store)).map((e) => `${e.store} ${e.country.toUpperCase()}`))],
    [estimates, store] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const adsData = useMemo(
    () => ads.map((a) => ({ date: a.date, ads: a.active_ads })),
    [ads]
  );

  const installsLatest = useMemo(() => {
    const withInstalls = apps.filter((a) => a.installs_text);
    return withInstalls.length ? withInstalls[withInstalls.length - 1].installs_text : null;
  }, [apps]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">{game.name}</h1>
          <div className="text-xs text-[var(--text-muted)]">
            {game.company} · markets: {game.markets.map((m) => m.toUpperCase()).join(", ")}
            {installsLatest && <> · Play installs: {installsLatest} <span title="Google Play only publishes brackets">(bracket)</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-[var(--border)]">
            {(["both", "ios", "android"] as const).map((s) => (
              <button key={s} onClick={() => setStore(s)}
                className={`px-3 py-1 text-xs ${store === s ? "bg-[var(--s1)] font-semibold text-white" : "bg-[var(--surface-2)] text-[var(--text-secondary)]"}`}>
                {s === "both" ? "Both" : s === "ios" ? "iOS" : "Android"}
              </button>
            ))}
          </div>
          <a className="btn text-xs" href={`/api/series?game=${game.id}&format=csv&days=365`}>⬇ Full CSV</a>
        </div>
      </div>

      <ChartCard
        title="Top-grossing rank by country"
        note="REAL store data. Inverted axis: up = better. Games charts on both stores (iOS via the App Store charts endpoint, Android top-200). Stores are shown separately — never merged."
        csv={storeSplitCsv(store, grossingIos.data, grossingAndroid.data)}
        filename={`${game.name}_grossing.csv`}>
        <StoreSplitRanks store={store} ios={grossingIos} android={grossingAndroid} />
      </ChartCard>

      <ChartCard
        title="Top-free rank by country"
        note="REAL store data. Presence in free charts tracks download momentum."
        csv={storeSplitCsv(store, freeIos.data, freeAndroid.data)}
        filename={`${game.name}_free.csv`}>
        <StoreSplitRanks store={store} ios={freeIos} android={freeAndroid} />
      </ChartCard>

      <ChartCard
        title="Review velocity (Δ reviews/day) by country"
        note={`PROXY for downloads: day-over-day change in cumulative review/rating counts. ${store === "both" ? "iOS + Google Play summed per country (velocity is additive, unlike ranks)." : store === "ios" ? "iOS only (iTunes lookup)." : "Google Play only."} Needs at least two collection days to show anything.`}
        csv={velocity.data} filename={`${game.name}_review_velocity.csv`}>
        <CountChart data={velocity.data} seriesKeys={velocity.keys} colorFor={(k) => countryColor(k)}
          endLabel={(k) => k.toUpperCase()} />
        <CountryLegendNote keys={velocity.keys} />
      </ChartCard>

      <ChartCard
        title="Estimated daily revenue band (USD)"
        note={
          revenue.length
            ? `MODELED — not reported figures. Power law rev = A·rank^(−B) fit to your anchor points per (store, country); shaded area = uncertainty band. Currently summed across: ${calibratedForStore.join(", ")}. Markets without anchors are excluded, never guessed. Calibrate in Admin.`
            : "MODELED — needs calibration. No anchor points entered yet for this game's markets: add known rank↔revenue points (Sensor Tower press figures, company disclosures) in Admin → Calibration. Without anchors nothing is estimated — we don't invent dollars."
        }
        csv={revenue.map(({ band, ...r }) => r)} filename={`${game.name}_est_revenue.csv`}>
        <RevenueBandChart data={revenue} />
      </ChartCard>

      <ChartCard
        title="Active Meta ad creatives"
        note="PROXY for UA spend, not dollars. Count of ACTIVE creatives in Meta's Ad Library matching this title — EU-reach ads only (DSA transparency window)."
        csv={adsData} filename={`${game.name}_meta_ads.csv`}>
        <CountChart data={adsData} seriesKeys={["ads"]} colorFor={() => "var(--s6)"} />
      </ChartCard>

      {imports.length > 0 && (
        <ChartCard title="Imported third-party estimates" note="Manually imported via Admin (e.g. Sensor Tower monthlies). Shown as-is with source."
          csv={imports} filename={`${game.name}_imports.csv`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[var(--text-muted)]">
                <th className="py-1 pr-3">Date</th><th className="pr-3">Metric</th><th className="pr-3">Value</th><th className="pr-3">Country</th><th>Source</th>
              </tr></thead>
              <tbody>
                {imports.map((im, i) => (
                  <tr key={i} className="border-t border-[var(--grid)]">
                    <td className="py-1 pr-3 tabular">{im.date}</td>
                    <td className="pr-3">{im.metric}</td>
                    <td className="pr-3 tabular">{Number(im.value).toLocaleString()}</td>
                    <td className="pr-3">{String(im.country).toUpperCase()}</td>
                    <td className="text-[var(--text-muted)]">{im.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, note, children, csv, filename }: {
  title: string; note: string; children: React.ReactNode;
  csv: Record<string, unknown>[]; filename: string;
}) {
  return (
    <section className="card p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <CsvButton rows={csv} filename={filename.replace(/[^a-z0-9._-]+/gi, "_")} />
      </div>
      {children}
      <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">{note}</p>
    </section>
  );
}

type Pivot = { data: Record<string, string | number | null>[]; keys: string[] };

// CSV rows carry an explicit store column so exported data is never ambiguous.
function storeSplitCsv(
  store: StoreFilter,
  ios: Record<string, string | number | null>[],
  android: Record<string, string | number | null>[],
): Record<string, unknown>[] {
  const tag = (rows: Record<string, string | number | null>[], s: string) =>
    rows.map((r) => ({ store: s, ...r }));
  if (store === "ios") return tag(ios, "ios");
  if (store === "android") return tag(android, "android");
  return [...tag(ios, "ios"), ...tag(android, "android")];
}

// "Both" renders two stacked charts — one per store — rather than merging ranks.
function StoreSplitRanks({ store, ios, android }: { store: StoreFilter; ios: Pivot; android: Pivot }) {
  if (store === "ios") return <StoreBlock label={null} pivot={ios} emptyNote="No iOS chart ranks recorded (outside the games charts in these markets, or no App Store ID set)." />;
  if (store === "android") return <StoreBlock label={null} pivot={android} emptyNote="No Google Play chart ranks recorded (outside the games top-200 in these markets, or no Play package set)." />;
  return (
    <div className="space-y-3">
      <StoreBlock label="iOS — App Store (games top-200)" pivot={ios}
        emptyNote="No iOS chart ranks recorded (outside the games charts in these markets, or no App Store ID set)." />
      <StoreBlock label="Google Play (games top-200)" pivot={android}
        emptyNote="No Google Play chart ranks recorded (outside the games top-200 in these markets, or no Play package set)." />
    </div>
  );
}

function StoreBlock({ label, pivot, emptyNote }: { label: string | null; pivot: Pivot; emptyNote: string }) {
  return (
    <div>
      {label && <div className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">{label}</div>}
      {pivot.data.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded border border-dashed border-[var(--grid)] text-xs text-[var(--text-muted)]">
          {emptyNote}
        </div>
      ) : (
        <>
          <RankLinesChart data={pivot.data} seriesKeys={pivot.keys} colorFor={(k) => countryColor(k)}
            height={220} endLabel={(k) => k.toUpperCase()} />
          <CountryLegendNote keys={pivot.keys} />
        </>
      )}
    </div>
  );
}

function CountryLegendNote({ keys }: { keys: string[] }) {
  if (keys.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-secondary)]">
      {keys.map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: countryColor(k) }} />
          {countryName(k)}
        </span>
      ))}
    </div>
  );
}
