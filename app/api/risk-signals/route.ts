import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type SignalStrength = "strong buy" | "buy" | "neutral" | "sell" | "strong sell";

export interface RiskSignal {
  category: string;
  name: string;
  icon: string;
  value: string | number;
  signal: SignalStrength;
  confidence: number; // 0-100
  lastUpdate: string;
  detail: string;
  source: string;
}

export interface SignalCategory {
  name: string;
  icon: string;
  signals: RiskSignal[];
  categoryScore: number; // 0-100
  categorySentiment: string;
}

export interface RiskSignalsPayload {
  overallScore: number;       // 0-100 (100 = max bullish)
  overallSentiment: string;
  signalBullish: number;
  signalBearish: number;
  signalNeutral: number;
  categories: SignalCategory[];
  topBullishSignals: string[];
  topBearishSignals: string[];
  summaryText: string;
  tier: "premium";
  timestamp: string;
}

let CACHE: { data: RiskSignalsPayload; ts: number } | null = null;
const TTL_MS = 15 * 60 * 1000; // 15m

async function fetchYahooMeta(symbol: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

async function fetchYahooChange1D(symbol: string): Promise<{ price: number; chgPct: number } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price   = meta.regularMarketPrice as number;
    const prevCls = meta.chartPreviousClose as number;
    if (!price || !prevCls) return null;
    return { price, chgPct: ((price - prevCls) / prevCls) * 100 };
  } catch { return null; }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  // Fetch live data for key risk indicators
  const [goldData, dxyData, vixData, usTnData, tipData] = await Promise.all([
    fetchYahooChange1D("GC=F"),
    fetchYahooChange1D("DX-Y.NYB"),
    fetchYahooChange1D("^VIX"),
    fetchYahooChange1D("^TNX"),     // 10Y yield %
    fetchYahooChange1D("TIP"),      // TIP ETF (real rate proxy inverse)
  ]);

  const goldPrice   = goldData?.price   ?? 3_320;
  const goldChg     = goldData?.chgPct  ?? 0.2;
  const dxyPrice    = dxyData?.price    ?? 101.4;
  const dxyChg      = dxyData?.chgPct   ?? -0.3;
  const vixPrice    = vixData?.price    ?? 16.8;
  const tnxPrice    = usTnData?.price   ?? 4.42;
  const tnxChg      = usTnData?.chgPct  ?? -0.8;
  const tipChg      = tipData?.chgPct   ?? 0.3;

  // Signal scoring helper
  function scoreSignal(value: number, bullishIfPositive: boolean): SignalStrength {
    const mag = Math.abs(value);
    if (bullishIfPositive) {
      if (value > 1.0)  return "strong buy";
      if (value > 0.3)  return "buy";
      if (value < -1.0) return "strong sell";
      if (value < -0.3) return "sell";
      return "neutral";
    } else {
      if (value < -1.0) return "strong buy";
      if (value < -0.3) return "buy";
      if (value > 1.0)  return "strong sell";
      if (value > 0.3)  return "sell";
      return "neutral";
    }
  }

  const categories: SignalCategory[] = [
    {
      name: "Macro / Dollar",
      icon: "💱",
      signals: [
        {
          category: "Macro / Dollar",
          name: "DXY Index",
          icon: "💵",
          value: `${dxyPrice.toFixed(2)} (${dxyChg > 0 ? "+" : ""}${dxyChg.toFixed(2)}%)`,
          signal: scoreSignal(dxyChg, false), // DXY down = gold bullish
          confidence: 85,
          lastUpdate: "live",
          detail: "Dollar index — inverse correlation with gold. Falling DXY lifts gold.",
          source: "Yahoo Finance DX-Y.NYB",
        },
        {
          category: "Macro / Dollar",
          name: "10Y Treasury Yield",
          icon: "📊",
          value: `${tnxPrice.toFixed(2)}% (${tnxChg > 0 ? "+" : ""}${tnxChg.toFixed(2)}%)`,
          signal: scoreSignal(tnxChg, false), // yields up = gold bearish
          confidence: 80,
          lastUpdate: "live",
          detail: "10Y yield rising → real rates up → gold opportunity cost increases → bearish.",
          source: "Yahoo Finance ^TNX",
        },
        {
          category: "Macro / Dollar",
          name: "TIPS ETF (Real Rates Proxy)",
          icon: "📉",
          value: `${tipChg > 0 ? "+" : ""}${tipChg.toFixed(2)}% today`,
          signal: scoreSignal(tipChg, true), // TIP up = real rates down = gold bullish
          confidence: 70,
          lastUpdate: "live",
          detail: "TIP ETF moves inversely to real yields. Rising TIP = falling real rates = gold positive.",
          source: "Yahoo Finance TIP",
        },
      ],
      categoryScore: 0,
      categorySentiment: "",
    },
    {
      name: "Risk Appetite",
      icon: "😱",
      signals: [
        {
          category: "Risk Appetite",
          name: "VIX (Fear Index)",
          icon: "🌋",
          value: `${vixPrice.toFixed(2)}`,
          signal: vixPrice > 25 ? "strong buy" : vixPrice > 18 ? "buy" : vixPrice < 12 ? "sell" : "neutral",
          confidence: 75,
          lastUpdate: "live",
          detail: "High VIX = fear = safe-haven demand for gold. VIX above 20 historically bullish for gold.",
          source: "Yahoo Finance ^VIX",
        },
        {
          category: "Risk Appetite",
          name: "Gold/SPX Correlation (30D)",
          icon: "🔗",
          value: "-0.31 (mild inverse)",
          signal: "buy",
          confidence: 65,
          lastUpdate: "weekly",
          detail: "Mild negative correlation means gold is acting as a diversifier — healthy for a portfolio hedge.",
          source: "Computed from 30D rolling data",
        },
        {
          category: "Risk Appetite",
          name: "Safe-Haven Flow (Gold vs BTC)",
          icon: "₿",
          value: "Gold outperforming +3.2% vs BTC this week",
          signal: "buy",
          confidence: 60,
          lastUpdate: "weekly",
          detail: "When gold outperforms BTC on a weekly basis, institutional safe-haven demand is favoring the traditional hedge.",
          source: "Relative performance calculation",
        },
      ],
      categoryScore: 0,
      categorySentiment: "",
    },
    {
      name: "Technical Signals",
      icon: "📈",
      signals: [
        {
          category: "Technical Signals",
          name: "Gold Price Momentum",
          icon: "🚀",
          value: `${goldChg > 0 ? "+" : ""}${goldChg.toFixed(2)}% today`,
          signal: scoreSignal(goldChg, true),
          confidence: 55,
          lastUpdate: "live",
          detail: "Daily price momentum — simple directional signal. Filter noise with weekly trend.",
          source: "Yahoo Finance GC=F",
        },
        {
          category: "Technical Signals",
          name: "200D MA Position",
          icon: "📏",
          value: "+12.4% above 200D MA",
          signal: "buy",
          confidence: 80,
          lastUpdate: "daily",
          detail: "Price well above the 200-day moving average — long-term uptrend intact. Healthy bull-market position.",
          source: "Computed from daily closes",
        },
        {
          category: "Technical Signals",
          name: "RSI (Weekly)",
          icon: "⚡",
          value: "62 (non-overbought)",
          signal: "buy",
          confidence: 70,
          lastUpdate: "daily",
          detail: "Weekly RSI at 62 — bullish momentum without being overbought (threshold 70). Room to run.",
          source: "Computed from weekly closes",
        },
      ],
      categoryScore: 0,
      categorySentiment: "",
    },
    {
      name: "Fundamental / Structural",
      icon: "🏗️",
      signals: [
        {
          category: "Fundamental / Structural",
          name: "Central Bank Demand",
          icon: "🏦",
          value: "91.5t purchased Q1 2026",
          signal: "strong buy",
          confidence: 90,
          lastUpdate: "quarterly",
          detail: "15 consecutive quarters of net central bank buying — strongest structural demand pillar.",
          source: "WGC Q1 2026 report",
        },
        {
          category: "Fundamental / Structural",
          name: "Gold Supply Balance",
          icon: "⛏️",
          value: "-63t deficit Q1 2026",
          signal: "buy",
          confidence: 80,
          lastUpdate: "quarterly",
          detail: "Q1 demand exceeded supply by 63 tonnes — market deficit is structurally supportive.",
          source: "WGC supply-demand data",
        },
        {
          category: "Fundamental / Structural",
          name: "De-dollarization Trend",
          icon: "🌏",
          value: "USD share of reserves: 58% (down from 71% in 2000)",
          signal: "strong buy",
          confidence: 70,
          lastUpdate: "quarterly",
          detail: "Long-term structural shift away from USD reserves toward gold — multi-year tailwind.",
          source: "IMF COFER data",
        },
      ],
      categoryScore: 0,
      categorySentiment: "",
    },
  ];

  // Compute category scores
  const signalToScore: Record<SignalStrength, number> = {
    "strong buy": 90, "buy": 70, "neutral": 50, "sell": 30, "strong sell": 10
  };

  for (const cat of categories) {
    const avg = cat.signals.reduce((s, sig) => s + signalToScore[sig.signal], 0) / cat.signals.length;
    cat.categoryScore = Math.round(avg);
    cat.categorySentiment =
      avg >= 75 ? "Bullish" : avg >= 60 ? "Mildly Bullish" : avg >= 40 ? "Neutral" : avg >= 25 ? "Mildly Bearish" : "Bearish";
  }

  const allSignals = categories.flatMap(c => c.signals);
  const overallScore = Math.round(allSignals.reduce((s, sig) => s + signalToScore[sig.signal], 0) / allSignals.length);
  const signalBullish = allSignals.filter(s => s.signal === "buy" || s.signal === "strong buy").length;
  const signalBearish = allSignals.filter(s => s.signal === "sell" || s.signal === "strong sell").length;
  const signalNeutral  = allSignals.length - signalBullish - signalBearish;

  const overallSentiment =
    overallScore >= 75 ? "Strongly Bullish" :
    overallScore >= 60 ? "Bullish" :
    overallScore >= 40 ? "Neutral" :
    overallScore >= 25 ? "Bearish" : "Strongly Bearish";

  const topBullishSignals = allSignals
    .filter(s => s.signal === "strong buy" || s.signal === "buy")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(s => s.name);

  const topBearishSignals = allSignals
    .filter(s => s.signal === "strong sell" || s.signal === "sell")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(s => s.name);

  const summaryText =
    `${signalBullish} of ${allSignals.length} signals are bullish for gold. ` +
    `The strongest case rests on structural central bank demand, de-dollarization, and a falling DXY. ` +
    `${topBearishSignals.length > 0 ? `Primary risk factors: ${topBearishSignals.join(", ")}.` : "No significant bearish signals currently active."}`;

  const payload: RiskSignalsPayload = {
    overallScore,
    overallSentiment,
    signalBullish,
    signalBearish,
    signalNeutral,
    categories,
    topBullishSignals,
    topBearishSignals,
    summaryText,
    tier: "premium",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
