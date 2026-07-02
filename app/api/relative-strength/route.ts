import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AssetPerformance {
  symbol: string;
  name: string;
  category: string;
  change1W: number;
  change1M: number;
  change3M: number;
  change6M: number;
  change1Y: number;
  rank1M: number;     // rank among all assets (1 = best)
  rank3M: number;
  goldOutperforming1M: boolean;  // gold > this asset on 1M
  goldOutperforming3M: boolean;
  vsGold1M: number;   // asset perf minus gold perf on 1M
  vsGold3M: number;
  implForGold: string;
  implColor: string;
}

export interface RelativeStrengthPayload {
  goldPrice: number;
  goldChange1W: number;
  goldChange1M: number;
  goldChange3M: number;
  goldChange6M: number;
  goldRank1M: number;   // gold's rank out of all assets on 1M
  goldRank3M: number;
  totalAssets: number;
  assets: AssetPerformance[];
  topPerformers1M: string[];  // top 3 symbols by 1M
  bottomPerformers1M: string[];
  goldOutperformsCount1M: number;  // how many assets gold beats on 1M
  goldOutperformsCount3M: number;
  rsSignal: "strong_outperform" | "outperform" | "neutral" | "underperform" | "strong_underperform";
  rsColor: string;
  rsLabel: string;
  rsDescription: string;
  timestamp: string;
}

let CACHE: { data: RelativeStrengthPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000;

const ASSETS = [
  { symbol: "GC=F",  name: "Gold (GC=F)",         category: "Precious Metal"  },
  { symbol: "SI=F",  name: "Silver",               category: "Precious Metal"  },
  { symbol: "HG=F",  name: "Copper",               category: "Industrial Metal"},
  { symbol: "CL=F",  name: "Crude Oil (WTI)",      category: "Energy"          },
  { symbol: "^GSPC", name: "S&P 500",              category: "Equities"        },
  { symbol: "QQQ",   name: "Nasdaq 100 (QQQ)",     category: "Equities"        },
  { symbol: "EEM",   name: "Emerging Markets (EEM)",category: "Equities"       },
  { symbol: "TLT",   name: "US 20Y Treasury (TLT)", category: "Bonds"          },
  { symbol: "HYG",   name: "High-Yield Bonds (HYG)", category: "Bonds"         },
  { symbol: "DX-Y.NYB", name: "US Dollar (DXY)",    category: "Currency"       },
  { symbol: "EURUSD=X", name: "EUR/USD",             category: "Currency"       },
  { symbol: "BTC-USD",  name: "Bitcoin",             category: "Crypto"         },
  { symbol: "ETH-USD",  name: "Ethereum",            category: "Crypto"         },
  { symbol: "GLD",      name: "SPDR Gold ETF (GLD)", category: "Gold ETF"       },
  { symbol: "GDX",      name: "Gold Miners (GDX)",   category: "Gold ETF"       },
  { symbol: "^VIX",     name: "VIX (Volatility)",    category: "Volatility"     },
  { symbol: "USO",      name: "Oil ETF (USO)",        category: "Energy"         },
  { symbol: "^TNX",     name: "US 10Y Yield",         category: "Rates"          },
  { symbol: "XLF",      name: "Financials (XLF)",     category: "Equities"       },
  { symbol: "XLU",      name: "Utilities (XLU)",      category: "Equities"       },
];

async function fetchChanges(symbol: string): Promise<{ change1W: number; change1M: number; change3M: number; change6M: number; change1Y: number; price: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const price: number = r.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const pct = (n: number) => {
      if (closes.length < n + 1 || !price) return 0;
      const past = closes[closes.length - 1 - Math.min(n, closes.length - 1)];
      return past > 0 ? ((price - past) / past) * 100 : 0;
    };
    return { price, change1W: pct(5), change1M: pct(21), change3M: pct(63), change6M: pct(126), change1Y: pct(252) };
  } catch { return null; }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const results = await Promise.all(ASSETS.map(a => fetchChanges(a.symbol)));

    const goldIdx = ASSETS.findIndex(a => a.symbol === "GC=F");
    const goldResult = results[goldIdx];
    const goldPrice = goldResult?.price ?? 3350;
    const goldChange1W = goldResult?.change1W ?? 0;
    const goldChange1M = goldResult?.change1M ?? 0;
    const goldChange3M = goldResult?.change3M ?? 0;
    const goldChange6M = goldResult?.change6M ?? 0;

    // Build asset list (skip gold itself for comparison array)
    const assets: AssetPerformance[] = ASSETS.map((a, i) => {
      const r = results[i];
      if (!r) return null;
      const change1W = Math.round(r.change1W * 100) / 100;
      const change1M = Math.round(r.change1M * 100) / 100;
      const change3M = Math.round(r.change3M * 100) / 100;
      const change6M = Math.round(r.change6M * 100) / 100;
      const change1Y = Math.round(r.change1Y * 100) / 100;
      const vsGold1M = Math.round((change1M - goldChange1M) * 100) / 100;
      const vsGold3M = Math.round((change3M - goldChange3M) * 100) / 100;
      const goldOutperforming1M = goldChange1M > change1M && a.symbol !== "GC=F";
      const goldOutperforming3M = goldChange3M > change3M && a.symbol !== "GC=F";

      // Implication: if asset is up vs gold, what does that mean for gold?
      let implForGold = "";
      let implColor = "#f5c451";
      if (a.category === "Currency" && a.symbol === "DX-Y.NYB") {
        if (vsGold1M > 2) { implForGold = "DXY outperforming — gold headwind from strong dollar"; implColor = "#f87171"; }
        else if (vsGold1M < -2) { implForGold = "Gold strongly outperforming DXY — bullish divergence vs dollar"; implColor = "#34d399"; }
        else { implForGold = "DXY and gold moving in parallel — neutral"; implColor = "#f5c451"; }
      } else if (a.category === "Bonds") {
        if (vsGold1M > 3) { implForGold = "Bonds outperforming — flight-to-quality favoring duration over gold"; implColor = "#f87171"; }
        else if (vsGold1M < -3) { implForGold = "Gold outperforming bonds — gold preferred safe-haven asset"; implColor = "#34d399"; }
        else { implForGold = "Gold and bonds in similar performance range"; implColor = "#f5c451"; }
      } else if (a.category === "Equities") {
        if (vsGold1M > 5) { implForGold = "Risk assets outperforming — reduces gold safe-haven appeal"; implColor = "#fb923c"; }
        else if (vsGold1M < -5) { implForGold = "Gold outperforming equities — risk-off rotation supporting gold"; implColor = "#34d399"; }
        else { implForGold = "Gold keeping pace with equities — dual demand"; implColor = "#f5c451"; }
      } else if (a.category === "Crypto") {
        if (vsGold1M > 10) { implForGold = "Crypto outperforming — risk-on speculation reducing gold demand"; implColor = "#fb923c"; }
        else { implForGold = "Gold outperforming crypto — flight from speculative assets"; implColor = "#34d399"; }
      } else {
        implForGold = `${a.name} ${vsGold1M >= 0 ? "ahead" : "behind"} gold by ${Math.abs(vsGold1M).toFixed(1)}% (1M)`;
        implColor = vsGold1M < 0 ? "#34d399" : "#f87171";
      }

      return { symbol: a.symbol, name: a.name, category: a.category, change1W, change1M, change3M, change6M, change1Y, rank1M: 0, rank3M: 0, goldOutperforming1M, goldOutperforming3M, vsGold1M, vsGold3M, implForGold, implColor };
    }).filter(Boolean) as AssetPerformance[];

    // Rank assets by 1M and 3M
    const sorted1M = [...assets].sort((a, b) => b.change1M - a.change1M);
    const sorted3M = [...assets].sort((a, b) => b.change3M - a.change3M);
    assets.forEach(a => {
      a.rank1M = sorted1M.findIndex(s => s.symbol === a.symbol) + 1;
      a.rank3M = sorted3M.findIndex(s => s.symbol === a.symbol) + 1;
    });

    const goldAsset = assets.find(a => a.symbol === "GC=F");
    const goldRank1M = goldAsset?.rank1M ?? 1;
    const goldRank3M = goldAsset?.rank3M ?? 1;
    const totalAssets = assets.length;

    const goldOutperformsCount1M = assets.filter(a => a.symbol !== "GC=F" && goldChange1M > a.change1M).length;
    const goldOutperformsCount3M = assets.filter(a => a.symbol !== "GC=F" && goldChange3M > a.change3M).length;

    const topPerformers1M = sorted1M.slice(0, 3).map(a => a.symbol);
    const bottomPerformers1M = [...sorted1M].reverse().slice(0, 3).map(a => a.symbol);

    const pctRank = goldRank1M / totalAssets;
    let rsSignal: RelativeStrengthPayload["rsSignal"] = "neutral";
    let rsColor = "#f5c451";
    let rsLabel = "Neutral Relative Strength";
    if (pctRank <= 0.15) { rsSignal = "strong_outperform"; rsColor = "#34d399"; rsLabel = "Strong Outperformer"; }
    else if (pctRank <= 0.35) { rsSignal = "outperform"; rsColor = "#86efac"; rsLabel = "Outperforming"; }
    else if (pctRank >= 0.85) { rsSignal = "strong_underperform"; rsColor = "#f87171"; rsLabel = "Strong Underperformer"; }
    else if (pctRank >= 0.65) { rsSignal = "underperform"; rsColor = "#fb923c"; rsLabel = "Underperforming"; }

    const rsDescription = rsSignal === "strong_outperform"
      ? `Gold is rank #${goldRank1M}/${totalAssets} on 1M returns — dominating the asset class landscape. Institutional momentum buyers likely active.`
      : rsSignal === "outperform"
      ? `Gold ranks #${goldRank1M}/${totalAssets} on 1M performance — ahead of most alternative assets. Positive relative momentum.`
      : rsSignal === "neutral"
      ? `Gold ranks #${goldRank1M}/${totalAssets} — performing in line with the broad asset universe. No strong relative strength signal.`
      : rsSignal === "underperform"
      ? `Gold ranks #${goldRank1M}/${totalAssets} on 1M — lagging many alternative assets. Consider whether risk rotation explains the weakness.`
      : `Gold ranks #${goldRank1M}/${totalAssets} — significant underperformance vs asset universe. Review macro thesis for gold.`;

    const payload: RelativeStrengthPayload = {
      goldPrice, goldChange1W, goldChange1M, goldChange3M, goldChange6M,
      goldRank1M, goldRank3M, totalAssets, assets,
      topPerformers1M, bottomPerformers1M,
      goldOutperformsCount1M, goldOutperformsCount3M,
      rsSignal, rsColor, rsLabel, rsDescription,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("relative-strength error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
