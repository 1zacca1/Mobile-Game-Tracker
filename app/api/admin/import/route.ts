import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// CSV import of third-party estimates (Sensor Tower, AppMagic exports, etc.).
// Expected header: game_id,date,metric,value,country,source
// metric: e.g. revenue_usd | downloads. Rows that fail to parse are reported
// back, never silently coerced.
export async function POST(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  const text = await req.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return NextResponse.json({ error: "empty CSV" }, { status: 400 });

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  for (const col of ["game_id", "date", "metric", "value", "source"]) {
    if (idx(col) === -1) {
      return NextResponse.json({ error: `missing column: ${col}` }, { status: 400 });
    }
  }

  const db = sql();
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const gameId = Number(cells[idx("game_id")]);
    const date = cells[idx("date")];
    const metric = cells[idx("metric")];
    const value = Number(cells[idx("value")]);
    const country = idx("country") >= 0 ? cells[idx("country")]?.toLowerCase() || "ww" : "ww";
    const source = cells[idx("source")];
    if (!gameId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !metric || !isFinite(value) || !source) {
      errors.push(`line ${i + 1}: could not parse`);
      continue;
    }
    try {
      await db`insert into estimates_import (game_id, date, metric, value, country, source)
        values (${gameId}, ${date}, ${metric}, ${value}, ${country}, ${source})`;
      inserted++;
    } catch (err) {
      errors.push(`line ${i + 1}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return NextResponse.json({ ok: true, inserted, errors });
}
