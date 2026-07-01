import { NextResponse } from "next/server";
import { generateDailyBrief, type BriefInput, type DailyBrief } from "@/lib/gemini";
import { calcEMA, calcRSI } from "@/lib/backtest";
import type { AiModelSignalEntry } from "@/app/api/ai-model/signal/route";

export const dynamic = "force-dynamic";

let CACHE: { brief: DailyBrief; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1 hour

async function fetchMarketData() {
  // Price + 30-day daily OHLC from Yahoo Finance
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2mo&interval=1d&includePrePost=false";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No Yahoo data");

  const quote = result.indicators?.quote?.[0] ?? {};
  const closes: number[] = (quote.close ?? []).filter((v: unknown) => v != null);
  const highs:  number[] = (quote.high  ?? []).filter((v: unknown) => v != null);
  const lows:   number[] = (quote.low   ?? []).filter((v: unknown) => v != null);
  const meta = result.meta ?? {};

  const price  = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? closes[closes.length - 2] ?? price;
  const change    = price - prevClose;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const dayHigh = meta.regularMarketDayHigh ?? Math.max(...highs.slice(-1));
  const dayLow  = meta.regularMarketDayLow  ?? Math.min(...lows.slice(-1));

  // Technical: SMA(20), RSI(14), ATR(14)
  const sma20Arr = closes.length >= 20
    ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20
    : price;

  const rsiArr = calcRSI(closes, 14);
  const rsi14 = rsiArr[rsiArr.length - 1] ?? 50;

  const atrValues = highs.slice(-15).map((h, i) => {
    const l = lows.slice(-15)[i];
    const pc = closes.slice(-16)[i] ?? l;
    return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  });
  const atr = atrValues.length > 0 ? atrValues.reduce((a, b) => a + b) / atrValues.length : 10;

  // Session from UTC hour
  const utcH = new Date().getUTCHours();
  const session =
    utcH >= 23 || utcH < 8  ? "Asian Session"
    : utcH >= 8 && utcH < 16 ? "London Session"
    : "New York Session";

  return { price, change, changePct, high: dayHigh, low: dayLow, sma20: sma20Arr, rsi14, atr, session };
}

async function fetchCalendarEvents() {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store",
    });
    if (!res.ok) return [];
    const raw: Array<{ title: string; country: string; impact: string; forecast?: string; previous?: string; date: string }> = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    return raw
      .filter((e) => e.date?.startsWith(today) && (e.country === "USD" || e.impact === "High"))
      .slice(0, 5)
      .map((e) => ({ title: e.title, country: e.country, impact: e.impact, forecast: e.forecast, previous: e.previous }));
  } catch {
    return [];
  }
}

export async function GET() {
  // Serve cache if fresh
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json(CACHE.brief);
  }

  try {
    const [market, events] = await Promise.all([fetchMarketData(), fetchCalendarEvents()]);

    // Fetch latest AI model signal from Redis (non-blocking, silent fail)
    let aiSignal: AiModelSignalEntry | null = null;
    try {
      const sigRes = await fetch(
        new URL("/api/ai-model/signal?limit=1", process.env.NEXTAUTH_URL ?? "http://localhost:3100").toString(),
        { cache: "no-store" }
      );
      if (sigRes.ok) {
        const arr: AiModelSignalEntry[] = await sigRes.json();
        if (arr.length > 0) aiSignal = arr[0];
      }
    } catch { /* silent */ }

    const date = new Date().toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const aiSignalNote = aiSignal
      ? `AI ML Model (TF.js Neural Network trained on XAUUSD D1): Signal = ${aiSignal.decision}, Confidence = ${aiSignal.confidence.toFixed(1)}%, Test Accuracy = ${aiSignal.testAcc.toFixed(1)}%, trained ${Math.round((Date.now() - aiSignal.ts) / 3600000)}h ago`
      : "AI ML Model: not yet trained";

    const input: BriefInput = {
      date,
      price:     market.price,
      change:    market.change,
      changePct: market.changePct,
      high:      market.high,
      low:       market.low,
      sma20:     market.sma20,
      rsi14:     market.rsi14,
      atr:       market.atr,
      session:   market.session,
      events,
      supports:    [market.price - market.atr * 1.5, market.price - market.atr * 3].map((v) => Math.round(v * 10) / 10),
      resistances: [market.price + market.atr * 1.5, market.price + market.atr * 3].map((v) => Math.round(v * 10) / 10),
      aiSignalNote,
    };

    const brief = await generateDailyBrief(input);
    CACHE = { brief, ts: Date.now() };
    return NextResponse.json(brief);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
