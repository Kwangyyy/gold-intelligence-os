import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface AssetFlow {
  name: string;
  symbol: string;
  icon: string;
  price: number | null;
  change1D: number | null;     // % 1-day change
  change1W: number | null;     // % 1-week change
  change1M: number | null;     // % 1-month change
  goldRelation: "direct" | "inverse" | "safe-haven-alt" | "inflation-hedge";
  flowToGold: "bullish" | "neutral" | "bearish"; // does current move help or hurt gold?
  flowStrength: number; // 0-100
  rationale: string;
}

export interface FlowSummary {
  totalBullishFlows: number;
  totalBearishFlows: number;
  flowScore: number; // 0-100 (100 = all flows bullish for gold)
  dominantTheme: string;
}

export interface FlowTrackerPayload {
  spotGold:   number | null;
  assets:     AssetFlow[];
  summary:    FlowSummary;
  flowNarrative: string;
  tier: "premium";
  timestamp: string;
}

let CACHE: { data: FlowTrackerPayload; ts: number } | null = null;
const TTL_MS = 10 * 60 * 1000; // 10m

async function fetchAsset(symbol: string): Promise<{ price: number; chg1D: number } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    const price   = meta?.regularMarketPrice as number | undefined;
    const prevCls = meta?.chartPreviousClose as number | undefined;
    if (!price || !prevCls) return null;
    return { price, chg1D: ((price - prevCls) / prevCls) * 100 };
  } catch { return null; }
}

async function fetchWeeklyChange(symbol: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const closes: number[] = (j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    if (closes.length < 6) return null;
    return ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100;
  } catch { return null; }
}

function classifyFlow(
  chg1D: number | null,
  goldRelation: AssetFlow["goldRelation"]
): { flow: AssetFlow["flowToGold"]; strength: number } {
  if (chg1D === null) return { flow: "neutral", strength: 50 };
  const mag = Math.abs(chg1D);
  const strength = Math.min(Math.round(50 + mag * 15), 100);

  switch (goldRelation) {
    case "inverse":         // DXY, real yields — up = bad for gold
      return { flow: chg1D < -0.2 ? "bullish" : chg1D > 0.2 ? "bearish" : "neutral", strength };
    case "direct":          // silver, oil — up with gold = confirming
      return { flow: chg1D > 0.3 ? "bullish" : chg1D < -0.3 ? "bearish" : "neutral", strength };
    case "safe-haven-alt":  // BTC, JPY — compete with gold
      return { flow: chg1D < -0.5 ? "bullish" : chg1D > 1.0 ? "bearish" : "neutral", strength };
    case "inflation-hedge": // commodities broadly
      return { flow: chg1D > 0.5 ? "bullish" : chg1D < -0.5 ? "bearish" : "neutral", strength };
  }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  // Assets to track
  const symbols = [
    { symbol: "GC=F",      name: "Gold (XAUUSD)",        icon: "🥇", relation: "direct"          as const },
    { symbol: "DX-Y.NYB",  name: "US Dollar Index",      icon: "💵", relation: "inverse"         as const },
    { symbol: "^TNX",      name: "10Y US Treasury Yield", icon: "📊", relation: "inverse"         as const },
    { symbol: "SI=F",      name: "Silver",               icon: "🥈", relation: "direct"          as const },
    { symbol: "CL=F",      name: "Crude Oil (WTI)",      icon: "🛢️", relation: "inflation-hedge" as const },
    { symbol: "^VIX",      name: "VIX (Fear Index)",     icon: "😱", relation: "direct"          as const },
    { symbol: "BTC-USD",   name: "Bitcoin",              icon: "₿",  relation: "safe-haven-alt"  as const },
    { symbol: "^GSPC",     name: "S&P 500",              icon: "📈", relation: "inverse"         as const },
    { symbol: "TLT",       name: "US 20Y Treasury ETF",  icon: "💳", relation: "direct"          as const },
    { symbol: "HG=F",      name: "Copper (Dr. Copper)",  icon: "🔧", relation: "inflation-hedge" as const },
  ];

  // Fetch all assets concurrently
  const [goldD, ...restD] = await Promise.all(symbols.map(s => fetchAsset(s.symbol)));
  const spotGold = goldD?.price ?? null;

  const assets: AssetFlow[] = symbols.map((s, i) => {
    const d = i === 0 ? goldD : restD[i - 1];
    const { flow, strength } = classifyFlow(d?.chg1D ?? null, s.relation);
    return {
      name: s.name,
      symbol: s.symbol,
      icon: s.icon,
      price: d?.price ?? null,
      change1D: d?.chg1D ?? null,
      change1W: null,
      change1M: null,
      goldRelation: s.relation,
      flowToGold: flow,
      flowStrength: strength,
      rationale:
        s.relation === "inverse"
          ? `${s.name} moves inversely to gold. ${(d?.chg1D ?? 0) < 0 ? "Falling " : "Rising "} ${s.name} is ${(d?.chg1D ?? 0) < 0 ? "bullish" : "bearish"} for gold.`
          : s.relation === "direct"
          ? `${s.name} tends to move with gold. ${(d?.chg1D ?? 0) > 0 ? "Rising" : "Falling"} ${s.name} ${(d?.chg1D ?? 0) > 0 ? "confirms" : "diverges from"} the gold move.`
          : s.relation === "safe-haven-alt"
          ? `${s.name} competes with gold for safe-haven flows. ${(d?.chg1D ?? 0) > 0 ? "Strength" : "Weakness"} in ${s.name} may ${(d?.chg1D ?? 0) > 0 ? "reduce" : "boost"} gold demand.`
          : `${s.name} as an inflation hedge — ${(d?.chg1D ?? 0) > 0 ? "rising" : "falling"} commodity prices ${(d?.chg1D ?? 0) > 0 ? "support" : "reduce"} inflation narrative.`,
    };
  });

  const bullishCount = assets.filter(a => a.flowToGold === "bullish").length;
  const bearishCount = assets.filter(a => a.flowToGold === "bearish").length;
  const flowScore = Math.round(50 + (bullishCount - bearishCount) / assets.length * 50);

  const dominantTheme =
    flowScore >= 70 ? "Risk-off flows and dollar weakness are broadly bullish for gold" :
    flowScore <= 30 ? "Risk-on sentiment and dollar strength are headwinds for gold" :
    "Mixed cross-asset flows — no clear directional bias for gold";

  const flowNarrative = [
    `${bullishCount} of ${assets.length} tracked assets are sending bullish signals for gold.`,
    assets.find(a => a.symbol === "DX-Y.NYB")
      ? `DXY ${(assets.find(a => a.symbol === "DX-Y.NYB")!.change1D ?? 0) < 0 ? "weakness" : "strength"} is ${(assets.find(a => a.symbol === "DX-Y.NYB")!.change1D ?? 0) < 0 ? "positive" : "a headwind"}.`
      : "",
    assets.find(a => a.symbol === "^VIX")
      ? `VIX at ${assets.find(a => a.symbol === "^VIX")!.price?.toFixed(1)} — ${(assets.find(a => a.symbol === "^VIX")!.price ?? 0) > 18 ? "elevated fear supports safe-haven gold" : "calm markets reduce safe-haven premium"}.`
      : "",
  ].filter(Boolean).join(" ");

  const payload: FlowTrackerPayload = {
    spotGold,
    assets,
    summary: { totalBullishFlows: bullishCount, totalBearishFlows: bearishCount, flowScore, dominantTheme },
    flowNarrative,
    tier: "premium",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
