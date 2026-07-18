import { NextRequest, NextResponse } from "next/server";
import { withRetry } from "@/lib/collect/util";
import { gplay } from "@/lib/collect/play";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// App-ID lookup helper for the Admin "add game" flow: searches the iTunes
// Search API and Google Play so store IDs never have to be guessed.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const country = req.nextUrl.searchParams.get("country") ?? "us";
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const [ios, android] = await Promise.allSettled([
    withRetry(async () => {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=software&country=${country}&limit=8`
      );
      if (!res.ok) throw new Error(`itunes search HTTP ${res.status}`);
      const data = await res.json();
      return (data.results ?? []).map((r: { trackId: number; trackName: string; artistName: string }) => ({
        id: String(r.trackId),
        name: r.trackName,
        developer: r.artistName,
      }));
    }, 2),
    withRetry(async () => {
      const g = await gplay();
      const results = await g.search({ term: q, country, num: 8 });
      return results.map((r) => ({ id: r.appId, name: r.title, developer: r.developer }));
    }, 2),
  ]);

  return NextResponse.json({
    ios: ios.status === "fulfilled" ? ios.value : { error: String(ios.reason) },
    android: android.status === "fulfilled" ? android.value : { error: String(android.reason) },
  });
}
