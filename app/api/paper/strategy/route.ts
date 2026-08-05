import { NextResponse } from "next/server";
import { fetchCandlesForTf } from "@/lib/timeframes";
import { emaSeries, rsi, macd, atr } from "@/lib/indicators";
import { generateTradeStrategy, type TradeSetup } from "@/lib/gemini";
import { logSignal } from "@/lib/signalLog";
import { geminiEnabled } from "@/lib/gemini";
import { broadcastSignal } from "@/lib/telegram";
import { currentWaveDirection, judge } from "@/lib/waveFilter";

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

    // The same filter the logged signals go through. If the page showed a BUY
    // while the record wrote a WAIT, the app would be saying two things — and
    // the one a reader acts on would be the one that was measured as losing.
    const verdict = judge(setup.direction, await currentWaveDirection());
    if (!verdict.allow) {
      // Captured before it is overwritten, or the explanation below cannot say
      // what was actually proposed.
      const proposed = setup.direction === "buy" ? "เข้าซื้อ (BUY)" : "เข้าขาย (SELL)";
      setup.direction = "wait";
      setup.confidence = Math.min(setup.confidence, 45);
      setup.setupType = "รอ — สวนคลื่นใหญ่";
      setup.biasTh = `มีสัญญาณเข้าแต่ถูกกรองออก: ${verdict.reasonTh}`;
      setup.biasEn = `Setup suppressed: ${verdict.reason}`;
      // Shown, not hidden. A filter that silently removes trades is a filter
      // nobody can judge; naming the reason lets a reader disagree with it.
      setup.reasoningTh = [
        `สัญญาณเดิมคือ ${proposed}`,
        verdict.reasonTh,
        "ย้อนทดสอบพบว่าไม้ที่สวนคลื่นใหญ่ขาดทุนในทุกหน้าต่างที่ทดสอบ",
      ];
      setup.sl = 0; setup.tp1 = 0; setup.tp2 = null; setup.rr1 = 0;
    }

    const candles = h1.slice(-60).map(c => ({
      o: +c.open.toFixed(2), h: +c.high.toFixed(2),
      l: +c.low.toFixed(2),  c: +c.close.toFixed(2),
    }));

    CACHE = { setup, candles, ts: Date.now() };

    // Fire-and-forget: log + broadcast (never block response)
    logSignal({
      symbol: "XAUUSD",
      direction: setup.direction,
      confidence: setup.confidence,
      setupType: setup.setupType,
      entry: setup.entry,
      sl: setup.sl,
      tp1: setup.tp1,
      tp2: setup.tp2,
      rr1: setup.rr1,
      source: geminiEnabled() ? "gemini" : "rule",
    }).catch(() => {});

    // Broadcast to Telegram channel if confidence >= 65 and actionable
    if (setup.direction !== "wait" && setup.confidence >= 65) {
      broadcastSignal({
        symbol: "XAUUSD",
        direction: setup.direction,
        confidence: setup.confidence,
        entry: setup.entry,
        sl: setup.sl,
        tp1: setup.tp1,
        tp2: setup.tp2 ?? null,
        rr1: setup.rr1,
        setupType: setup.setupType,
        biasTh: setup.biasTh ?? "",
        reasoningTh: setup.reasoningTh ?? [],
        risksTh: setup.risksTh ?? [],
      }).catch(() => {});
    }

    return NextResponse.json({ setup, candles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "strategy failed" },
      { status: 500 },
    );
  }
}
