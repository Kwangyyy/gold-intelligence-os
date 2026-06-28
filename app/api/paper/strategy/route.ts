import { NextResponse } from "next/server";
import { fetchCandlesForTf } from "@/lib/timeframes";
import { emaSeries, rsi, macd, atr } from "@/lib/indicators";
import { generateTradeStrategy, type TradeSetup } from "@/lib/gemini";

export const dynamic = "force-dynamic";

let CACHE: {
  setup: TradeSetup;
  candles: { o: number; h: number; l: number; c: number }[];
  ts: number;
} | null = null;
const TTL = 15 * 60 * 1000; // 15 minutes

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    if (!refresh && CACHE && Date.now() - CACHE.ts < TTL) {
      return NextResponse.json({ setup: CACHE.setup, candles: CACHE.candles });
    }

    const h1 = await fetchCandlesForTf("H1");
    if (h1.length < 60) throw new Error("insufficient H1 data");

    const closes = h1.map(c => c.close);
    const price  = closes.at(-1)!;

    const ema20V = emaSeries(closes, 20).at(-1) ?? price;
    const ema50V = emaSeries(closes, 50).at(-1) ?? price;
    const rsiV   = rsi(closes, 14) ?? 50;
    const macdR  = macd(closes, 12, 26, 9);
    const macdH  = macdR?.histogram ?? 0;
    const atrV   = atr(h1, 14) ?? 10;

    // Recent swing highs/lows for S/R
    const recent30 = h1.slice(-30);
    const highs = [...recent30.map(c => c.high)].sort((a, b) => b - a).slice(0, 3);
    const lows  = [...recent30.map(c => c.low)].sort((a, b) => a - b).slice(0, 3);

    const setup = await generateTradeStrategy({
      price, ema20: ema20V, ema50: ema50V,
      rsi: rsiV, macdHist: macdH, atr: atrV,
      support:    lows,
      resistance: highs,
      recentCandles: h1.slice(-10).map(c => ({ h: c.high, l: c.low, c: c.close })),
    });

    const candles = h1.slice(-60).map(c => ({
      o: +c.open.toFixed(2), h: +c.high.toFixed(2),
      l: +c.low.toFixed(2),  c: +c.close.toFixed(2),
    }));

    CACHE = { setup, candles, ts: Date.now() };
    return NextResponse.json({ setup, candles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "strategy failed" },
      { status: 500 },
    );
  }
}
