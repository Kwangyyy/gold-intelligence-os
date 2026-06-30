import { NextRequest, NextResponse } from "next/server";
import { chatWithContext, geminiEnabled, type ChatMessage } from "@/lib/gemini";
import { getMarketSnapshot } from "@/lib/marketSnapshot";
import { buildMultiTimeframe } from "@/lib/timeframes";
import type { MarketSnapshot, MultiTimeframe } from "@/lib/types";

export const dynamic = "force-dynamic";

// Builds a compact text snapshot of the platform's current state for grounding.
function buildContext(mkt: MarketSnapshot | null, mtf: MultiTimeframe | null): string {
  const lines: string[] = [];
  if (mkt) {
    lines.push(
      `MARKET (XAUUSD, source ${mkt.source}, updated ${mkt.timestamp}):`,
      `- Price ${mkt.price} | Change ${mkt.change} (${mkt.changePercent}%) | Open ${mkt.open} High ${mkt.high} Low ${mkt.low} PrevClose ${mkt.previousClose}`,
      `- ATR ${mkt.atr} | Daily range ${mkt.dailyRange} | Spread ${mkt.spread} | Volatility ${mkt.volatilityStatus} | Condition ${mkt.marketCondition} | Market score ${mkt.marketScore}/100`,
      `- Session ${mkt.session.current}; London opens in ${mkt.session.minutesToLondonOpen}m, New York in ${mkt.session.minutesToNewYorkOpen}m`,
      `- AI recommendation: ${mkt.recommendation.label} (confidence ${mkt.recommendation.confidence}%, risk ${mkt.recommendation.riskLevel})`,
      `- Recommendation reasons: ${mkt.recommendation.mainReasons.map((r) => r.en).join("; ")}`,
      `- Invalidation: ${mkt.recommendation.invalidation.en}`,
    );
    if (mkt.newsRisk.nextEvent) {
      lines.push(
        `- News risk ${mkt.newsRisk.level}; next event ${mkt.newsRisk.nextEvent.name.en} in ${mkt.newsRisk.minutesToNext}m (forecast ${mkt.newsRisk.nextEvent.forecast ?? "n/a"}, previous ${mkt.newsRisk.nextEvent.previous ?? "n/a"})`,
      );
    }
  }
  if (mtf) {
    lines.push(
      ``,
      `MULTI-TIMEFRAME (overall bias ${mtf.overall.bias}; ${mtf.overall.bullishCount} bullish / ${mtf.overall.bearishCount} bearish / ${mtf.overall.neutralCount} neutral):`,
      ...mtf.rows
        .filter((r) => r.available)
        .map(
          (r) =>
            `- ${r.tf}: trend ${r.trend}, signal ${r.signal} (conf ${r.confidence}%), RSI ${r.rsi?.toFixed(1) ?? "n/a"}, ADX ${r.adx?.toFixed(1) ?? "n/a"}, MACD ${r.macdState}, structure ${r.structure}`,
        ),
    );
  }
  if (!lines.length) lines.push("No live data available right now.");
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  if (!geminiEnabled()) {
    return NextResponse.json({ error: "AI is not configured (missing GEMINI_API_KEY)." }, { status: 503 });
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  // Keep a sane cap on history sent to the model.
  messages = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Last message must be from the user." }, { status: 400 });
  }

  // Ground the answer in the platform's own live data (reuses their caches).
  const [mkt, mtf] = await Promise.all([
    getMarketSnapshot().catch(() => null as MarketSnapshot | null),
    buildMultiTimeframe().catch(() => null as MultiTimeframe | null),
  ]);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const reply = await chatWithContext(messages, buildContext(mkt, mtf), controller.signal);
    return NextResponse.json({ reply }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The AI could not respond right now. Please try again." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
