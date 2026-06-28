import { NextResponse } from "next/server";
import { buildMultiTimeframe } from "@/lib/timeframes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await buildMultiTimeframe();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to build multi-timeframe analysis" },
      { status: 502 }
    );
  }
}
