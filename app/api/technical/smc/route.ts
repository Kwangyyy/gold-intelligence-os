import { NextRequest, NextResponse } from "next/server";
import { buildSmc } from "@/lib/smc";
import type { TimeframeCode } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID: TimeframeCode[] = ["M15", "M30", "H1", "H4", "D1", "W1"];

export async function GET(req: NextRequest) {
  const tfParam = req.nextUrl.searchParams.get("tf")?.toUpperCase() ?? "H1";
  const tf = (VALID.includes(tfParam as TimeframeCode) ? tfParam : "H1") as TimeframeCode;
  try {
    const data = await buildSmc(tf);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: `Failed to build SMC analysis for ${tf}` }, { status: 502 });
  }
}
