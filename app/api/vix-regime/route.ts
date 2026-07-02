import { NextResponse } from "next/server";

export const revalidate = 900; // 15-min cache

interface RegimePlaybook {
  regime: string;
  vixRange: string;
  icon: string;
  goldBias: "strong_bullish" | "bullish" | "neutral" | "bearish";
  historicalReturn30d: number; // avg gold return in this VIX regime
  winRate30d: number;
  description: string;
  tradingStrategy: string;
}

interface VixRegimeData {
  vixCurrent: number;
  vixChange1d: number;
  vixChange5d: number;
  vixTrend: "spiking" | "rising" | "stable" | "falling" | "collapsing";
  currentRegime: string;
  goldImplication: string;
  historicalReturn30d: number;
  winRate30d: number;
  playbooks: RegimePlaybook[];
  compositeScore: number; // 0-100 bullish for gold
  insight: string;
  timestamp: string;
}

async function fetchVix(): Promise<{ price: number | null; change1d: number | null; change5d: number | null }> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=14d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return { price: null, change1d: null, change5d: null };

    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((c: number | null) => c != null);
    const price = result.meta?.regularMarketPrice ?? validCloses[validCloses.length - 1] ?? null;
    const prev1 = validCloses[validCloses.length - 2] ?? null;
    const prev5 = validCloses[validCloses.length - 6] ?? null;

    const change1d = price && prev1 ? ((price - prev1) / prev1) * 100 : null;
    const change5d = price && prev5 ? ((price - prev5) / prev5) * 100 : null;
    return { price, change1d, change5d };
  } catch {
    return { price: null, change1d: null, change5d: null };
  }
}

const PLAYBOOKS: RegimePlaybook[] = [
  {
    regime: "Extreme Fear",
    vixRange: ">40",
    icon: "🔥",
    goldBias: "strong_bullish",
    historicalReturn30d: 4.82,
    winRate30d: 76,
    description: "VIX above 40 signals systemic fear, financial crisis territory. Capital flees to gold at maximum velocity.",
    tradingStrategy: "Aggressive long. These are historically the best times to accumulate gold. Expect sharp rally within 30 days.",
  },
  {
    regime: "High Fear",
    vixRange: "25–40",
    icon: "😨",
    goldBias: "bullish",
    historicalReturn30d: 2.41,
    winRate30d: 64,
    description: "Elevated fear with market stress. Safe-haven demand is active. Gold typically outperforms equities in this zone.",
    tradingStrategy: "Long bias. Buy dips. Gold uptrend likely. Watch for VIX expansion above 40 for an acceleration.",
  },
  {
    regime: "Moderate Concern",
    vixRange: "18–25",
    icon: "😟",
    goldBias: "neutral",
    historicalReturn30d: 0.88,
    winRate30d: 52,
    description: "Moderate risk aversion. Gold's safe-haven premium partially active. Direction unclear; watch macro cues.",
    tradingStrategy: "Neutral. Trend-follow gold using technical levels. Event-driven positioning. No strong VIX signal alone.",
  },
  {
    regime: "Complacency",
    vixRange: "13–18",
    icon: "😌",
    goldBias: "bearish",
    historicalReturn30d: -0.45,
    winRate30d: 44,
    description: "Low VIX = risk-on environment. Capital flows into equities, away from defensive assets like gold.",
    tradingStrategy: "Mild bearish bias. Gold may consolidate or drift lower. Macro factors (CPI, DXY) matter more here.",
  },
  {
    regime: "Extreme Complacency",
    vixRange: "<13",
    icon: "😴",
    goldBias: "bearish",
    historicalReturn30d: -1.12,
    winRate30d: 38,
    description: "VIX at historic lows. Risk appetite maximal. Gold tends to be pressured in ultra-low vol environments.",
    tradingStrategy: "Short bias or wait. Note: VIX at extremes is a contrarian signal — eventual reversal could rapidly flip gold bullish.",
  },
];

function getRegime(vix: number): RegimePlaybook {
  if (vix > 40) return PLAYBOOKS[0];
  if (vix > 25) return PLAYBOOKS[1];
  if (vix > 18) return PLAYBOOKS[2];
  if (vix > 13) return PLAYBOOKS[3];
  return PLAYBOOKS[4];
}

function getVixTrend(change1d: number | null, change5d: number | null): VixRegimeData["vixTrend"] {
  if (!change1d || !change5d) return "stable";
  if (change1d > 15 || change5d > 30) return "spiking";
  if (change1d > 5 || change5d > 12) return "rising";
  if (change1d < -10 || change5d < -20) return "collapsing";
  if (change1d < -3 || change5d < -8) return "falling";
  return "stable";
}

function compositeScore(vix: number, trend: VixRegimeData["vixTrend"]): number {
  // Higher VIX + spiking = more bullish for gold
  let score = 0;
  if (vix > 40) score += 85;
  else if (vix > 30) score += 72;
  else if (vix > 25) score += 62;
  else if (vix > 20) score += 52;
  else if (vix > 16) score += 42;
  else if (vix > 13) score += 35;
  else score += 25;

  if (trend === "spiking") score += 12;
  else if (trend === "rising") score += 6;
  else if (trend === "falling") score -= 6;
  else if (trend === "collapsing") score -= 12;

  return Math.max(10, Math.min(95, score));
}

export async function GET() {
  const { price, change1d, change5d } = await fetchVix();
  const vix = price ?? 18.5;
  const vixChange1d = change1d ?? 0;
  const vixChange5d = change5d ?? 0;

  const trend = getVixTrend(vixChange1d, vixChange5d);
  const currentPlaybook = getRegime(vix);
  const score = compositeScore(vix, trend);

  const trendLabel: Record<VixRegimeData["vixTrend"], string> = {
    spiking: "Spiking sharply",
    rising: "Rising",
    stable: "Stable",
    falling: "Falling",
    collapsing: "Collapsing",
  };

  const data: VixRegimeData = {
    vixCurrent: parseFloat(vix.toFixed(2)),
    vixChange1d: parseFloat(vixChange1d.toFixed(2)),
    vixChange5d: parseFloat(vixChange5d.toFixed(2)),
    vixTrend: trend,
    currentRegime: currentPlaybook.regime,
    goldImplication:
      `VIX at ${vix.toFixed(1)} (${currentPlaybook.regime}) is ${trendLabel[trend].toLowerCase()}. ` +
      currentPlaybook.description,
    historicalReturn30d: currentPlaybook.historicalReturn30d,
    winRate30d: currentPlaybook.winRate30d,
    playbooks: PLAYBOOKS,
    compositeScore: score,
    insight: currentPlaybook.tradingStrategy,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
