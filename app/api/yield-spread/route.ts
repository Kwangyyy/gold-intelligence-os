import { NextResponse } from "next/server";

export const revalidate = 900;

interface SpreadDataPoint {
  date: string;
  spread: number; // 10Y - 2Y in bps
  us10y: number;
  us2y: number;
}

interface YieldSpreadData {
  us10y: number | null;
  us2y: number | null;
  us3m: number | null;
  spread10y2y: number | null;   // bps
  spread10y3m: number | null;   // bps
  spreadTrend: "steepening" | "stable" | "flattening" | "inverting";
  invertedSince: string | null; // ISO date, null if not inverted
  goldImplication: string;
  signal: "strong_bullish" | "bullish" | "neutral" | "bearish";
  history: SpreadDataPoint[];
  playbook: { scenario: string; spread: string; goldBias: string; note: string }[];
  insight: string;
  timestamp: string;
}

async function fetchYield(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=30d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    return result.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

async function fetchYieldHistory(symbol10y: string, symbol2y: string): Promise<SpreadDataPoint[]> {
  try {
    const [r10, r2] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol10y)}?interval=1d&range=60d`, {
        headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 },
      }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol2y)}?interval=1d&range=60d`, {
        headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 },
      }),
    ]);
    const j10 = await r10.json();
    const j2  = await r2.json();

    const result10 = j10?.chart?.result?.[0];
    const result2  = j2?.chart?.result?.[0];
    if (!result10 || !result2) return [];

    const closes10: number[] = result10.indicators?.quote?.[0]?.close ?? [];
    const closes2:  number[] = result2.indicators?.quote?.[0]?.close  ?? [];
    const timestamps: number[] = result10.timestamp ?? [];

    const history: SpreadDataPoint[] = [];
    const n = Math.min(closes10.length, closes2.length, timestamps.length, 30);
    for (let i = closes10.length - n; i < closes10.length; i++) {
      if (closes10[i] == null || closes2[i] == null) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      history.push({
        date,
        us10y: parseFloat(closes10[i].toFixed(3)),
        us2y: parseFloat(closes2[i].toFixed(3)),
        spread: parseFloat(((closes10[i] - closes2[i]) * 100).toFixed(1)),
      });
    }
    return history;
  } catch {
    return [];
  }
}

function getSpreadTrend(history: SpreadDataPoint[]): YieldSpreadData["spreadTrend"] {
  if (history.length < 5) return "stable";
  const recent5 = history.slice(-5).map(h => h.spread);
  const avg = recent5.reduce((s, v) => s + v, 0) / recent5.length;
  const first = recent5[0];
  const last = recent5[recent5.length - 1];
  const delta = last - first;

  if (delta < -15) return "inverting";
  if (delta < -5) return "flattening";
  if (delta > 10) return "steepening";
  return "stable";
}

function getSignal(spread: number | null, trend: YieldSpreadData["spreadTrend"]): YieldSpreadData["signal"] {
  if (spread === null) return "neutral";
  if (spread < -50) return "strong_bullish";   // deep inversion → recession → gold bullish
  if (spread < 0)   return "bullish";          // inverted → gold supportive
  if (trend === "inverting") return "bullish";
  if (spread > 100) return "bearish";          // steep normal curve → economic optimism → gold headwind
  return "neutral";
}

export async function GET() {
  const [us10y, us2y, us3m, history] = await Promise.all([
    fetchYield("%5ETNX"),
    fetchYield("%5ETWO"),
    fetchYield("%5EIRX"),
    fetchYieldHistory("%5ETNX", "%5ETWO"),
  ]);

  const spread10y2y = us10y !== null && us2y !== null
    ? parseFloat(((us10y - us2y) * 100).toFixed(1))
    : null;
  const spread10y3m = us10y !== null && us3m !== null
    ? parseFloat(((us10y - us3m) * 100).toFixed(1))
    : null;

  const trend = getSpreadTrend(history);
  const signal = getSignal(spread10y2y, trend);

  const invertedSince = spread10y2y !== null && spread10y2y < 0
    ? history.find(h => h.spread < 0)?.date ?? null
    : null;

  const goldImplication =
    signal === "strong_bullish"
      ? `Deep inversion (${spread10y2y?.toFixed(0)}bps) signals severe recession risk. Historically one of the most reliable gold bullish setups — recession fears drive safe-haven demand while Fed shifts to rate cuts.`
      : signal === "bullish"
      ? `Inverted yield curve (10Y-2Y: ${spread10y2y?.toFixed(0)}bps). Recession probability elevated. Market pricing future rate cuts — both reduce gold's opportunity cost. Bullish environment for gold.`
      : signal === "bearish"
      ? `Steep normal curve (${spread10y2y?.toFixed(0)}bps). Strong economic growth expected — risk-on environment. Gold faces headwinds from rising real yields and equity competition.`
      : `Yield curve neutral to slightly ${(spread10y2y ?? 0) < 0 ? "inverted" : "normal"} at ${spread10y2y?.toFixed(0)}bps. No strong yield curve signal — macro data and positioning matter more.`;

  const playbook = [
    { scenario: "Deep Inversion (<-50bp)", spread: "< -50bps", goldBias: "Strong Buy", note: "Pre-recession. Fed will pivot. Gold surges on both safe-haven + rate-cut anticipation." },
    { scenario: "Inverted (0 to -50bp)", spread: "-50 to 0bps", goldBias: "Bullish", note: "Market pricing recession. Each 25bp deeper inversion adds ~0.5% gold premium historically." },
    { scenario: "Flat (-10 to +10bp)", spread: "-10 to +10bps", goldBias: "Neutral", note: "Transition zone. Uncertainty elevated. Position-driven; watch macro events." },
    { scenario: "Normal Steep (>100bp)", spread: "> +100bps", goldBias: "Bearish", note: "Growth optimism. Risk-on. Gold may drift lower absent inflation/geopolitical catalyst." },
  ];

  const data: YieldSpreadData = {
    us10y,
    us2y,
    us3m,
    spread10y2y,
    spread10y3m,
    spreadTrend: trend,
    invertedSince,
    goldImplication,
    signal,
    history: history.slice(-20),
    playbook,
    insight:
      `US 10Y-2Y spread at ${spread10y2y?.toFixed(0) ?? "N/A"}bps (${trend}). ` +
      `10Y-3M spread: ${spread10y3m?.toFixed(0) ?? "N/A"}bps. ` +
      (spread10y2y !== null && spread10y2y < 0 ? `Yield curve inverted — recession probability elevated per NY Fed model (>60% historically when inverted >6 months). ` : "") +
      `Gold has rallied in 8 of last 10 yield curve inversion periods since 1980.`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
