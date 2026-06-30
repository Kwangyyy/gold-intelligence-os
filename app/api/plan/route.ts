import { NextResponse } from "next/server";
import { buildTradePlan } from "@/lib/plan";
import { getMarketSnapshot } from "@/lib/marketSnapshot";
import { buildSupportResistance } from "@/lib/levels";
import type { SupportResistance } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [market, levels] = await Promise.all([
      getMarketSnapshot(),
      buildSupportResistance().catch(() => null as SupportResistance | null),
    ]);
    const plan = buildTradePlan(market, levels);
    return NextResponse.json(plan, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to build trading plan" }, { status: 502 });
  }
}
