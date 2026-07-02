import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface MomentumFactor {
  name: string;
  value: number;
  signal: "strong_bull" | "bull" | "neutral" | "bear" | "strong_bear";
  color: string;
  score: number;    // 0-100 normalized
  description: string;
  weight: number;
}

export interface TimeframeScore {
  label: string;
  period: string;
  score: number;
  signal: "strong_bull" | "bull" | "neutral" | "bear" | "strong_bear";
  color: string;
  description: string;
}

export interface MomentumCompositePayload {
  currentPrice: number;
  compositeScore: number;   // 0-100
  compositeSignal: "strong_bull" | "bull" | "neutral" | "bear" | "strong_bear";
  compositeColor: string;
  compositeLabel: string;
  compositeDescription: string;
  factors: MomentumFactor[];
  timeframes: TimeframeScore[];
  acceleration: number;   // 30D momentum minus 60D momentum — is it speeding up or slowing?
  accelerationSignal: "accelerating" | "stable" | "decelerating";
  accelerationColor: string;
  overboughtOversold: "overbought" | "neutral" | "oversold";
  overboughtColor: string;
  overboughtDesc: string;
  tradingBias: string;
  timestamp: string;
}

let CACHE: { data: MomentumCompositePayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

async function fetchGoldHistory(): Promise<{ price: number; closes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1y&interval=1d`;
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

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const gains: number[] = [], losses: number[] = [];
  for (let i = closes.length - period - 1; i < closes.length - 1; i++) {
    const diff = closes[i + 1] - closes[i];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  const avgGain = gains.reduce((a, b) => a + b) / period;
  const avgLoss = losses.reduce((a, b) => a + b) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macd = ema12 - ema26;
  // Signal line = 9-period EMA of MACD values
  const macdValues: number[] = [];
  for (let i = 26; i <= closes.length; i++) {
    const m12 = computeEMA(closes.slice(0, i), 12);
    const m26 = computeEMA(closes.slice(0, i), 26);
    macdValues.push(m12 - m26);
  }
  const signalLine = computeEMA(macdValues, 9);
  return { macd, signal: signalLine, histogram: macd - signalLine };
}

function pctChange(closes: number[], n: number): number {
  if (closes.length < n + 1) return 0;
  const cur = closes[closes.length - 1];
  const past = closes[closes.length - 1 - n];
  return past > 0 ? ((cur - past) / past) * 100 : 0;
}

function toSignal(score: number): MomentumFactor["signal"] {
  if (score >= 70) return "strong_bull";
  if (score >= 55) return "bull";
  if (score >= 45) return "neutral";
  if (score >= 30) return "bear";
  return "strong_bear";
}

function sigColor(sig: MomentumFactor["signal"]): string {
  const c = {
    strong_bull: "#34d399", bull: "#86efac", neutral: "#f5c451", bear: "#fb923c", strong_bear: "#f87171",
  };
  return c[sig];
}

function sigLabel(sig: MomentumFactor["signal"]): string {
  const l = {
    strong_bull: "Strong Bull", bull: "Bullish", neutral: "Neutral", bear: "Bearish", strong_bear: "Strong Bear",
  };
  return l[sig];
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const goldData = await fetchGoldHistory();
    const closes = goldData?.closes ?? [];
    const currentPrice = goldData?.price ?? 3350;

    if (closes.length < 50) {
      return NextResponse.json({ error: "Insufficient data" }, { status: 500 });
    }

    // RSI14 and RSI28
    const rsi14 = computeRSI(closes, 14);
    const rsi28 = computeRSI(closes, 28);

    // RSI score: 0-100, overbought (>70) = lower score (pullback risk), oversold (<30) = higher score (recovery)
    const rsi14Score = clamp(rsi14, 0, 100);  // Direct: high RSI = bullish momentum (not mean-reversion)
    const rsi28Score = clamp(rsi28, 0, 100);

    // MACD
    const macdData = computeMACD(closes);
    // MACD histogram > 0 = bullish, < 0 = bearish; normalize by price
    const macdNorm = macdData.histogram / currentPrice * 100;
    const macdScore = clamp(50 + macdNorm * 20, 0, 100);

    // Rate of Change
    const roc10 = pctChange(closes, 10);
    const roc20 = pctChange(closes, 20);
    const roc60 = pctChange(closes, 60);
    const roc10Score = clamp(50 + roc10 * 5, 0, 100);
    const roc20Score = clamp(50 + roc20 * 3, 0, 100);
    const roc60Score = clamp(50 + roc60 * 1.5, 0, 100);

    // EMA alignment score
    const ema20 = computeEMA(closes, 20);
    const ema50 = computeEMA(closes, 50);
    const ema100 = computeEMA(closes, 100);
    const ema200 = computeEMA(closes, 200);
    let emaScore = 50;
    if (currentPrice > ema20) emaScore += 10;
    if (currentPrice > ema50) emaScore += 10;
    if (currentPrice > ema100) emaScore += 10;
    if (currentPrice > ema200) emaScore += 10;
    if (ema20 > ema50) emaScore += 5;
    if (ema50 > ema100) emaScore += 5;
    emaScore = clamp(emaScore, 0, 100);

    // 52-week position score (where is price in year range?)
    const high52 = Math.max(...closes.slice(-252));
    const low52 = Math.min(...closes.slice(-252));
    const rangePct52 = high52 > low52 ? (currentPrice - low52) / (high52 - low52) * 100 : 50;
    const rangeScore = clamp(rangePct52, 0, 100);

    // Factors
    const factors: MomentumFactor[] = [
      {
        name: "RSI(14) — Short-Term Momentum",
        value: rsi14,
        signal: toSignal(rsi14Score),
        color: sigColor(toSignal(rsi14Score)),
        score: Math.round(rsi14Score),
        description: rsi14 > 70 ? `RSI ${rsi14.toFixed(1)} — overbought territory, momentum may fade short-term`
          : rsi14 < 30 ? `RSI ${rsi14.toFixed(1)} — oversold, mean-reversion bounce likely`
          : `RSI ${rsi14.toFixed(1)} — healthy momentum range, trend intact`,
        weight: 20,
      },
      {
        name: "RSI(28) — Medium-Term Momentum",
        value: rsi28,
        signal: toSignal(rsi28Score),
        color: sigColor(toSignal(rsi28Score)),
        score: Math.round(rsi28Score),
        description: rsi28 > 65 ? `RSI(28) ${rsi28.toFixed(1)} — strong medium-term momentum`
          : rsi28 < 40 ? `RSI(28) ${rsi28.toFixed(1)} — medium-term momentum weakening`
          : `RSI(28) ${rsi28.toFixed(1)} — balanced medium-term trend`,
        weight: 15,
      },
      {
        name: "MACD Histogram",
        value: macdData.histogram,
        signal: toSignal(macdScore),
        color: sigColor(toSignal(macdScore)),
        score: Math.round(macdScore),
        description: `MACD ${macdData.macd.toFixed(1)}, Signal ${macdData.signal.toFixed(1)}, Hist ${macdData.histogram >= 0 ? "+" : ""}${macdData.histogram.toFixed(1)} — ${macdData.histogram > 0 ? "bullish momentum" : "bearish momentum"}`,
        weight: 20,
      },
      {
        name: "EMA Alignment (20/50/100/200)",
        value: emaScore,
        signal: toSignal(emaScore),
        color: sigColor(toSignal(emaScore)),
        score: Math.round(emaScore),
        description: `Price above EMA20: ${currentPrice > ema20 ? "✓" : "✗"} | EMA50: ${currentPrice > ema50 ? "✓" : "✗"} | EMA100: ${currentPrice > ema100 ? "✓" : "✗"} | EMA200: ${currentPrice > ema200 ? "✓" : "✗"}`,
        weight: 20,
      },
      {
        name: "Rate of Change — 10D",
        value: roc10,
        signal: toSignal(roc10Score),
        color: sigColor(toSignal(roc10Score)),
        score: Math.round(roc10Score),
        description: `+${roc10 >= 0 ? "" : ""}${roc10.toFixed(2)}% over 10 trading days — ${Math.abs(roc10) > 3 ? "strong" : Math.abs(roc10) > 1 ? "moderate" : "weak"} short-term momentum`,
        weight: 10,
      },
      {
        name: "52-Week Position",
        value: rangePct52,
        signal: toSignal(rangeScore),
        color: sigColor(toSignal(rangeScore)),
        score: Math.round(rangeScore),
        description: `At ${rangePct52.toFixed(0)}% of 52W range ($${low52.toFixed(0)} – $${high52.toFixed(0)}) — ${rangePct52 > 80 ? "near yearly highs" : rangePct52 < 20 ? "near yearly lows" : "mid-range"}`,
        weight: 15,
      },
    ];

    const compositeScore = Math.round(
      factors.reduce((s, f) => s + f.score * (f.weight / 100), 0)
    );
    const compositeSignal = toSignal(compositeScore);
    const compositeColor = sigColor(compositeSignal);
    const compositeLabel = sigLabel(compositeSignal);

    const compositeDescription = compositeScore >= 70
      ? "Strong bullish momentum across multiple indicators. Trend-following approach favored; pull-backs are buying opportunities while above EMAs."
      : compositeScore >= 55
      ? "Bullish momentum bias — indicators tilted upward. Monitor for confirmation and avoid fading trend without reversal signal."
      : compositeScore >= 45
      ? "Neutral momentum — mixed signals. Market in consolidation or inflection; wait for momentum to establish direction."
      : compositeScore >= 30
      ? "Bearish momentum signal — indicators weakening. Short-selling potential or caution for longs; watch EMAs for breakdown."
      : "Strong bearish momentum — multiple indicators deteriorating. Preservation of capital favored until momentum reverses.";

    // Timeframe breakdown
    const timeframes: TimeframeScore[] = [
      { label: "Short-Term", period: "10D", score: Math.round(roc10Score * 0.5 + rsi14Score * 0.5), signal: toSignal(roc10Score * 0.5 + rsi14Score * 0.5), color: "", description: `ROC(10): ${roc10.toFixed(1)}% | RSI(14): ${rsi14.toFixed(1)}` },
      { label: "Medium-Term", period: "20D", score: Math.round(roc20Score * 0.4 + rsi28Score * 0.4 + macdScore * 0.2), signal: toSignal(roc20Score * 0.4 + rsi28Score * 0.4 + macdScore * 0.2), color: "", description: `ROC(20): ${roc20.toFixed(1)}% | RSI(28): ${rsi28.toFixed(1)}` },
      { label: "Long-Term", period: "60D", score: Math.round(roc60Score * 0.5 + emaScore * 0.5), signal: toSignal(roc60Score * 0.5 + emaScore * 0.5), color: "", description: `ROC(60): ${roc60.toFixed(1)}% | EMA alignment: ${emaScore}%` },
    ].map(tf => ({ ...tf, color: sigColor(tf.signal) }));

    // Acceleration
    const acceleration = roc20 - roc60;
    const accelerationSignal: MomentumCompositePayload["accelerationSignal"] =
      acceleration > 2 ? "accelerating" : acceleration < -2 ? "decelerating" : "stable";
    const accelerationColor = accelerationSignal === "accelerating" ? "#34d399" : accelerationSignal === "decelerating" ? "#f87171" : "#f5c451";

    // Overbought/oversold
    const overboughtOversold: MomentumCompositePayload["overboughtOversold"] =
      rsi14 > 70 && rangePct52 > 85 ? "overbought"
      : rsi14 < 30 && rangePct52 < 15 ? "oversold"
      : "neutral";
    const overboughtColor = overboughtOversold === "overbought" ? "#f87171" : overboughtOversold === "oversold" ? "#34d399" : "#f5c451";
    const overboughtDesc = overboughtOversold === "overbought"
      ? "Gold is overbought on both RSI and 52W position — risk of short-term pullback before next leg higher."
      : overboughtOversold === "oversold"
      ? "Gold is oversold — historically a strong medium-term buying opportunity as momentum reverses."
      : "Gold is in neutral momentum territory — neither overbought nor oversold.";

    const tradingBias = compositeScore >= 60
      ? `Momentum supports long bias. EMA20 ($${ema20.toFixed(0)}) as key trailing stop. Target: ${((currentPrice * 1.04)).toFixed(0)} (+4%). Invalidation: break of EMA50 ($${ema50.toFixed(0)}).`
      : compositeScore >= 45
      ? `Neutral/consolidation bias. Wait for RSI to confirm direction. Trade range with EMA20 as pivot ($${ema20.toFixed(0)}).`
      : `Momentum bearish. Short bias or cash. Watch for RSI < 30 as oversold bounce trigger. Support at EMA200 ($${ema200.toFixed(0)}).`;

    const payload: MomentumCompositePayload = {
      currentPrice, compositeScore, compositeSignal, compositeColor, compositeLabel, compositeDescription,
      factors, timeframes, acceleration, accelerationSignal, accelerationColor,
      overboughtOversold, overboughtColor, overboughtDesc, tradingBias,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("momentum-composite error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
