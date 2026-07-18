import { NextResponse } from "next/server";
import { getLogs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getLogs(200));
}
