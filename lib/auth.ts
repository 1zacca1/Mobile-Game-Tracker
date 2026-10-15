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

// Constant-time string compare (edge-safe: no Node-only APIs).
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type AdminAuth = "ok" | "unauthorized" | "unconfigured";

// The whole Admin area (page + /api/admin/*) requires ADMIN_TOKEN, supplied as
// either an HTTP Basic password (any username — what the browser prompt sends)
// or an x-admin-token header (scripts/curl). Fails CLOSED: with no ADMIN_TOKEN
// configured, production refuses everything; only `next dev` is open.
export function adminAuthStatus(headers: Headers): AdminAuth {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return process.env.NODE_ENV === "production" ? "unconfigured" : "ok";

  const header = headers.get("x-admin-token");
  if (header && safeEqual(header, token)) return "ok";

  const auth = headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(password, token)) return "ok";
    } catch {
      /* malformed header → unauthorized */
    }
  }
  return "unauthorized";
}

export function adminDeniedResponse(status: AdminAuth): NextResponse {
  if (status === "unconfigured") {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured on the server; admin is disabled" },
      { status: 503 },
    );
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GameTracker admin", charset="UTF-8"' },
  });
}

// Defense in depth: every admin mutation re-checks, even though middleware
// already gates /api/admin/*.
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const status = adminAuthStatus(req.headers);
  return status === "ok" ? null : adminDeniedResponse(status);
}
