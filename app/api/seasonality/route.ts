import { NextResponse } from "next/server";
import { buildSeasonality, type SeasonalityResult } from "@/lib/seasonality";

export const dynamic = "force-dynamic";

let CACHE: { data: SeasonalityResult; ts: number } | null = null;
const TTL = 6 * 60 * 60 * 1000; // 6 hours — historical data doesn't change

export async function GET() {
  try {
    if (CACHE && Date.now() - CACHE.ts < TTL) {
      return NextResponse.json(CACHE.data);
    }
    const data = await buildSeasonality();
    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "seasonality failed" },
      { status: 500 },
    );
  }
}
