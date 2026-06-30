// Shared XAUUSD market snapshot builder — used directly by the market/xauusd
// route AND by other server routes (portfolio, plan, ai/chat) that need the
// same data. Call this function directly instead of HTTP-fetching our own
// /api/market/xauusd route: a self-fetch goes through the full Next.js
// request stack (and in dev, on-demand compilation) for no benefit since
// we're already on the server.
import type { AiRecommendation, Bilingual, MarketSnapshot } from "./types";
import {
  computeATR,
  computeMarketScore,
  deriveMarketCondition,
  deriveVolatility,
  estimateSpread,
  getSession,
  stubRecommendation,
} from "./marketLogic";
import { getNewsRisk } from "./mockNews";
import {
  geminiEnabled,
  generateNewsImpact,
  generateRecommendation,
  type RecommendationInput,
} from "./gemini";

const YAHOO_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1mo";

interface YahooQuote {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
}

interface YahooMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
}

function lastValid(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null && !Number.isNaN(arr[i] as number)) return arr[i] as number;
  }
  return null;
}

function buildSnapshot(input: {
  price: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  atr: number;
  isLive: boolean;
  source: string;
}): MarketSnapshot {
  const { price, previousClose, open, high, low, atr, isLive, source } = input;

  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;
  const dailyRange = high - low;

  const volatilityStatus = deriveVolatility(dailyRange, atr);
  const session = getSession();
  const sessionClosed = session.current === "closed";
  const marketCondition = deriveMarketCondition(changePercent, volatilityStatus, sessionClosed);
  const marketScore = computeMarketScore(changePercent, price, high, low);
  const newsRisk = getNewsRisk();
  const spread = estimateSpread(price, volatilityStatus);

  const recommendation = stubRecommendation({
    changePercent,
    price,
    high,
    low,
    volatility: volatilityStatus,
    marketScore,
    newsRisk,
  });

  return {
    symbol: "XAUUSD",
    source,
    isLive,
    aiSource: "fallback",
    price: +price.toFixed(2),
    previousClose: +previousClose.toFixed(2),
    open: +open.toFixed(2),
    high: +high.toFixed(2),
    low: +low.toFixed(2),
    change: +change.toFixed(2),
    changePercent: +changePercent.toFixed(2),
    dailyRange: +dailyRange.toFixed(2),
    spread,
    atr: +atr.toFixed(2),
    volatilityStatus,
    marketCondition,
    marketScore,
    session,
    recommendation,
    newsRisk,
    timestamp: new Date().toISOString(),
  };
}

function fallbackSnapshot(): MarketSnapshot {
  return buildSnapshot({
    price: 4033.6,
    previousClose: 4047.6,
    open: 4046.0,
    high: 4051.6,
    low: 3998.1,
    atr: 38.5,
    isLive: false,
    source: "fallback (cached sample)",
  });
}

// ── AI layer — Gemini with a stale-while-revalidate cache ──────────────────
const AI_TTL_MS = 300_000; // 5 minutes
const AI_TIMEOUT_MS = 15_000;

interface AiCache {
  recommendation: AiRecommendation;
  newsImpact: Bilingual | null;
  newsKey: string;
  at: number;
  source: "gemini" | "fallback";
}

let aiCache: AiCache | null = null;
let aiInflight: Promise<void> | null = null;

function newsKeyOf(s: MarketSnapshot): string {
  const ev = s.newsRisk.nextEvent;
  return ev ? `${ev.name.en}@${ev.time}` : "none";
}

function toRecommendationInput(s: MarketSnapshot): RecommendationInput {
  return {
    price: s.price,
    previousClose: s.previousClose,
    open: s.open,
    high: s.high,
    low: s.low,
    changePercent: s.changePercent,
    atr: s.atr,
    dailyRange: s.dailyRange,
    volatilityStatus: s.volatilityStatus,
    marketCondition: s.marketCondition,
    marketScore: s.marketScore,
    session: s.session.current,
    newsRiskLevel: s.newsRisk.level,
    nextEvent: s.newsRisk.nextEvent
      ? { name: s.newsRisk.nextEvent.name.en, minutesToNext: s.newsRisk.minutesToNext }
      : null,
  };
}

async function refreshAi(s: MarketSnapshot): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const key = newsKeyOf(s);
  try {
    const [recommendation, newsImpact] = await Promise.all([
      generateRecommendation(toRecommendationInput(s), controller.signal),
      s.newsRisk.nextEvent
        ? generateNewsImpact(s.newsRisk.nextEvent, controller.signal).catch(() => null)
        : Promise.resolve<Bilingual | null>(null),
    ]);
    aiCache = { recommendation, newsImpact, newsKey: key, at: Date.now(), source: "gemini" };
  } catch {
    aiCache = {
      recommendation: s.recommendation,
      newsImpact: null,
      newsKey: key,
      at: Date.now(),
      source: "fallback",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function applyAi(s: MarketSnapshot): Promise<void> {
  if (!geminiEnabled()) return;

  const fresh = aiCache && Date.now() - aiCache.at < AI_TTL_MS;

  if (!aiCache) {
    if (!aiInflight) aiInflight = refreshAi(s).finally(() => (aiInflight = null));
    await aiInflight;
  } else if (!fresh && !aiInflight) {
    aiInflight = refreshAi(s).finally(() => (aiInflight = null));
  }

  if (!aiCache) return;
  s.recommendation = aiCache.recommendation;
  s.aiSource = aiCache.source;
  if (aiCache.newsImpact && s.newsRisk.nextEvent && aiCache.newsKey === newsKeyOf(s)) {
    s.newsRisk.nextEvent.impactAnalysis = aiCache.newsImpact;
  }
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  let snapshot: MarketSnapshot;
  try {
    const res = await fetch(YAHOO_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 5 },
    });

    if (!res.ok) throw new Error(`Yahoo responded ${res.status}`);

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta: YahooMeta = result?.meta ?? {};
    const quote: YahooQuote | undefined = result?.indicators?.quote?.[0];

    if (!quote) throw new Error("Missing quote data");

    const highs = quote.high.filter((n): n is number => n != null);
    const lows = quote.low.filter((n): n is number => n != null);
    const closes = quote.close.filter((n): n is number => n != null);

    const price = meta.regularMarketPrice ?? lastValid(quote.close);
    const previousClose =
      closes[closes.length - 2] ?? meta.previousClose ?? meta.chartPreviousClose ?? price;
    const todayOpen = lastValid(quote.open) ?? price ?? 0;
    const todayHigh = meta.regularMarketDayHigh ?? lastValid(quote.high) ?? price ?? 0;
    const todayLow = meta.regularMarketDayLow ?? lastValid(quote.low) ?? price ?? 0;

    if (price == null) throw new Error("Missing price");

    const atr = computeATR(highs, lows, closes, 14);

    snapshot = buildSnapshot({
      price,
      previousClose: previousClose ?? price,
      open: todayOpen,
      high: todayHigh,
      low: todayLow,
      atr: atr || todayHigh - todayLow,
      isLive: true,
      source: "Yahoo Finance · COMEX GC=F",
    });
  } catch {
    snapshot = fallbackSnapshot();
  }

  await applyAi(snapshot);
  return snapshot;
}
