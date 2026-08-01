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
import { getNewsRiskLive } from "./newsRisk";
import { getGoldCandles, getGoldSpot, lastKnownGoldPrice } from "./goldSource";
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
  // Anchor on whatever price this process last really saw. The hardcoded sample
  // that used to live here goes stale the moment gold moves, and `isLive: false`
  // is easy to miss on a page that otherwise looks normal.
  const last = lastKnownGoldPrice();
  const price = last > 0 ? last : 0;
  return buildSnapshot({
    price,
    previousClose: price,
    open: price,
    high: price,
    low: price,
    atr: 0,
    isLive: false,
    source: last > 0
      ? "fallback — last known price, feed unavailable"
      : "fallback — no price available",
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
    // Same spot-equivalent, real-time feed the charts use. This used to read
    // Yahoo's COMEX future, which is ten minutes late and carries a basis of
    // roughly $60 over spot — so every page built on this snapshot quoted a
    // different gold price from the chart, and trade levels were struck against
    // a number the user could not actually trade at.
    const [candles, spot] = await Promise.all([getGoldCandles("1d", 40), getGoldSpot()]);
    const n = candles.c.length;
    if (!n) throw new Error("No candles");

    const price = spot.price > 0 ? spot.price : candles.c[n - 1];
    const previousClose = candles.c[n - 2] ?? price;
    const todayOpen = candles.o[n - 1] ?? price;
    // The live tick can already be beyond the bar's stored extremes.
    const todayHigh = Math.max(candles.h[n - 1] ?? price, price);
    const todayLow = Math.min(candles.l[n - 1] ?? price, price);

    const atr = computeATR(candles.h, candles.l, candles.c, 14);

    snapshot = buildSnapshot({
      price,
      previousClose,
      open: todayOpen,
      high: todayHigh,
      low: todayLow,
      atr: atr || todayHigh - todayLow,
      isLive: true,
      source:
        spot.source === "paxg" ? "PAXG spot-equivalent · real-time"
        : spot.source === "cache" ? `last known price · feeds unavailable (${spot.delaySec}s old)`
        : "Yahoo Finance · COMEX GC=F",
    });
  } catch {
    snapshot = fallbackSnapshot();
  }

  // Replace the mock news risk with the live economic calendar (falls back to
  // the mock if the feed is unavailable).
  snapshot.newsRisk = await getNewsRiskLive(snapshot.newsRisk);

  await applyAi(snapshot);
  return snapshot;
}
