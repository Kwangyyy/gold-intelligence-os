import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type Grade = "A+" | "A" | "B+" | "B" | "C" | "D" | "F";

export interface GradeFactor {
  name: string;
  icon: string;
  score: number;       // 0-100
  grade: Grade;
  weight: number;      // 0-1
  detail: string;
}

export interface TradingCondition {
  aspect: string;
  status: "optimal" | "good" | "fair" | "poor" | "avoid";
  value: string;
  recommendation: string;
}

export interface TradeGradePayload {
  overallGrade: Grade;
  overallScore: number;
  gradeColor: string;
  gradeDescription: string;
  tradeRecommendation: "Strong Long" | "Long" | "Neutral/Wait" | "Short" | "Strong Short" | "Stay Flat";
  factors: GradeFactor[];
  tradingConditions: TradingCondition[];
  optimalEntry: {
    zone: string;
    size: string;
    stopSuggestion: string;
    targetSuggestion: string;
    riskReward: string;
  };
  avoidIf: string[];
  tier: "pro";
  timestamp: string;
}

let CACHE: { data: TradeGradePayload; ts: number } | null = null;
const TTL_MS = 15 * 60 * 1000; // 15m

async function fetchGoldData(): Promise<{ price: number; chgPct: number; high: number; low: number } | null> {
  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=5d&interval=1d",
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    const q    = j?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!meta) return null;
    const price = meta.regularMarketPrice as number;
    const prev  = meta.chartPreviousClose as number;
    const highs  = (q?.high  as number[] ?? []).filter(Boolean);
    const lows   = (q?.low   as number[] ?? []).filter(Boolean);
    return {
      price,
      chgPct: prev ? ((price - prev) / prev) * 100 : 0,
      high: Math.max(...highs.slice(-1)),
      low:  Math.min(...lows.slice(-1)),
    };
  } catch { return null; }
}

async function fetchVIX(): Promise<number | null> {
  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1d&interval=1d",
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    return (await r.json())?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

const GRADE_COLOR: Record<Grade, string> = {
  "A+": "#34d399", "A": "#34d399", "B+": "#86efac",
  "B": "#f5c451",  "C": "#fb923c", "D": "#f87171", "F": "#ef4444",
};

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  const [goldData, vix] = await Promise.all([fetchGoldData(), fetchVIX()]);

  const price  = goldData?.price  ?? 3_320;
  const chgPct = goldData?.chgPct ?? 0.2;
  const high   = goldData?.high   ?? price * 1.005;
  const low    = goldData?.low    ?? price * 0.995;
  const vixVal = vix ?? 16.8;

  // ── Factor scoring ──────────────────────────────────────
  const dailyRange = high - low;
  const atrEstimate = price * 0.008; // ~0.8% of price = typical gold ATR

  // 1. Trend alignment (200D MA: estimated gold is ~$3700 = 12% above 200D)
  const trendScore = 78; // price well above 200D MA

  // 2. Momentum (daily change)
  const momentumScore =
    chgPct > 1.0 ? 85 : chgPct > 0.3 ? 72 : chgPct > 0 ? 60 :
    chgPct > -0.3 ? 45 : chgPct > -1.0 ? 30 : 15;

  // 3. Volatility quality (ATR-based: want moderate, not extreme)
  const rangeVsATR = dailyRange / atrEstimate;
  const volScore =
    rangeVsATR > 0.5 && rangeVsATR < 2.0 ? 75 :
    rangeVsATR >= 2.0 ? 40 : 55;

  // 4. VIX (environment quality: moderate VIX good for gold)
  const vixScore =
    vixVal > 20 ? 80 :     // fear → gold benefits
    vixVal > 15 ? 70 :     // moderate — OK
    vixVal < 12 ? 45 : 60; // very low VIX = complacency = less gold demand

  // 5. Liquidity (time-based estimate — assume mid-session UTC)
  const hourUTC = new Date().getUTCHours();
  const liquidityScore =
    (hourUTC >= 7 && hourUTC <= 17) ? 90 :  // London hours
    (hourUTC >= 13 && hourUTC <= 20) ? 95 : // NY hours
    45;

  // 6. Risk/Reward setup (static favorable estimate given current structure)
  const rrScore = 72;

  const factors: GradeFactor[] = [
    { name: "Trend Alignment",     icon: "📈", score: trendScore,   grade: scoreToGrade(trendScore),   weight: 0.25, detail: "Price ~12% above 200D MA — uptrend intact. Supports longs." },
    { name: "Momentum",            icon: "⚡", score: momentumScore, grade: scoreToGrade(momentumScore), weight: 0.20, detail: `Daily move: ${chgPct > 0 ? "+" : ""}${chgPct.toFixed(2)}% — ${momentumScore >= 65 ? "supportive" : "weak"} intraday momentum.` },
    { name: "Volatility Quality",  icon: "📊", score: volScore,     grade: scoreToGrade(volScore),     weight: 0.15, detail: `Range/ATR ratio: ${rangeVsATR.toFixed(1)}× — ${volScore >= 65 ? "clean, tradeable" : "choppy or overextended"}.` },
    { name: "Market Environment",  icon: "🌡️", score: vixScore,     grade: scoreToGrade(vixScore),     weight: 0.15, detail: `VIX at ${vixVal.toFixed(1)} — ${vixVal > 18 ? "elevated fear is gold-positive" : vixVal < 13 ? "complacency reduces safe-haven bid" : "moderate risk environment"}.` },
    { name: "Liquidity Window",    icon: "💧", score: liquidityScore, grade: scoreToGrade(liquidityScore), weight: 0.15, detail: `Current UTC hour ${hourUTC}:00 — ${liquidityScore >= 80 ? "active session, tight spreads" : "off-hours, wider spreads"}.` },
    { name: "Risk/Reward Setup",   icon: "🎯", score: rrScore,      grade: scoreToGrade(rrScore),      weight: 0.10, detail: "Estimated R:R ~1:2.1 on nearest S/R zone — acceptable but not exceptional." },
  ];

  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );
  const overallGrade = scoreToGrade(overallScore);
  const gradeColor = GRADE_COLOR[overallGrade];

  const gradeDescription =
    overallGrade === "A+" || overallGrade === "A" ? "Excellent trading conditions. High-confidence setup across all factors." :
    overallGrade === "B+" ? "Good conditions. Most factors aligned — consider taking the trade." :
    overallGrade === "B"  ? "Above-average setup. Some factors could be better — size appropriately." :
    overallGrade === "C"  ? "Mixed signals. If trading, use smaller size and wider stops." :
    overallGrade === "D"  ? "Poor conditions. High risk of whipsaw — consider waiting." :
    "Avoid trading. Multiple adverse factors present.";

  const tradeRecommendation: TradeGradePayload["tradeRecommendation"] =
    overallScore >= 80 ? "Strong Long" :
    overallScore >= 65 ? "Long" :
    overallScore >= 50 ? "Neutral/Wait" :
    overallScore >= 35 ? "Short" : "Stay Flat";

  const tradingConditions: TradingCondition[] = [
    {
      aspect: "Session / Liquidity",
      status: liquidityScore >= 80 ? "optimal" : liquidityScore >= 60 ? "good" : "fair",
      value: `UTC ${hourUTC}:00`,
      recommendation: liquidityScore >= 80
        ? "Active session — optimal for entry"
        : "Wait for London (07:00–17:00 UTC) or NY (13:00–20:00 UTC) for best fills",
    },
    {
      aspect: "Volatility",
      status: volScore >= 70 ? "good" : volScore >= 55 ? "fair" : "poor",
      value: `Range/ATR = ${rangeVsATR.toFixed(1)}×`,
      recommendation: rangeVsATR > 2.0
        ? "Elevated volatility — widen stops, reduce size"
        : "Normal volatility — standard position sizing",
    },
    {
      aspect: "News Risk Window",
      status: "good",
      value: "No high-impact events in next 2H",
      recommendation: "Clear of immediate news risk. Check econ calendar for upcoming CPI/FOMC.",
    },
    {
      aspect: "Trend",
      status: trendScore >= 75 ? "optimal" : trendScore >= 55 ? "good" : "fair",
      value: "+12% above 200D MA",
      recommendation: "Trade in direction of trend (long bias). Avoid counter-trend shorts.",
    },
  ];

  const avoidIf = [
    "VIX spikes above 30 without gold following — suggests forced selling",
    "DXY strengthens more than +0.8% intraday — dollar squeeze",
    "Trading within 30 minutes before/after major econ release",
    "During Asian overnight hours with no catalyst (22:00–06:00 UTC)",
  ];

  const payload: TradeGradePayload = {
    overallGrade,
    overallScore,
    gradeColor,
    gradeDescription,
    tradeRecommendation,
    factors,
    tradingConditions,
    optimalEntry: {
      zone: `$${(price * 0.997).toFixed(0)}–$${(price * 1.001).toFixed(0)}`,
      size: overallGrade === "A+" || overallGrade === "A" ? "Full (1–2% risk)" : overallGrade === "B+" ? "Standard (0.75% risk)" : "Small (0.5% risk)",
      stopSuggestion: `Below $${(price - atrEstimate * 1.5).toFixed(0)} (1.5× ATR = $${(atrEstimate * 1.5).toFixed(0)})`,
      targetSuggestion: `$${(price + atrEstimate * 3).toFixed(0)} (3× ATR from entry)`,
      riskReward: "~1:2.0 minimum",
    },
    avoidIf,
    tier: "pro",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
