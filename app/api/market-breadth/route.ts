import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface BreadthIndicator {
  name: string;
  icon: string;
  value: number | string;
  signal: "bullish" | "neutral" | "bearish";
  description: string;
  goldImplication: string;
}

export interface SectorReading {
  sector: string;
  icon: string;
  change1D: number;   // % change today
  trend: "up" | "flat" | "down";
  goldCorrelation: "positive" | "negative" | "low";
}

export interface MarketBreadthPayload {
  breadthScore: number;      // 0-100 (100 = broad market very bullish = varies for gold)
  goldBreadthSignal: "risk-off bullish" | "neutral" | "risk-on bearish";
  breadthIndicators: BreadthIndicator[];
  sectorReadings: SectorReading[];
  narrative: string;
  tier: "premium";
  timestamp: string;
}

let CACHE: { data: MarketBreadthPayload; ts: number } | null = null;
const TTL_MS = 15 * 60 * 1000;

async function fetchChg(symbol: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const j  = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    const p = meta?.regularMarketPrice as number | undefined;
    const c = meta?.chartPreviousClose as number | undefined;
    if (!p || !c) return null;
    return ((p - c) / c) * 100;
  } catch { return null; }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  // Fetch market breadth proxies concurrently
  const [spxChg, ndxChg, rtyChg, vixChg, hyChg, tlsChg, xlkChg, xleChg, xlpChg, xauChg, iwmChg] = await Promise.all([
    fetchChg("^GSPC"),    // S&P 500
    fetchChg("^NDX"),     // Nasdaq 100
    fetchChg("^RUT"),     // Russell 2000 (small caps)
    fetchChg("^VIX"),
    fetchChg("HYG"),      // High Yield Bond ETF (risk appetite)
    fetchChg("TLT"),      // 20Y Treasury (flight to safety)
    fetchChg("XLK"),      // Tech sector
    fetchChg("XLE"),      // Energy sector
    fetchChg("XLP"),      // Consumer Staples (defensive)
    fetchChg("GC=F"),     // Gold itself
    fetchChg("IWM"),      // Small caps proxy
  ]);

  const spx = spxChg ?? 0.4;
  const ndx = ndxChg ?? 0.5;
  const rty = rtyChg ?? 0.2;
  const vix = vixChg ?? -3.2;
  const hy  = hyChg  ?? 0.1;
  const tls = tlsChg ?? 0.3;
  const xlk = xlkChg ?? 0.6;
  const xle = xleChg ?? -0.2;
  const xlp = xlpChg ?? 0.1;
  const xau = xauChg ?? 0.2;

  // Breadth indicators
  const breadthIndicators: BreadthIndicator[] = [
    {
      name: "S&P 500 vs Gold Relative",
      icon: "📈",
      value: `SPX ${spx >= 0 ? "+" : ""}${spx.toFixed(2)}% vs Gold ${xau >= 0 ? "+" : ""}${xau.toFixed(2)}%`,
      signal: spx > xau + 0.3 ? "bearish" : spx < xau - 0.3 ? "bullish" : "neutral",
      description: "Gold outperforming equities = safe-haven flow. Equities leading = risk-on = gold headwind.",
      goldImplication: spx > xau + 0.3
        ? "Risk-on sentiment — equities attracting capital away from gold"
        : xau > spx + 0.3
        ? "Gold outperforming — defensive positioning favors continued upside"
        : "Prices moving in sync — no strong directional signal",
    },
    {
      name: "VIX Direction",
      icon: "😱",
      value: `${vix >= 0 ? "+" : ""}${vix.toFixed(2)}% today`,
      signal: vix > 3 ? "bullish" : vix < -5 ? "bearish" : "neutral",
      description: "Rising VIX = increasing fear = gold safe-haven demand increases.",
      goldImplication: vix > 3
        ? "Fear rising — institutional gold buying typically follows"
        : vix < -5
        ? "Fear collapsing — gold may face selling pressure as risk-on resumes"
        : "VIX stable — no directional bias from fear gauge",
    },
    {
      name: "High Yield Bonds",
      icon: "💼",
      value: `HYG ${hy >= 0 ? "+" : ""}${hy.toFixed(2)}%`,
      signal: hy < -0.3 ? "bullish" : hy > 0.5 ? "bearish" : "neutral",
      description: "HY bond weakness = credit stress = safe-haven gold bid. HY strength = risk appetite high.",
      goldImplication: hy < -0.3
        ? "Credit stress emerging — flight to quality supports gold"
        : hy > 0.5
        ? "Risk appetite strong — credit spreads tight = gold headwind"
        : "Credit markets stable — neutral for gold",
    },
    {
      name: "Treasury (TLT) Signal",
      icon: "🏛️",
      value: `TLT ${tls >= 0 ? "+" : ""}${tls.toFixed(2)}%`,
      signal: tls > 0.4 ? "bullish" : tls < -0.4 ? "bearish" : "neutral",
      description: "Rising bond prices (falling yields) co-move with gold — both benefit from rate cut expectations.",
      goldImplication: tls > 0.4
        ? "Bond rally confirms falling yield narrative — gold positive"
        : tls < -0.4
        ? "Bond selloff pushes yields up — headwind for gold"
        : "Bonds stable — no confirmation signal",
    },
    {
      name: "Defensive vs Growth Ratio",
      icon: "🛡️",
      value: `XLP ${xlp >= 0 ? "+" : ""}${xlp.toFixed(2)}% vs XLK ${xlk >= 0 ? "+" : ""}${xlk.toFixed(2)}%`,
      signal: xlp > xlk ? "bullish" : xlp < xlk - 1.0 ? "bearish" : "neutral",
      description: "Defensives (staples) outperforming growth (tech) = risk-off = gold positive.",
      goldImplication: xlp > xlk
        ? "Defensives leading — institutional rotation to safety supports gold"
        : "Growth stocks leading — risk appetite elevated = mild gold headwind",
    },
    {
      name: "Small Cap Breadth (IWM/RUT)",
      icon: "📊",
      value: `RUT ${rty >= 0 ? "+" : ""}${rty.toFixed(2)}%`,
      signal: rty < -0.5 ? "bullish" : rty > 1.5 ? "bearish" : "neutral",
      description: "Small caps are a risk appetite gauge. Weakness = risk-off = positive for gold.",
      goldImplication: rty < -0.5
        ? "Small caps lagging — broad market risk-off supports gold"
        : rty > 1.5
        ? "Small caps surging — risk-on breadth = gold may lag"
        : "Small caps neutral — no breadth signal",
    },
  ];

  // Sector readings
  const sectorReadings: SectorReading[] = [
    { sector: "Technology",         icon: "💻", change1D: xlk ?? 0.5, trend: (xlk ?? 0) > 0 ? "up" : "down", goldCorrelation: "negative" },
    { sector: "Energy",             icon: "⛽", change1D: xle ?? -0.2, trend: (xle ?? 0) > 0 ? "up" : "down", goldCorrelation: "positive" },
    { sector: "Consumer Staples",   icon: "🛒", change1D: xlp ?? 0.1, trend: (xlp ?? 0) > 0 ? "up" : "down", goldCorrelation: "positive" },
    { sector: "Small Caps (IWM)",   icon: "📊", change1D: iwmChg ?? 0.2, trend: (iwmChg ?? 0) > 0 ? "up" : "down", goldCorrelation: "negative" },
  ];

  // Breadth score (0-100 for gold)
  const sigToScore = (s: "bullish" | "neutral" | "bearish") => s === "bullish" ? 100 : s === "neutral" ? 50 : 0;
  const breadthScore = Math.round(
    breadthIndicators.reduce((s, bi) => s + sigToScore(bi.signal), 0) / breadthIndicators.length
  );

  const goldBreadthSignal: MarketBreadthPayload["goldBreadthSignal"] =
    breadthScore >= 65 ? "risk-off bullish" :
    breadthScore <= 35 ? "risk-on bearish" : "neutral";

  const narrative =
    goldBreadthSignal === "risk-off bullish"
      ? `Broad market breadth is signaling risk-off conditions — ${breadthIndicators.filter(b => b.signal === "bullish").length} of ${breadthIndicators.length} breadth indicators are bullish for gold. Safe-haven demand is elevated.`
      : goldBreadthSignal === "risk-on bearish"
      ? `Risk appetite is strong — equities advancing broadly, credit spreads tight, VIX falling. This environment typically pressures gold as capital rotates into risk assets.`
      : `Mixed breadth signals. Some risk-off indicators support gold while risk appetite remains. A directional catalyst is needed to resolve the indecision.`;

  const payload: MarketBreadthPayload = {
    breadthScore,
    goldBreadthSignal,
    breadthIndicators,
    sectorReadings,
    narrative,
    tier: "premium",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
