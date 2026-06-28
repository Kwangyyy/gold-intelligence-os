import { NextResponse } from "next/server";
import { buildIntermarketCorrelation } from "@/lib/correlation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await buildIntermarketCorrelation();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to build correlation analysis" }, { status: 502 });
  }
}
