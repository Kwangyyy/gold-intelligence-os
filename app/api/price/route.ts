import { NextResponse } from "next/server";
import { goldChartJson } from "@/lib/goldSource";

export const dynamic = "force-dynamic";

let CACHE: { price: number; ts: number } | null = null;
const TTL = 4_000; // 4 seconds

export async function GET() {
  try {
    if (CACHE && Date.now() - CACHE.ts < TTL) {
      return NextResponse.json({ price: CACHE.price });
    }
    // spot-equivalent, real-time (was delayed COMEX futures)
    const json  = await goldChartJson("1d", "1m");
    const meta  = json?.chart?.result?.[0]?.meta ?? {};
    const price = (meta.regularMarketPrice ?? 0) as number;
    CACHE = { price, ts: Date.now() };
    return NextResponse.json({ price });
  } catch {
    return NextResponse.json({ price: 0 }, { status: 500 });
  }
}
