import { NextRequest, NextResponse } from "next/server";
import { buildTradePlan } from "@/lib/plan";
import type { MarketSnapshot, SupportResistance } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  try {
    const [market, levels] = await Promise.all([
      fetch(`${origin}/api/market/xauusd`, { cache: "no-store" }).then((r) => r.json() as Promise<MarketSnapshot>),
      fetch(`${origin}/api/technical/levels`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<SupportResistance>) : null))
        .catch(() => null),
    ]);
    const plan = buildTradePlan(market, levels);
    return NextResponse.json(plan, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to build trading plan" }, { status: 502 });
  }
}
