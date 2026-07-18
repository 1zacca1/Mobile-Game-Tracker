import { NextRequest, NextResponse } from "next/server";
import { getSeriesBundle } from "@/lib/bundle";

export const dynamic = "force-dynamic";

// Full series bundle for one game — powers the detail page charts and the CSV
// export (?format=csv). Revenue estimates are computed at read time and always
// labeled modeled.
export async function GET(req: NextRequest) {
  const gameId = Number(req.nextUrl.searchParams.get("game"));
  const days = Math.min(Number(req.nextUrl.searchParams.get("days")) || 120, 365);
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  if (!gameId) return NextResponse.json({ error: "game required" }, { status: 400 });

  const bundle = await getSeriesBundle(gameId, days);
  if (!bundle) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { game, ranks, apps, ads, estimates, imports } = bundle;

  if (format === "csv") {
    const lines: string[] = ["type,date,store,country,chart,rank,review_count,rating,installs,active_ads,est_low,est_mid,est_high,metric,value,source"];
    for (const r of ranks) lines.push(`rank,${r.date},${r.store},${r.country},${r.chart},${r.rank},,,,,,,,,,`);
    for (const a of apps) lines.push(`app,${a.date},${a.store},${a.country},,,${a.review_count ?? ""},${a.rating ?? ""},${(a.installs_text ?? "").replace(/,/g, "")},,,,,,,`);
    for (const a of ads) lines.push(`ads,${a.date},,,,,,,,${a.active_ads},,,,,,`);
    for (const e of estimates) lines.push(`estimate,${e.date},${e.store},${e.country},grossing,${e.rank},,,,,${e.est_low},${e.est_mid},${e.est_high},,,power_law_model`);
    for (const im of imports) lines.push(`import,${im.date},,${im.country},,,,,,,,,,${im.metric},${im.value},${im.source}`);
    return new NextResponse(lines.join("\n"), {
      headers: {
        "content-type": "text/csv",
        "content-disposition": `attachment; filename="${game.name.replace(/[^a-z0-9]+/gi, "_")}_series.csv"`,
      },
    });
  }

  return NextResponse.json({ game, ranks, apps, ads, estimates, imports });
}
