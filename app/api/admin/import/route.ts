import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// CSV import of third-party estimates (Sensor Tower, AppMagic exports, etc.).
// Expected header: game_id (or game = exact game name),date,metric,value,country,source
// Publisher-level rows (e.g. a company's total monthly downloads/revenue): use a `company`
// column and leave game_id/game blank.
// Re-importing the same (game, date, metric, country, source) replaces the old row.
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
  if (idx("game_id") === -1 && idx("game") === -1 && idx("company") === -1) {
    return NextResponse.json({ error: "missing column: game_id, game or company" }, { status: 400 });
  }
  for (const col of ["date", "metric", "value", "source"]) {
    if (idx(col) === -1) {
      return NextResponse.json({ error: `missing column: ${col}` }, { status: 400 });
    }
  }

  const db = sql();
  const nameToId = new Map<string, number>(
    (await db`select id, name from games`).map((g) => [String(g.name).toLowerCase(), Number(g.id)]),
  );
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const company = idx("company") >= 0 ? cells[idx("company")] || null : null;
    const rawGame = idx("game_id") >= 0 ? cells[idx("game_id")] : idx("game") >= 0 ? cells[idx("game")] : "";
    const gameId = !rawGame
      ? null
      : idx("game_id") >= 0
        ? Number(rawGame)
        : nameToId.get(rawGame.toLowerCase()) ?? 0;
    const date = cells[idx("date")];
    const metric = cells[idx("metric")];
    const value = Number(cells[idx("value")]);
    const country = idx("country") >= 0 ? cells[idx("country")]?.toLowerCase() || "ww" : "ww";
    const source = cells[idx("source")];
    if (gameId === 0 || Number.isNaN(gameId) || (gameId === null && !company) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !metric || !isFinite(value) || !source) {
      errors.push(`line ${i + 1}: could not parse`);
      continue;
    }
    try {
      await db`delete from estimates_import
        where game_id is not distinct from ${gameId} and company is not distinct from ${gameId === null ? company : null} and date = ${date} and metric = ${metric} and country = ${country} and source = ${source}`;
      await db`insert into estimates_import (game_id, company, date, metric, value, country, source)
        values (${gameId}, ${gameId === null ? company : null}, ${date}, ${metric}, ${value}, ${country}, ${source})`;
      inserted++;
    } catch (err) {
      errors.push(`line ${i + 1}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return NextResponse.json({ ok: true, inserted, errors });
}
