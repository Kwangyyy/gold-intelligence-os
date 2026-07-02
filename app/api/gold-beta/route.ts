import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface BetaEntry {
  asset: string;
  symbol: string;
  icon: string;
  beta30D: number;     // 30-day rolling beta vs gold
  beta90D: number;     // 90-day rolling beta vs gold
  correlation30D: number; // Pearson correlation to gold
  assetClass: string;
  interpretation: string;
  hedgeEfficiency: number; // 0-100 (higher = better gold hedge/proxy)
}

export interface GoldBetaPayload {
  goldPrice: number | null;
  silverGoldRatio: number | null;
  betaEntries: BetaEntry[];
  bestHedge: string;
  bestProxy: string;
  hedgingInsight: string;
  tier: "premium";
  timestamp: string;
}

let CACHE: { data: GoldBetaPayload; ts: number } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — beta is relatively stable

async function fetchDailyCloses(symbol: string, days: number): Promise<number[] | null> {
  try {
    const range = days <= 30 ? "2mo" : "6mo";
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const closes: number[] = (j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [])
      .filter((v: unknown): v is number => typeof v === "number" && !isNaN(v));
    return closes.slice(-days);
  } catch { return null; }
}

function pearsonCorr(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const xs = x.slice(-n), ys = y.slice(-n);
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  const num = xs.reduce((s, xi, i) => s + (xi - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(
    xs.reduce((s, xi) => s + (xi - mx) ** 2, 0) *
    ys.reduce((s, yi) => s + (yi - my) ** 2, 0)
  );
  return den === 0 ? 0 : num / den;
}

function beta(assetReturns: number[], goldReturns: number[]): number {
  const n = Math.min(assetReturns.length, goldReturns.length);
  if (n < 3) return 1;
  const x = goldReturns.slice(-n), y = assetReturns.slice(-n);
  const mx = x.reduce((a, b) => a + b) / n;
  const my = y.reduce((a, b) => a + b) / n;
  const cov = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / n;
  const varX = x.reduce((s, xi) => s + (xi - mx) ** 2, 0) / n;
  return varX === 0 ? 1 : cov / varX;
}

function dailyReturns(closes: number[]): number[] {
  return closes.slice(1).map((c, i) => (c - closes[i]) / closes[i] * 100);
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  const symbols = ["GC=F", "SI=F", "GLD", "IAU", "GDXJ", "GDX", "SLV", "PPLT", "BTC-USD", "TLT"];

  const closes90 = await Promise.all(symbols.map(s => fetchDailyCloses(s, 90)));

  const goldCloses90 = closes90[0] ?? [];
  const goldP = goldCloses90.slice(-1)[0] ?? null;
  const silvP = closes90[1]?.slice(-1)[0] ?? null;
  const goldRet90 = dailyReturns(goldCloses90);

  const silverGoldRatio = goldP && silvP ? goldP / silvP : null;

  const assetMeta: Array<{ name: string; symbol: string; icon: string; assetClass: string; closesIdx: number }> = [
    { name: "Silver (SLV/SI=F)",    symbol: "SI=F",    icon: "🥈", assetClass: "Precious Metal", closesIdx: 1 },
    { name: "SPDR Gold ETF (GLD)",  symbol: "GLD",     icon: "📊", assetClass: "Gold ETF",       closesIdx: 2 },
    { name: "iShares Gold (IAU)",   symbol: "IAU",     icon: "📈", assetClass: "Gold ETF",       closesIdx: 3 },
    { name: "VanEck Jr Miners (GDXJ)", symbol: "GDXJ", icon: "⛏️", assetClass: "Mining Stock",   closesIdx: 4 },
    { name: "VanEck Miners (GDX)",  symbol: "GDX",     icon: "⛏", assetClass: "Mining Stock",   closesIdx: 5 },
    { name: "Silver ETF (SLV)",     symbol: "SLV",     icon: "🥈", assetClass: "Silver ETF",     closesIdx: 6 },
    { name: "Platinum ETF (PPLT)",  symbol: "PPLT",    icon: "🔘", assetClass: "Precious Metal", closesIdx: 7 },
    { name: "Bitcoin (BTC)",        symbol: "BTC-USD", icon: "₿",  assetClass: "Crypto",         closesIdx: 8 },
    { name: "US 20Y Bond (TLT)",   symbol: "TLT",     icon: "📋", assetClass: "Fixed Income",   closesIdx: 9 },
  ];

  const betaEntries: BetaEntry[] = assetMeta.map(meta => {
    const c90 = closes90[meta.closesIdx] ?? [];
    const ret90 = dailyReturns(c90);
    const b90 = parseFloat(beta(ret90, goldRet90).toFixed(2));

    // 30D beta
    const g30 = goldRet90.slice(-30);
    const a30 = ret90.slice(-30);
    const b30 = parseFloat(beta(a30, g30).toFixed(2));

    const corr30 = parseFloat(pearsonCorr(a30, g30).toFixed(2));

    // Hedge efficiency: for proxies (GLD, IAU) want β~1, corr~1; for hedges (TLT) want negative corr
    let hedgeEff: number;
    if (meta.assetClass === "Gold ETF")       hedgeEff = Math.round(Math.max(0, 100 - Math.abs(b90 - 1) * 50) * (corr30 > 0 ? corr30 : 0));
    else if (meta.assetClass === "Mining Stock") hedgeEff = Math.round(Math.max(0, corr30 * 80));
    else if (meta.assetClass === "Fixed Income") hedgeEff = Math.round(Math.max(0, -corr30 * 60 + 40));
    else hedgeEff = Math.round(Math.max(0, corr30 * 50 + 25));

    return {
      asset: meta.name,
      symbol: meta.symbol,
      icon: meta.icon,
      beta30D: b30,
      beta90D: b90,
      correlation30D: corr30,
      assetClass: meta.assetClass,
      interpretation:
        b90 > 1.5 ? `Amplified gold exposure — ${b90}× leverage, higher risk` :
        b90 > 0.8 ? `Strong gold proxy — moves closely with gold` :
        b90 > 0   ? `Partial gold exposure — use as complement, not substitute` :
        b90 < 0   ? `Negative correlation — potential hedge against gold positions` :
        "Uncorrelated to gold in this window",
      hedgeEfficiency: Math.min(hedgeEff, 100),
    };
  });

  const bestProxy = betaEntries.filter(b => b.assetClass === "Gold ETF" || b.assetClass === "Mining Stock")
    .sort((a, b) => b.correlation30D - a.correlation30D)[0]?.asset ?? "SPDR Gold ETF (GLD)";
  const bestHedge = betaEntries.sort((a, b) => a.correlation30D - b.correlation30D)[0]?.asset ?? "US 20Y Bond (TLT)";

  const hedgingInsight =
    `For gold exposure without spot: ${bestProxy} offers the closest tracking. ` +
    `For hedging a gold position: ${bestHedge} shows the lowest correlation, providing partial offsetting protection in drawdowns. ` +
    `Gold miners (GDX/GDXJ) offer amplified exposure (~1.5–2.5× beta) with additional business risk.`;

  const payload: GoldBetaPayload = {
    goldPrice: goldP,
    silverGoldRatio,
    betaEntries,
    bestHedge,
    bestProxy,
    hedgingInsight,
    tier: "premium",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
