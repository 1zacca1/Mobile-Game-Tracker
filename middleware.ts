import { NextRequest, NextResponse } from "next/server";
import { adminAuthStatus, adminDeniedResponse } from "@/lib/auth";

// Gate the Admin page and every /api/admin/* route on the server. Without the
// admin token a visitor gets a browser login prompt (pages) or 401 (API) and
// never sees the admin UI, the game list, logs or search.
export function middleware(req: NextRequest) {
  const status = adminAuthStatus(req.headers);
  if (status === "ok") return NextResponse.next();
  return adminDeniedResponse(status);
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
