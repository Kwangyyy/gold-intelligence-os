import { NextResponse } from "next/server";
import { buildPortfolio } from "@/lib/portfolio";
import { getMT5Data } from "@/lib/mt5Store";
import { getMarketSnapshot } from "@/lib/marketSnapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  let price = 4000;
  try {
    const m = await getMarketSnapshot();
    if (m?.price) price = m.price;
  } catch { /* use fallback */ }

  // Prefer live MT5 data if fresh
  const mt5 = await getMT5Data();
  if (mt5) {
    const floating = mt5.positions.reduce((s, p) => s + p.profit + p.swap, 0);
    return NextResponse.json({
      ...buildPortfolio(price),          // shape reference (equity curve, etc.)
      // Override with real MT5 data
      balance:     mt5.balance,
      equity:      mt5.equity,
      floating:    mt5.floating ?? floating,
      margin:      mt5.margin,
      freeMargin:  mt5.freeMargin,
      marginLevel: mt5.marginLevel,
      openPositions: mt5.positions.map((p) => ({
        ticket:    p.ticket,
        symbol:    p.symbol,
        direction: p.type,
        lots:      p.lots,
        entry:     p.openPrice,
        current:   p.currentPrice,
        sl:        p.sl,
        tp:        p.tp,
        pnl:       p.profit,
        openTime:  new Date(p.openTime * 1000).toISOString(),
        comment:   p.comment,
      })),
      mt5Connected: true,
      mt5LastSync:  mt5.lastUpdate,
      mt5Server:    mt5.server,
      mt5Account:   mt5.account,
      timestamp:    new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const data = buildPortfolio(price);
  return NextResponse.json(
    { ...data, mt5Connected: false, mt5LastSync: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
