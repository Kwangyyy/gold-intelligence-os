import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CyclePhase =
  | "early_bull"       // Gold bottomed, trend recovering
  | "mid_bull"         // Gold in sustained uptrend, momentum strong
  | "late_bull"        // Gold overbought, breadth weakening
  | "distribution"     // Topping signs, vol expanding
  | "early_bear"       // Gold trend broken, selling pressure
  | "mid_bear"         // Gold in downtrend, momentum weak
  | "late_bear"        // Gold oversold, bottoming signals
  | "accumulation";    // Smart money accumulating, near bottom

export interface CycleIndicator {
  name: string;
  value: number | string;
  signal: string;
  contribution: string; // which phase this points to
  bullish: boolean;
}

export interface GoldCyclePayload {
  goldPrice: number;
  goldChange6M: number;
  goldChange1Y: number;
  phase: CyclePhase;
  phaseLabel: string;
  phaseDescription: string;
  phaseColor: string;
  phaseAngle: number;       // 0-360 for clock dial (0=top, clockwise)
  cycleProgress: number;    // 0-100 within current phase
  indicators: CycleIndicator[];
  drawdown: number;         // % off all-time high (approx)
  rsi14: number;
  rsi28: number;
  momentum6M: number;
  dxyTrend: string;
  fedCycle: string;
  nextPhase: CyclePhase;
  nextPhaseLabel: string;
  watchFor: string[];
  timestamp: string;
}

let CACHE: { data: GoldCyclePayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30min

async function fetchCloses(symbol: string, range: string): Promise<{ price: number; closes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const price: number = r.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    return { price, closes };
  } catch { return null; }
}

function rsi(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}

function ema(arr: number[], period: number): number {
  if (arr.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = arr[0];
  for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}

function pctChange(a: number, b: number) { return b > 0 ? ((a - b) / b) * 100 : 0; }

const PHASE_META: Record<CyclePhase, { label: string; color: string; angle: number; desc: string }> = {
  accumulation:  { label: "Accumulation",   color: "#60a5fa", angle: 315, desc: "Smart money quietly buying near cycle lows. Low volatility, lackluster price action, negative sentiment dominates." },
  early_bull:    { label: "Early Bull",     color: "#34d399", angle: 45,  desc: "Trend reversal confirmed. Price breaking above key moving averages. Volume picking up. Early adopters entering." },
  mid_bull:      { label: "Mid Bull",       color: "#4ade80", angle: 90,  desc: "Strongest part of the cycle. Momentum high, trend clear, institutions adding positions. Best risk/reward for longs." },
  late_bull:     { label: "Late Bull",      color: "#fbbf24", angle: 135, desc: "Parabolic move potential. Retail FOMO driving prices. RSI extended, volatility rising. Caution warranted." },
  distribution:  { label: "Distribution",  color: "#f97316", angle: 180, desc: "Large players selling into strength. Price action choppy. Volume divergences appearing. Caution for longs." },
  early_bear:    { label: "Early Bear",     color: "#fb923c", angle: 225, desc: "Trend broken. Lower highs forming. Momentum negative. Defensive positioning recommended." },
  mid_bear:      { label: "Mid Bear",       color: "#f87171", angle: 270, desc: "Sustained downtrend. Capitulation waves. Weak hands leaving. Avoid catching falling knife." },
  late_bear:     { label: "Late Bear",      color: "#a78bfa", angle: 280, desc: "Exhaustion signs appearing. RSI reaching oversold. Volume drying up. Bottoming process beginning." },
};

function determinePhase(
  price: number, closes12M: number[], closes6M: number[], rsi14: number, rsi28: number,
  momentum6M: number, drawdown: number, dxyFalling: boolean
): { phase: CyclePhase; progress: number } {
  // Key indicators
  const ema50 = ema(closes12M.slice(-50), 50);
  const ema100 = ema(closes12M.slice(-100), 100);
  const ema200 = ema(closes12M, 200);
  const above50 = price > ema50;
  const above100 = price > ema100;
  const above200 = price > ema200;
  const aboveCount = [above50, above100, above200].filter(Boolean).length;

  const momentum3M = closes6M.length >= 63 ? pctChange(price, closes6M[closes6M.length - 63] ?? closes6M[0]) : momentum6M / 2;

  // Phase detection logic
  if (rsi14 >= 70 && momentum6M > 20) {
    return { phase: "late_bull", progress: Math.min(90, (rsi14 - 70) * 3 + (momentum6M - 20) * 1) };
  }
  if (rsi14 >= 55 && aboveCount >= 2 && momentum6M > 5) {
    return { phase: "mid_bull", progress: Math.min(90, (rsi14 - 55) * 3 + momentum3M * 0.5) };
  }
  if (rsi14 >= 50 && aboveCount >= 1 && momentum6M > 0) {
    return { phase: "early_bull", progress: Math.min(90, (rsi14 - 50) * 2 + momentum6M * 0.8) };
  }
  if (drawdown < -5 && rsi14 > 45 && aboveCount >= 1 && momentum6M < 3) {
    return { phase: "distribution", progress: Math.min(90, Math.abs(drawdown) * 3 + (50 - rsi14) * 1) };
  }
  if (rsi14 < 35 && aboveCount === 0 && momentum6M < -15) {
    return { phase: "mid_bear", progress: Math.min(90, (35 - rsi14) * 3 + Math.abs(momentum6M) * 0.5) };
  }
  if (rsi14 < 30 && momentum6M < -20 && drawdown < -20) {
    return { phase: "late_bear", progress: Math.min(90, (30 - rsi14) * 3) };
  }
  if (rsi14 >= 30 && rsi14 < 45 && aboveCount === 0 && dxyFalling) {
    return { phase: "accumulation", progress: Math.min(90, (rsi14 - 30) * 4) };
  }
  if (aboveCount <= 1 && momentum6M < 0) {
    return { phase: "early_bear", progress: Math.min(90, Math.abs(momentum6M) * 2 + (50 - rsi14) * 1) };
  }
  // Default
  if (above200) {
    return { phase: momentum6M > 0 ? "mid_bull" : "distribution", progress: 50 };
  }
  return { phase: "accumulation", progress: 50 };
}

const NEXT_PHASE: Record<CyclePhase, CyclePhase> = {
  accumulation: "early_bull",
  early_bull:   "mid_bull",
  mid_bull:     "late_bull",
  late_bull:    "distribution",
  distribution: "early_bear",
  early_bear:   "mid_bear",
  mid_bear:     "late_bear",
  late_bear:    "accumulation",
};

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [gold12M, gold6M, dxy6M] = await Promise.all([
      fetchCloses("GC=F",     "2y"),
      fetchCloses("GC=F",     "6mo"),
      fetchCloses("DX-Y.NYB", "6mo"),
    ]);

    const goldPrice = gold12M?.price ?? 3350;
    const closes12M = gold12M?.closes ?? [goldPrice];
    const closes6M  = gold6M?.closes ?? [goldPrice];

    // Momentum
    const momentum6M = closes6M.length > 1 ? pctChange(goldPrice, closes6M[0]) : 0;
    const momentum1Y = closes12M.length > 1 ? pctChange(goldPrice, closes12M[0]) : 0;

    // RSI
    const rsi14 = rsi(closes12M, 14);
    const rsi28 = rsi(closes12M, 28);

    // Drawdown from 52W high
    const high52W = Math.max(...closes12M);
    const drawdown = high52W > 0 ? ((goldPrice - high52W) / high52W) * 100 : 0;

    // DXY trend (falling = bullish for gold)
    const dxyCloses = dxy6M?.closes ?? [];
    const dxyEma50 = ema(dxyCloses.slice(-50), 50);
    const dxyFalling = dxy6M ? dxy6M.price < dxyEma50 : false;
    const dxyTrend = dxyFalling ? "Falling (bullish for gold)" : "Rising (headwind for gold)";

    // Fed cycle heuristic from TLT
    // We'll infer from bond direction as a proxy
    const fedCycle = momentum6M > 15
      ? "Rate cut environment likely priced in — gold benefiting"
      : momentum6M > 5
      ? "Neutral Fed expectations — gold holding gains"
      : momentum6M > -5
      ? "Rate uncertainty — mixed gold signals"
      : "Rate hike fears or resilient economy — gold headwind";

    const { phase, progress } = determinePhase(goldPrice, closes12M, closes6M, rsi14, rsi28, momentum6M, drawdown, dxyFalling);
    const meta = PHASE_META[phase];
    const nextPhase = NEXT_PHASE[phase];

    const indicators: CycleIndicator[] = [
      {
        name: "RSI (14)", value: rsi14.toFixed(1), signal: rsi14 >= 70 ? "Overbought" : rsi14 <= 30 ? "Oversold" : "Neutral",
        contribution: rsi14 >= 70 ? "late_bull / distribution" : rsi14 <= 35 ? "late_bear / accumulation" : "mid phase",
        bullish: rsi14 >= 45 && rsi14 < 70,
      },
      {
        name: "RSI (28)", value: rsi28.toFixed(1), signal: rsi28 >= 65 ? "Elevated" : rsi28 <= 35 ? "Depressed" : "Normal",
        contribution: rsi28 >= 60 ? "bull phase" : rsi28 <= 40 ? "bear phase" : "transition",
        bullish: rsi28 >= 50 && rsi28 < 65,
      },
      {
        name: "6M Momentum", value: `${momentum6M >= 0 ? "+" : ""}${momentum6M.toFixed(1)}%`,
        signal: momentum6M > 15 ? "Strong bull" : momentum6M > 0 ? "Positive" : momentum6M > -15 ? "Negative" : "Strong bear",
        contribution: momentum6M > 10 ? "mid/late bull" : momentum6M > 0 ? "early/mid bull" : "bear phases",
        bullish: momentum6M > 0,
      },
      {
        name: "1Y Momentum", value: `${momentum1Y >= 0 ? "+" : ""}${momentum1Y.toFixed(1)}%`,
        signal: momentum1Y > 20 ? "Bull year" : momentum1Y > 0 ? "Positive year" : "Bear year",
        contribution: momentum1Y > 15 ? "bull cycle" : momentum1Y < -10 ? "bear cycle" : "transition",
        bullish: momentum1Y > 0,
      },
      {
        name: "52W Drawdown", value: `${drawdown.toFixed(1)}%`,
        signal: drawdown > -5 ? "Near highs" : drawdown > -15 ? "Moderate pullback" : drawdown > -25 ? "Significant pullback" : "Deep drawdown",
        contribution: drawdown > -8 ? "bull / distribution" : drawdown < -25 ? "late bear / accumulation" : "mid bear",
        bullish: drawdown > -10,
      },
      {
        name: "DXY Direction", value: dxyTrend,
        signal: dxyFalling ? "Bullish signal" : "Bearish signal",
        contribution: dxyFalling ? "bull phases" : "bear phases",
        bullish: dxyFalling,
      },
    ];

    const watchFor: string[] = {
      accumulation:  ["RSI breakout above 45", "Price reclaiming 50D EMA", "DXY reversal lower", "Volume surge on up days"],
      early_bull:    ["Momentum confirming above 50D & 100D EMA", "RSI holding above 50", "DXY continuing to weaken", "Breakout above prior resistance"],
      mid_bull:      ["RSI approaching 70 — watch for overextension", "Pullbacks to 20D EMA as buying opportunities", "Volume confirming uptrend", "Dollar index trend"],
      late_bull:     ["RSI divergence (price higher, RSI lower)", "Volume diminishing on new highs", "Sentiment surveys at extremes", "Distribution candles on weekly chart"],
      distribution:  ["Break below 20D EMA confirmed", "RSI failing to hold 50", "Increase in down-volume days", "DXY reversal higher"],
      early_bear:    ["100D EMA as key resistance", "RSI remaining below 50", "Lower highs forming", "Any reversal catalysts (Fed pivot, crisis)"],
      mid_bear:      ["Volume climax / capitulation spike", "RSI reaching 30-35 level", "Key long-term support levels", "Fed dovish pivot signal"],
      late_bear:     ["RSI reaching 25-30 exhaustion", "Price finding support at major levels", "Sentiment at extreme bearish readings", "Accumulation signals on volume"],
    }[phase] ?? ["Monitor price action relative to key moving averages"];

    const payload: GoldCyclePayload = {
      goldPrice, goldChange6M: Math.round(momentum6M * 10) / 10, goldChange1Y: Math.round(momentum1Y * 10) / 10,
      phase, phaseLabel: meta.label, phaseDescription: meta.desc, phaseColor: meta.color,
      phaseAngle: meta.angle, cycleProgress: progress,
      indicators, drawdown: Math.round(drawdown * 10) / 10,
      rsi14: Math.round(rsi14 * 10) / 10, rsi28: Math.round(rsi28 * 10) / 10,
      momentum6M: Math.round(momentum6M * 10) / 10, dxyTrend, fedCycle,
      nextPhase, nextPhaseLabel: PHASE_META[nextPhase].label, watchFor,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("gold-cycle-clock error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
