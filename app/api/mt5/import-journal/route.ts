// Converts MT5 closed trades (stored in Redis) into TradeEntry format
// for merging into the client-side Journal (localStorage).
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLiveData, type MT5ClosedTrade } from "@/lib/mt5Store";
import type { TradeEntry, TradeSetup } from "@/lib/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guessSetup(comment: string): TradeSetup {
  const c = comment.toLowerCase();
  if (c.includes("smc") || c.includes("ob") || c.includes("fvg")) return "smc";
  if (c.includes("sr") || c.includes("support") || c.includes("resist")) return "sr";
  if (c.includes("break")) return "breakout";
  if (c.includes("trend")) return "trend";
  if (c.includes("news")) return "news";
  return "other";
}

function toTradeEntry(t: MT5ClosedTrade): TradeEntry {
  const pnl = +(t.profit + t.swap + t.commission).toFixed(2);
  const result = Math.abs(pnl) < 0.01 ? "breakeven" : pnl > 0 ? "win" : "loss";
  const rr = t.sl > 0
    ? +(Math.abs(t.closePrice - t.openPrice) / Math.abs(t.openPrice - t.sl)).toFixed(2)
    : null;

  return {
    id: `mt5-${t.ticket}`,
    symbol: t.symbol,
    direction: t.type,
    entryPrice: t.openPrice,
    exitPrice: t.closePrice,
    stopLoss: t.sl || undefined,
    takeProfit: t.tp || undefined,
    lotSize: t.lots,
    openTime:  new Date(t.openTime  * 1000).toISOString(),
    closeTime: new Date(t.closeTime * 1000).toISOString(),
    setup: guessSetup(t.comment),
    notes: t.comment || `MT5 #${t.ticket}`,
    pnlUSD: pnl,
    rr,
    result,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email   = session?.user?.email;
  if (!email) return NextResponse.json({ trades: [], message: "Not signed in" });

  const accountId = new URL(req.url).searchParams.get("account") ?? undefined;
  const live = await getUserLiveData(email, accountId);
  const acc  = live?.data;
  if (!acc || !acc.closedTrades?.length) {
    return NextResponse.json({ trades: [], message: "No closed trades from MT5 bridge" });
  }
  const trades = acc.closedTrades.map(toTradeEntry);
  return NextResponse.json({ trades, count: trades.length });
}
