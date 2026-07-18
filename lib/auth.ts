import { NextRequest, NextResponse } from "next/server";

// Cron route: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
// Also accepts x-cron-secret for manual curl testing.
export function checkCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

// Admin mutations: if ADMIN_TOKEN is set, require it via x-admin-token.
// If unset (first-run convenience), mutations are open — the README tells the
// user to set it before sharing the URL.
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return null;
  if (req.headers.get("x-admin-token") === token) return null;
  return NextResponse.json({ error: "admin token required (x-admin-token header)" }, { status: 401 });
}
