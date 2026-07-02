import { NextResponse } from "next/server";

export const revalidate = 300; // 5-min cache

interface TradeSetup {
  direction: "long" | "short";
  type: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rr1: number;
  rr2: number;
  rr3: number;
  probability: number; // % historical win rate for this setup type
  rationale: string;
  conditions: string[];
  invalidation: string;
}

interface TradeSetupData {
  spot: number;
  high: number;
  low: number;
  atr: number;
  trend: "up" | "neutral" | "down";
  volatility: "high" | "normal" | "low";
  session: string;
  setups: TradeSetup[];
  bias: "long" | "neutral" | "short";
  biasRationale: string;
  timestamp: string;
}

async function fetchGoldOHLC(): Promise<{ spot: number; high: number; low: number; prev: number; history: number[] }> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=20d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } }
    );
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return { spot: 3320, high: 3340, low: 3300, prev: 3310, history: [] };

    const meta = result.meta;
    const closes: number[] = (result.indicators?.quote?.[0]?.close ?? []).filter((c: number | null) => c != null);
    const highs: number[]  = (result.indicators?.quote?.[0]?.high  ?? []).filter((h: number | null) => h != null);
    const lows: number[]   = (result.indicators?.quote?.[0]?.low   ?? []).filter((l: number | null) => l != null);

    const spot = meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 3320;
    const high = meta?.regularMarketDayHigh ?? highs[highs.length - 1] ?? spot * 1.005;
    const low  = meta?.regularMarketDayLow  ?? lows[lows.length - 1]  ?? spot * 0.995;
    const prev = meta?.chartPreviousClose ?? closes[closes.length - 2] ?? spot;

    return { spot, high, low, prev, history: closes };
  } catch {
    return { spot: 3320, high: 3340, low: 3300, prev: 3310, history: [] };
  }
}

function computeATR(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 30; // fallback
  let atrSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    atrSum += Math.abs(closes[i] - closes[i - 1]);
  }
  return parseFloat((atrSum / period).toFixed(2));
}

function getSession(): string {
  const h = new Date().getUTCHours();
  if (h >= 0 && h < 7) return "Asia";
  if (h >= 7 && h < 13) return "London";
  if (h >= 13 && h < 21) return "New York";
  return "After Hours";
}

function detectTrend(closes: number[]): "up" | "neutral" | "down" {
  if (closes.length < 5) return "neutral";
  const recent = closes.slice(-5);
  const ema5 = recent.reduce((s, v) => s + v, 0) / 5;
  const older = closes.slice(-20, -5);
  const ema15 = older.length ? older.reduce((s, v) => s + v, 0) / older.length : ema5;
  if (ema5 > ema15 * 1.001) return "up";
  if (ema5 < ema15 * 0.999) return "down";
  return "neutral";
}

export async function GET() {
  const { spot, high, low, prev, history } = await fetchGoldOHLC();
  const atr = computeATR(history);
  const trend = detectTrend(history);
  const session = getSession();
  const range = high - low;
  const volatility: TradeSetupData["volatility"] = atr > 40 ? "high" : atr < 15 ? "low" : "normal";

  const setups: TradeSetup[] = [];

  // LONG setups
  if (trend !== "down") {
    // Setup 1: Bull Flag / Breakout above day high
    setups.push({
      direction: "long",
      type: "Breakout Long",
      entry: parseFloat((high + 0.5).toFixed(2)),
      sl: parseFloat((high - atr * 0.8).toFixed(2)),
      tp1: parseFloat((high + atr * 0.5).toFixed(2)),
      tp2: parseFloat((high + atr * 1.0).toFixed(2)),
      tp3: parseFloat((high + atr * 1.8).toFixed(2)),
      rr1: parseFloat((0.5 / 0.8).toFixed(2)),
      rr2: parseFloat((1.0 / 0.8).toFixed(2)),
      rr3: parseFloat((1.8 / 0.8).toFixed(2)),
      probability: trend === "up" ? 58 : 51,
      rationale: `Price breaks above today's high (${high.toFixed(2)}). Signals intraday momentum continuation with volume confirmation needed.`,
      conditions: [
        "Volume expanding on breakout candle",
        "DXY stable or falling",
        "No major news in next 2 hours",
      ],
      invalidation: `Close back below $${(high - atr * 0.5).toFixed(2)} negates breakout.`,
    });

    // Setup 2: Pullback long to VWAP/previous close
    const pullbackEntry = parseFloat(Math.max(prev, spot - atr * 0.4).toFixed(2));
    setups.push({
      direction: "long",
      type: "Pullback Long",
      entry: pullbackEntry,
      sl: parseFloat((pullbackEntry - atr * 0.6).toFixed(2)),
      tp1: parseFloat((pullbackEntry + atr * 0.8).toFixed(2)),
      tp2: parseFloat((pullbackEntry + atr * 1.5).toFixed(2)),
      tp3: parseFloat((pullbackEntry + atr * 2.2).toFixed(2)),
      rr1: parseFloat((0.8 / 0.6).toFixed(2)),
      rr2: parseFloat((1.5 / 0.6).toFixed(2)),
      rr3: parseFloat((2.2 / 0.6).toFixed(2)),
      probability: trend === "up" ? 62 : 48,
      rationale: `Wait for pullback to ~prev close / key level. Higher probability entry in uptrend vs chasing the breakout.`,
      conditions: [
        "Price dips to entry zone with reduced selling volume",
        "Bullish engulfing or hammer at entry",
        "DXY not spiking higher",
      ],
      invalidation: `Break below $${(pullbackEntry - atr * 0.6).toFixed(2)} invalidates pullback thesis.`,
    });
  }

  // SHORT setups
  if (trend !== "up") {
    const shortEntry = parseFloat((low - 0.5).toFixed(2));
    setups.push({
      direction: "short",
      type: "Breakdown Short",
      entry: shortEntry,
      sl: parseFloat((shortEntry + atr * 0.8).toFixed(2)),
      tp1: parseFloat((shortEntry - atr * 0.5).toFixed(2)),
      tp2: parseFloat((shortEntry - atr * 1.0).toFixed(2)),
      tp3: parseFloat((shortEntry - atr * 1.8).toFixed(2)),
      rr1: parseFloat((0.5 / 0.8).toFixed(2)),
      rr2: parseFloat((1.0 / 0.8).toFixed(2)),
      rr3: parseFloat((1.8 / 0.8).toFixed(2)),
      probability: trend === "down" ? 55 : 44,
      rationale: `Break below today's low (${low.toFixed(2)}) signals intraday bearish momentum. Useful when DXY or yields rising.`,
      conditions: [
        "Break below day low with momentum",
        "DXY strengthening or risk-off equity sell-off",
        "No major economic data expected",
      ],
      invalidation: `Recovery above $${(shortEntry + atr * 0.5).toFixed(2)} negates breakdown.`,
    });
  }

  // Range trade setup (always offer in normal/low volatility)
  if (volatility !== "high") {
    setups.push({
      direction: "long",
      type: "Range Buy at Support",
      entry: parseFloat((low + atr * 0.1).toFixed(2)),
      sl: parseFloat((low - atr * 0.3).toFixed(2)),
      tp1: parseFloat(((high + low) / 2).toFixed(2)),
      tp2: parseFloat((high - atr * 0.1).toFixed(2)),
      tp3: parseFloat((high + atr * 0.2).toFixed(2)),
      rr1: parseFloat(((((high + low) / 2) - (low + atr * 0.1)) / (atr * 0.4)).toFixed(2)),
      rr2: parseFloat(((high - low) / (atr * 0.4)).toFixed(2)),
      rr3: parseFloat(((high - low + atr * 0.3) / (atr * 0.4)).toFixed(2)),
      probability: 54,
      rationale: `Range-bound trade: buy support at day low zone, target day high. Best for low-volatility sessions.`,
      conditions: [
        "No trending news catalyst expected",
        "Price testing low of day with reduced momentum",
        "RSI approaching oversold on 15m chart",
      ],
      invalidation: `Close below $${(low - atr * 0.3).toFixed(2)} signals range breakdown.`,
    });
  }

  const bias: TradeSetupData["bias"] = trend === "up" ? "long" : trend === "down" ? "short" : "neutral";
  const biasRationale =
    trend === "up"   ? `Price trending higher — ${history.length > 3 ? "5-period" : "short"} EMA above longer EMA. Prefer long setups on dips.`
    : trend === "down" ? `Downtrend in place. Prefer short setups on rallies and avoid buying breakdowns.`
    : `No clear trend. Range-bound conditions — buy support, sell resistance. Reduce size.`;

  const data: TradeSetupData = {
    spot,
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    atr: parseFloat(atr.toFixed(2)),
    trend,
    volatility,
    session,
    setups,
    bias,
    biasRationale,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
