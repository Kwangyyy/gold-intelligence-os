import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AssetAllocation {
  symbol: string;
  name: string;
  category: string;
  price: number;
  vol30D: number;         // 30D annualized volatility
  vol90D: number;         // 90D annualized volatility
  equalWeight: number;    // simple equal weight %
  riskParityWeight: number; // 1/vol weight (risk parity)
  goldHeavyWeight: number;  // tilted toward gold
  currentCorr: number;    // 30D correlation with gold
  marginalContribution: number; // risk contribution in equal-weight portfolio
}

export interface PortfolioStats {
  name: string;
  weights: { symbol: string; pct: number }[];
  expectedVol: number;   // portfolio vol estimate
  goldPct: number;       // gold allocation %
  diversificationBenefit: number;  // vol reduction vs equal-weight
  riskColor: string;
  description: string;
}

export interface RiskParityPayload {
  goldPrice: number;
  goldVol30D: number;
  assets: AssetAllocation[];
  portfolios: PortfolioStats[];
  goldRiskContrib: number;   // gold's risk contribution in equal-weight portfolio
  goldDiversScore: number;   // 0-100: how good is gold as diversifier right now
  goldDiversColor: string;
  optimalGoldRange: string;  // suggested gold weight range
  marketRegimeNote: string;  // what regime suggests about gold allocation
  timestamp: string;
}

let CACHE: { data: RiskParityPayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

const ASSETS = [
  { symbol: "GC=F",   name: "Gold",              category: "Commodity"   },
  { symbol: "SPY",    name: "US Equities (SPY)", category: "Equity"      },
  { symbol: "TLT",    name: "US 20Y Bonds (TLT)",category: "Bonds"       },
  { symbol: "BTC-USD",name: "Bitcoin",            category: "Crypto"      },
  { symbol: "DX-Y.NYB",name: "US Dollar (DXY)", category: "Currency"    },
];

async function fetchCloses(symbol: string): Promise<{ price: number; closes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`;
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

function realizedVol(closes: number[], period: number): number {
  if (closes.length < period + 1) return 20;
  const returns: number[] = [];
  const slice = closes.slice(-period - 1);
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0) returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  if (returns.length < 2) return 20;
  const mean = returns.reduce((a, b) => a + b) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function pearsonCorr(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;
  const xs = x.slice(-n), ys = y.slice(-n);
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2; vy += (ys[i] - my) ** 2;
  }
  return vx === 0 || vy === 0 ? 0 : cov / Math.sqrt(vx * vy);
}

function logReturns(arr: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1] > 0 && arr[i] > 0) returns.push(Math.log(arr[i] / arr[i - 1]));
  }
  return returns;
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const results = await Promise.all(ASSETS.map(a => fetchCloses(a.symbol)));

    const goldIdx = ASSETS.findIndex(a => a.symbol === "GC=F");
    const goldData = results[goldIdx];
    const goldPrice = goldData?.price ?? 3350;
    const goldCloses = goldData?.closes ?? [];
    const goldReturns = logReturns(goldCloses);

    // Build asset data
    const assetData = ASSETS.map((def, i) => {
      const r = results[i];
      const closes = r?.closes ?? [];
      const price = r?.price ?? 0;
      const vol30D = Math.round(realizedVol(closes, 30) * 10) / 10;
      const vol90D = Math.round(realizedVol(closes, 90) * 10) / 10;
      const rets = logReturns(closes);
      const corr30D = Math.round(pearsonCorr(rets.slice(-30), goldReturns.slice(-30)) * 100) / 100;
      return { symbol: def.symbol, name: def.name, category: def.category, price, vol30D, vol90D, corr30D };
    });

    // Risk parity weights (inverse volatility)
    const vols = assetData.map(a => a.vol30D || 20);
    const invVols = vols.map(v => 1 / v);
    const invVolSum = invVols.reduce((a, b) => a + b);
    const rpWeights = invVols.map(iv => Math.round((iv / invVolSum) * 1000) / 10);

    // Gold-heavy weights (gold gets 3× normal weight vs others proportional)
    const goldWeight = 40;
    const othersTotal = 100 - goldWeight;
    const nonGoldInvVols = invVols.map((iv, i) => ASSETS[i].symbol !== "GC=F" ? iv : 0);
    const nonGoldSum = nonGoldInvVols.reduce((a, b) => a + b);
    const goldHeavyWeights = ASSETS.map((a, i) => {
      if (a.symbol === "GC=F") return goldWeight;
      return Math.round((nonGoldInvVols[i] / nonGoldSum) * othersTotal * 10) / 10;
    });

    // Equal weight
    const equalWeight = Math.round(10000 / ASSETS.length) / 100;

    // Estimate portfolio volatility for a simplified equal-weight portfolio
    // Simplified: weighted avg vol (ignores correlations but gives ballpark)
    const eqPortVol = vols.reduce((a, b) => a + b) / vols.length;
    const rpPortVol = vols.reduce((a, b, i) => a + b * (rpWeights[i] / 100), 0);
    const ghPortVol = vols.reduce((a, b, i) => a + b * (goldHeavyWeights[i] / 100), 0);

    const assets: AssetAllocation[] = ASSETS.map((def, i) => ({
      symbol: def.symbol,
      name: def.name,
      category: def.category,
      price: assetData[i].price,
      vol30D: assetData[i].vol30D,
      vol90D: assetData[i].vol90D,
      equalWeight,
      riskParityWeight: rpWeights[i],
      goldHeavyWeight: goldHeavyWeights[i],
      currentCorr: assetData[i].corr30D,
      marginalContribution: Math.round((vols[i] / vols.reduce((a, b) => a + b)) * 10000) / 100,
    }));

    const goldAsset = assets.find(a => a.symbol === "GC=F")!;
    const goldVol30D = goldAsset.vol30D;

    const portfolios: PortfolioStats[] = [
      {
        name: "Equal Weight",
        weights: ASSETS.map((a, i) => ({ symbol: a.symbol, pct: equalWeight })),
        expectedVol: Math.round(eqPortVol * 10) / 10,
        goldPct: equalWeight,
        diversificationBenefit: 0,
        riskColor: "#f87171",
        description: "Simple 20% to each asset. High portfolio volatility due to BTC and equities.",
      },
      {
        name: "Risk Parity",
        weights: ASSETS.map((a, i) => ({ symbol: a.symbol, pct: rpWeights[i] })),
        expectedVol: Math.round(rpPortVol * 10) / 10,
        goldPct: rpWeights[goldIdx],
        diversificationBenefit: Math.round((eqPortVol - rpPortVol) * 10) / 10,
        riskColor: "#f5c451",
        description: "Weight inversely proportional to volatility. Lower-vol assets (bonds/gold) get more weight.",
      },
      {
        name: "Gold-Heavy (40% Gold)",
        weights: ASSETS.map((a, i) => ({ symbol: a.symbol, pct: goldHeavyWeights[i] })),
        expectedVol: Math.round(ghPortVol * 10) / 10,
        goldPct: goldWeight,
        diversificationBenefit: Math.round((eqPortVol - ghPortVol) * 10) / 10,
        riskColor: "#34d399",
        description: "40% gold as portfolio anchor, remaining 60% risk-parity weighted. Suitable for inflation hedge focus.",
      },
    ];

    // Gold diversification score: low correlation + low vol = high score
    const spyCorr = assetData.find(a => a.symbol === "SPY")?.corr30D ?? 0;
    const btcCorr = assetData.find(a => a.symbol === "BTC-USD")?.corr30D ?? 0;
    const tltCorr = assetData.find(a => a.symbol === "TLT")?.corr30D ?? 0;
    const avgEquityCorr = (Math.abs(spyCorr) + Math.abs(btcCorr)) / 2;
    const goldDiversScore = Math.round(Math.max(0, Math.min(100,
      70 * (1 - avgEquityCorr) +    // low correlation with risk assets = better diversifier
      30 * (1 - Math.min(goldVol30D / 40, 1))  // lower vol = better diversifier
    )));
    const goldDiversColor = goldDiversScore >= 70 ? "#34d399" : goldDiversScore >= 50 ? "#f5c451" : "#f87171";

    const goldRiskContrib = goldAsset.marginalContribution;

    const optimalGoldRange = goldDiversScore >= 70
      ? "20-40% — Strong diversification case; favor higher gold allocation"
      : goldDiversScore >= 50
      ? "10-25% — Moderate diversifier; standard portfolio range appropriate"
      : "5-15% — Correlation elevated; gold providing less diversification than usual";

    const marketRegimeNote = spyCorr < -0.2 && tltCorr > 0
      ? "Risk-off regime: gold negatively correlated with equities and positively with bonds — ideal conditions for gold as portfolio hedge."
      : spyCorr > 0.3
      ? "Risk-on regime: gold correlated with equities — acting more like risk asset than safe-haven. Diversification benefit temporarily reduced."
      : "Neutral regime: gold correlations mixed. Standard 15-25% allocation appropriate for most portfolios.";

    const payload: RiskParityPayload = {
      goldPrice, goldVol30D, assets, portfolios,
      goldRiskContrib, goldDiversScore, goldDiversColor,
      optimalGoldRange, marketRegimeNote,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("risk-parity error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
