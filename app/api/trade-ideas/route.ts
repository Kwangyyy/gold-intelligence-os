import { NextResponse } from "next/server";
import { generateTradeIdeas, type TradeIdea, type TradeIdeasInput } from "@/lib/gemini";
import { calcRSI } from "@/lib/backtest";
import type { AiModelSignalEntry } from "@/app/api/ai-model/signal/route";

export const dynamic = "force-dynamic";

let CACHE: { ideas: TradeIdea[]; meta: TradeMeta; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30 min

interface TradeMeta {
  price: number;
  technicalBias: string;
  technicalScore: number;
  aiSignal?: string;
  aiConfidence?: number;
  newsSentiment?: string;
  newsScore?: number;
  generatedAt: string;
}

async function fetchMarket() {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=3mo&interval=1d&includePrePost=false";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No Yahoo data");

  const q = result.indicators?.quote?.[0] ?? {};
  const closes: number[] = (q.close ?? []).filter((v: unknown) => v != null);
  const highs:  number[] = (q.high  ?? []).filter((v: unknown) => v != null);
  const lows:   number[] = (q.low   ?? []).filter((v: unknown) => v != null);
  const meta = result.meta ?? {};

  const price = meta.regularMarketPrice ?? closes.at(-1) ?? 0;

  // EMA helper
  function ema(data: number[], period: number): number {
    if (data.length < period) return data.at(-1) ?? 0;
    let val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const k = 2 / (period + 1);
    for (let i = period; i < data.length; i++) val = data[i] * k + val * (1 - k);
    return val;
  }

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);

  const rsiArr = calcRSI(closes, 14);
  const rsi = rsiArr.at(-1) ?? 50;

  // MACD hist (12,26,9)
  const emaFast = ema(closes, 12);
  const emaSlow = ema(closes, 26);
  const macdLine = emaFast - emaSlow;

  const atrValues = highs.slice(-15).map((h, i) => {
    const l = lows.slice(-15)[i];
    const pc = closes.slice(-16)[i] ?? l;
    return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  });
  const atr = atrValues.length ? atrValues.reduce((a, b) => a + b) / atrValues.length : 15;

  // Simple S/R: recent swing highs/lows
  const recentHighs = highs.slice(-20).sort((a, b) => b - a).slice(0, 2);
  const recentLows  = lows.slice(-20).sort((a, b) => a - b).slice(0, 2);

  return { price, ema20, ema50, rsi, macdHist: macdLine, atr, supports: recentLows, resistances: recentHighs, closes };
}

async function fetchTechnical() {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";
    const res = await fetch(`${base}/api/technical/score`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return { bias: data.overallBias as string, score: data.compositeScore as number };
  } catch { return null; }
}

async function fetchAiSignal() {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";
    const res = await fetch(`${base}/api/ai-model/signal?limit=1`, { cache: "no-store" });
    if (!res.ok) return null;
    const arr: AiModelSignalEntry[] = await res.json();
    return arr[0] ?? null;
  } catch { return null; }
}

async function fetchNewsSentiment() {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";
    const res = await fetch(`${base}/api/news`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return { sentiment: data.overallSentiment as string, score: data.overallScore as number };
  } catch { return null; }
}

async function fetchCalendar() {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store",
    });
    if (!res.ok) return [];
    const raw: Array<{ title: string; country: string; impact: string; date: string }> = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    return raw.filter(e => e.date?.startsWith(today) && (e.country === "USD" || e.impact === "High")).slice(0, 5);
  } catch { return []; }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json({ ideas: CACHE.ideas, meta: CACHE.meta, cached: true });
  }

  try {
    const [market, technical, aiSignalEntry, newsSentiment, events] = await Promise.all([
      fetchMarket(),
      fetchTechnical(),
      fetchAiSignal(),
      fetchNewsSentiment(),
      fetchCalendar(),
    ]);

    const input: TradeIdeasInput = {
      price: market.price,
      atr: market.atr,
      rsi: market.rsi,
      ema20: market.ema20,
      ema50: market.ema50,
      macdHist: market.macdHist,
      supports: market.supports,
      resistances: market.resistances,
      technicalBias: technical?.bias ?? "neutral",
      technicalScore: technical?.score ?? 50,
      aiSignal: aiSignalEntry?.decision,
      aiConfidence: aiSignalEntry?.confidence,
      newsSentiment: newsSentiment?.sentiment,
      newsScore: newsSentiment?.score,
      events,
    };

    const ideas = await generateTradeIdeas(input);

    const meta: TradeMeta = {
      price: market.price,
      technicalBias: technical?.bias ?? "neutral",
      technicalScore: technical?.score ?? 50,
      aiSignal: aiSignalEntry?.decision,
      aiConfidence: aiSignalEntry?.confidence,
      newsSentiment: newsSentiment?.sentiment,
      newsScore: newsSentiment?.score,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { ideas, meta, ts: Date.now() };
    return NextResponse.json({ ideas, meta, cached: false });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
