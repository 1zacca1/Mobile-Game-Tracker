import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SCHEMA_SQL } from "@/lib/schema";
import { SEED_GAMES } from "@/lib/seed";
import { checkAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Idempotent: creates tables if missing, seeds games only when the table is
// empty. Safe to call repeatedly.
export async function POST(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  const db = sql();
  for (const stmt of SCHEMA_SQL) {
    await db(stmt);
  }
  const existing = await db`select count(*)::int as n from games`;
  let seeded = 0;
  if (Number(existing[0].n) === 0) {
    for (const g of SEED_GAMES) {
      await db`insert into games (name, company, appstore_id, play_id, meta_search, markets)
        values (${g.name}, ${g.company}, ${g.appstore_id}, ${g.play_id}, ${g.meta_search}, ${g.markets})`;
      seeded++;
    }
  }
  return NextResponse.json({ ok: true, tables: SCHEMA_SQL.length, seeded });
}
