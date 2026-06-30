import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/marketSnapshot";

// Recompute time-based fields (session, countdowns) on every request; the
// upstream price fetch is cached ~5s below to be polite to the source.
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getMarketSnapshot();
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
