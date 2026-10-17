import { NextRequest, NextResponse } from "next/server";
import { adminAuthStatus, adminDeniedResponse } from "@/lib/auth";

// Every /api/admin/* request — reads and writes alike — needs the admin key,
// checked on the server. The public site never calls these routes (its pages
// read the database server-side), so nothing visitors use is affected.
export function middleware(req: NextRequest) {
  const status = adminAuthStatus(req.headers);
  if (status === "ok") return NextResponse.next();
  return adminDeniedResponse(status);
}

export const config = { matcher: ["/api/admin/:path*"] };
