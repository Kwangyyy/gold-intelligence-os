import { NextResponse } from "next/server";
import { buildSupportResistance } from "@/lib/levels";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await buildSupportResistance();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to build support/resistance levels" }, { status: 502 });
  }
}
