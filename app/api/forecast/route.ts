import { NextResponse } from "next/server";
import { generateWeeklyForecast, type WeeklyForecastInput } from "@/lib/gemini";
import { calcRSI } from "@/lib/backtest";
import type { AiModelSignalEntry } from "@/app/api/ai-model/signal/route";
import type { MarketRegimePayload } from "@/app/api/market-regime/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// fetch with an abort timeout so one slow upstream can't hang the whole request
async function fetchT(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface ForecastResponse {
  forecast: Awaited<ReturnType<typeof generateWeeklyForecast>>;
  cached: boolean;
}

let CACHE: { data: ForecastResponse; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1 hour

function ema(data: number[], period: number): number {
  if (data.length < period) return data.at(-1) ?? 0;
  let val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) val = data[i] * k + val * (1 - k);
  return val;
}

async function fetchMarket() {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=3mo&interval=1d&includePrePost=false";
  const res = await fetchT(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data");

  const q = result.indicators?.quote?.[0] ?? {};
  const closes: number[] = (q.close ?? []).filter((v: unknown) => v != null);
  const highs:  number[] = (q.high  ?? []).filter((v: unknown) => v != null);
  const lows:   number[] = (q.low   ?? []).filter((v: unknown) => v != null);
  const meta = result.meta ?? {};
  const price = meta.regularMarketPrice ?? closes.at(-1) ?? 0;
  const weekClose = closes.at(-6) ?? closes.at(-1) ?? price;
  const weekChange = price - weekClose;
  const weekChangePct = weekClose > 0 ? (weekChange / weekClose) * 100 : 0;

  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const rsiArr = calcRSI(closes, 14);
  const rsi = rsiArr.at(-1) ?? 50;

  const atrVals = highs.slice(-15).map((h, i) => {
    const l = lows.slice(-15)[i];
    const pc = closes.slice(-16)[i] ?? l;
    return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  });
  const atr = atrVals.length ? atrVals.reduce((a, b) => a + b) / atrVals.length : 15;
  const atrPct = (atr / price) * 100;

  const recentHighs = highs.slice(-20).sort((a, b) => b - a).slice(0, 3);
  const recentLows  = lows.slice(-20).sort((a, b) => a - b).slice(0, 3);

  return { price, weekChange, weekChangePct, atr, atrPct, rsi, ema20: e20, ema50: e50, supports: recentLows, resistances: recentHighs };
}

async function fetchRegime(): Promise<{ adx: number; regime: string } | null> {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";
    const res = await fetchT(`${base}/api/market-regime`, { cache: "no-store" });
    if (!res.ok) return null;
    const d: MarketRegimePayload = await res.json();
    return { adx: d.adx, regime: d.regime };
  } catch { return null; }
}

async function fetchTechnical() {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";
    const res = await fetchT(`${base}/api/technical/score`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return { bias: d.overallBias as string, score: d.compositeScore as number };
  } catch { return null; }
}

async function fetchAiSignal() {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";
    const res = await fetchT(`${base}/api/ai-model/signal?limit=1`, { cache: "no-store" });
    if (!res.ok) return null;
    const arr: AiModelSignalEntry[] = await res.json();
    return arr[0] ?? null;
  } catch { return null; }
}

async function fetchNewsSentiment() {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";
    const res = await fetchT(`${base}/api/news`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return { sentiment: d.overallSentiment as string, score: d.overallScore as number };
  } catch { return null; }
}

async function fetchWeekEvents() {
  try {
    const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const res = await fetchT("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store",
    });
    if (!res.ok) return [];
    const raw: Array<{ title: string; country: string; impact: string; date: string }> = await res.json();
    return raw
      .filter(e => e.country === "USD" || e.impact === "High")
      .slice(0, 8)
      .map(e => ({
        title: e.title, country: e.country, impact: e.impact,
        day: DAYS[new Date(e.date).getDay()] ?? "?",
      }));
  } catch { return []; }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json({ ...CACHE.data, cached: true });
  }

  try {
    const [market, regime, technical, aiSignal, newsSentiment, weekEvents] = await Promise.all([
      fetchMarket(), fetchRegime(), fetchTechnical(), fetchAiSignal(), fetchNewsSentiment(), fetchWeekEvents(),
    ]);

    const input: WeeklyForecastInput = {
      price: market.price,
      weekChange: market.weekChange,
      weekChangePct: market.weekChangePct,
      atr: market.atr,
      atrPct: market.atrPct,
      rsi: market.rsi,
      adx: regime?.adx ?? 20,
      regime: regime?.regime ?? "UNKNOWN",
      technicalBias: technical?.bias ?? "neutral",
      technicalScore: technical?.score ?? 50,
      aiSignal: aiSignal?.decision,
      aiConfidence: aiSignal?.confidence,
      newsSentiment: newsSentiment?.sentiment,
      newsScore: newsSentiment?.score,
      supports: market.supports,
      resistances: market.resistances,
      weekEvents,
    };

    const forecast = await generateWeeklyForecast(input);
    const data: ForecastResponse = { forecast, cached: false };
    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
