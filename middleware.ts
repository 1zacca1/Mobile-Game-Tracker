import { NextRequest, NextResponse } from "next/server";
import { adminAuthStatus, adminDeniedResponse } from "@/lib/auth";

// Public by design: the site, the Admin page itself, and the read-only game
// list (it is the same data the Overview already shows). Everything else under
// /api/admin/* — every change (POST/PATCH/PUT/DELETE: add/edit/delete games,
// import, collect, setup, calibration) and the non-public reads (calibration
// anchors, logs, store search) — needs the admin key, checked on the server.
const PUBLIC_READS = new Set(["/api/admin/games"]);

export function middleware(req: NextRequest) {
  const isRead = req.method === "GET" || req.method === "HEAD";
  if (isRead && PUBLIC_READS.has(req.nextUrl.pathname)) return NextResponse.next();

  const status = adminAuthStatus(req.headers);
  if (status === "ok") return NextResponse.next();
  return adminDeniedResponse(status);
}

export const config = { matcher: ["/api/admin/:path*"] };
