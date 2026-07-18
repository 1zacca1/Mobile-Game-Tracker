import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await sql()`select * from games order by company, name`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  const b = await req.json();
  if (!b?.name || !b?.company) {
    return NextResponse.json({ error: "name and company are required" }, { status: 400 });
  }
  const markets: string[] = Array.isArray(b.markets) && b.markets.length
    ? b.markets.map((m: string) => m.toLowerCase().trim()).filter(Boolean)
    : ["us", "kr", "tw", "th", "ph", "id", "jp"];
  const rows = await sql()`
    insert into games (name, company, appstore_id, play_id, meta_search, markets)
    values (${b.name}, ${b.company}, ${b.appstore_id || null}, ${b.play_id || null}, ${b.meta_search || null}, ${markets})
    returning *`;
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  const b = await req.json();
  if (!b?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const cur = await sql()`select * from games where id = ${b.id}`;
  if (!cur.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const g = cur[0];
  const markets: string[] = Array.isArray(b.markets)
    ? b.markets.map((m: string) => m.toLowerCase().trim()).filter(Boolean)
    : g.markets;
  const rows = await sql()`
    update games set
      name = ${b.name ?? g.name},
      company = ${b.company ?? g.company},
      appstore_id = ${b.appstore_id === undefined ? g.appstore_id : b.appstore_id || null},
      play_id = ${b.play_id === undefined ? g.play_id : b.play_id || null},
      meta_search = ${b.meta_search === undefined ? g.meta_search : b.meta_search || null},
      markets = ${markets},
      active = ${b.active ?? g.active}
    where id = ${b.id}
    returning *`;
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await sql()`delete from games where id = ${id}`;
  return NextResponse.json({ ok: true });
}
