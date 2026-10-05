import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SCHEMA_SQL } from "@/lib/schema";
import { SEED_GAMES } from "@/lib/seed";
import { checkAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Idempotent: creates tables if missing, adds any missing seed games
// (matched by store ID or name). Safe to call repeatedly.
export async function POST(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  const db = sql();
  for (const stmt of SCHEMA_SQL) {
    await db(stmt);
  }
  // Insert any seed game not already tracked (matched by store ID), so new
  // seed entries also reach databases that were initialized earlier.
  let seeded = 0;
  for (const g of SEED_GAMES) {
    const dup = await db`select 1 from games
      where (${g.appstore_id}::text is not null and appstore_id = ${g.appstore_id})
         or (${g.play_id}::text is not null and play_id = ${g.play_id})
         or name = ${g.name} limit 1`;
    if (dup.length) continue;
    await db`insert into games (name, company, appstore_id, play_id, meta_search, markets)
      values (${g.name}, ${g.company}, ${g.appstore_id}, ${g.play_id}, ${g.meta_search}, ${g.markets})`;
    seeded++;
  }
  return NextResponse.json({ ok: true, tables: SCHEMA_SQL.length, seeded });
}
