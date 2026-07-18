import { NextRequest, NextResponse } from "next/server";
import { runCollection, type Job } from "@/lib/collect/run";
import { checkCronAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
// Needs Fluid compute (default on new Vercel projects) for the full 300s;
// writes are incremental so an earlier cutoff still keeps partial data.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jobParam = req.nextUrl.searchParams.get("job") ?? "all";
  const job = (["charts", "details", "meta", "all"].includes(jobParam) ? jobParam : "all") as Job;
  const reports = await runCollection(job);
  return NextResponse.json({ ok: true, reports });
}
