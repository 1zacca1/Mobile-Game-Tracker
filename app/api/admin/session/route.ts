import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Auth probe for the Admin page. Middleware rejects the request unless it
// carries the admin key, so reaching this handler *is* the proof.
export async function GET() {
  return NextResponse.json({ ok: true });
}
