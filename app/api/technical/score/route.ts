import { NextRequest, NextResponse } from "next/server";
import { buildTechnicalScore } from "@/lib/technical";
import type { TimeframeCode } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID: TimeframeCode[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"];

export async function GET(req: NextRequest) {
  const tfParam = req.nextUrl.searchParams.get("tf")?.toUpperCase() ?? "H1";
  const tf = (VALID.includes(tfParam as TimeframeCode) ? tfParam : "H1") as TimeframeCode;
  try {
    const data = await buildTechnicalScore(tf);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: `Failed to compute technical score for ${tf}` }, { status: 502 });
  }
}
