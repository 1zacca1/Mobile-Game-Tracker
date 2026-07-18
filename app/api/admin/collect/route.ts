import { NextRequest, NextResponse } from "next/server";
import { runCollection, type Job } from "@/lib/collect/run";
import { checkAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Collect now" button. Same collection code path as the cron route, gated by
// the admin token instead of the cron secret.
export async function POST(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  let job: Job = "all";
  try {
    const body = await req.json();
    if (["charts", "details", "meta", "all"].includes(body?.job)) job = body.job;
  } catch {
    // empty body -> all
  }
  const reports = await runCollection(job);
  return NextResponse.json({ ok: true, reports });
}
