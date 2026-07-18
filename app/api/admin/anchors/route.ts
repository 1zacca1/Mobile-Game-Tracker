import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await sql()`select * from anchors order by store, country, rank`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  const b = await req.json();
  const rank = Number(b?.rank);
  const rev = Number(b?.daily_revenue_usd);
  if (!b?.store || !b?.country || !rank || !rev || !b?.anchor_date) {
    return NextResponse.json(
      { error: "store, country, anchor_date, rank, daily_revenue_usd are required" },
      { status: 400 }
    );
  }
  const rows = await sql()`
    insert into anchors (store, country, anchor_date, rank, daily_revenue_usd, note)
    values (${b.store}, ${String(b.country).toLowerCase()}, ${b.anchor_date}, ${rank}, ${rev}, ${b.note || null})
    returning *`;
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await sql()`delete from anchors where id = ${id}`;
  return NextResponse.json({ ok: true });
}
