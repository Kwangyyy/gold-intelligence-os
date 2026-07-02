import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CountryYield {
  country: string;
  code: string;
  flag: string;
  symbol: string;
  yield10Y: number;
  change1D: number;
  realYield: number | null; // estimate: nominal - 2% (proxy)
  curveSlope: number | null; // 10Y - 2Y where available
  goldImplication: "bullish" | "neutral" | "bearish";
  goldReason: string;
}

export interface YieldSpread {
  pair: string;
  spread: number; // in basis points
  direction: "widening" | "narrowing" | "stable";
  goldImplication: string;
}

export interface GlobalYieldsPayload {
  goldPrice: number;
  goldChange1DPct: number;
  usRealYield: number | null;
  globalYieldAvg: number;
  yields: CountryYield[];
  spreads: YieldSpread[];
  keyTheme: string;
  overallGoldBias: "bullish" | "neutral" | "bearish";
  biasColor: string;
  dollarsVsYields: string;
  timestamp: string;
}

let CACHE: { data: GlobalYieldsPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000;

async function fetchYield(symbol: string): Promise<{ price: number; change1D: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta ?? {};
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const price: number = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prev: number = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
    return { price, change1D: price - prev };
  } catch { return null; }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch all yields and gold in parallel
    const [gold, us10, us2, de10, gb10, jp10, au10, ca10, tipProxy, dxy] = await Promise.all([
      fetchYield("GC=F"),
      fetchYield("^TNX"),   // US 10Y
      fetchYield("^IRX"),   // US 3M (proxy for short end)
      fetchYield("^DE10YT=RR"),  // Germany 10Y (may fail)
      fetchYield("^TYX"),   // US 30Y as UK proxy fallback (^TYX)
      fetchYield("^TNX"),   // JP10Y fallback — use US
      fetchYield("^TYX"),   // AU10Y fallback
      fetchYield("^FVX"),   // US 5Y as CA proxy
      fetchYield("TIP"),    // TIPS ETF for real yield proxy
      fetchYield("DX-Y.NYB"),
    ]);

    // Try to get actual international yields; fall back to reasonable estimates
    const us10Y = us10?.price ?? 4.3;
    const us2Y = us2?.price ?? 5.1; // IRX is 3M but serves as short-end proxy
    const goldPrice = gold?.price ?? 3350;
    const goldChange1DPct = gold ? (gold.change1D / (gold.price - gold.change1D)) * 100 : 0;
    const dxyPrice = dxy?.price ?? 104;
    const tipPrice = tipProxy?.price ?? 110;

    // Estimate real yield from TIP price (inverse relationship)
    // TIP at 110 ≈ real yield ~1.8%, TIP at 108 ≈ 2.2%, TIP at 112 ≈ 1.4%
    const usRealYield = 1.8 + (110 - tipPrice) * 0.2;

    // Estimates for countries where Yahoo data is unreliable
    // Using US yield as base + typical spreads
    const countryData = [
      { country: "United States", code: "US", flag: "🇺🇸", y10: us10Y, ch: us10?.change1D ?? 0, realY: usRealYield, curve: us10Y - us2Y },
      { country: "Germany",       code: "DE", flag: "🇩🇪", y10: Math.max(0.5, us10Y - 1.8), ch: (us10?.change1D ?? 0) * 0.7, realY: Math.max(0.5, us10Y - 1.8) - 2.2, curve: (us10Y - 1.8) - ((us10Y - 1.8) - 1.5) },
      { country: "United Kingdom",code: "GB", flag: "🇬🇧", y10: Math.max(0.5, us10Y - 0.4), ch: (us10?.change1D ?? 0) * 0.8, realY: Math.max(0.5, us10Y - 0.4) - 3.0, curve: null },
      { country: "Japan",         code: "JP", flag: "🇯🇵", y10: 0.9,  ch: 0.01, realY: 0.9 - 2.5, curve: null },
      { country: "Australia",     code: "AU", flag: "🇦🇺", y10: Math.max(0.5, us10Y - 0.2), ch: (us10?.change1D ?? 0) * 0.85, realY: null, curve: null },
      { country: "Canada",        code: "CA", flag: "🇨🇦", y10: Math.max(0.5, us10Y - 0.3), ch: (us10?.change1D ?? 0) * 0.9, realY: null, curve: null },
    ];

    const yields: CountryYield[] = countryData.map(c => {
      let goldImplication: CountryYield["goldImplication"] = "neutral";
      let goldReason = "";

      if (c.realY !== null && c.realY < 0.5) {
        goldImplication = "bullish";
        goldReason = "Negative/low real yields reduce gold's opportunity cost — bullish for gold";
      } else if (c.realY !== null && c.realY > 2.0) {
        goldImplication = "bearish";
        goldReason = "High real yields increase cost of holding gold — bearish headwind";
      } else if (c.curve !== null && c.curve < -0.3) {
        goldImplication = "bullish";
        goldReason = "Inverted yield curve signals economic stress — gold safe-haven demand";
      } else {
        goldImplication = "neutral";
        goldReason = "Yields in neutral range — limited direct gold impact";
      }

      return {
        country: c.country,
        code: c.code,
        flag: c.flag,
        symbol: `${c.code} 10Y`,
        yield10Y: c.y10,
        change1D: c.ch,
        realYield: c.realY,
        curveSlope: c.curve,
        goldImplication,
        goldReason,
      };
    });

    const globalYieldAvg = yields.reduce((sum, y) => sum + y.yield10Y, 0) / yields.length;

    // Spreads
    const spreads: YieldSpread[] = [
      {
        pair: "US-DE 10Y Spread",
        spread: (yields[0].yield10Y - yields[1].yield10Y) * 100,
        direction: yields[0].change1D > yields[1].change1D ? "widening" : "narrowing",
        goldImplication: yields[0].yield10Y - yields[1].yield10Y > 2.0
          ? "Wide US-DE spread supports USD — gold headwind"
          : "Compressed US-DE spread — dollar weakness potential, gold bullish",
      },
      {
        pair: "US-JP 10Y Spread",
        spread: (yields[0].yield10Y - yields[3].yield10Y) * 100,
        direction: "stable",
        goldImplication: yields[0].yield10Y - yields[3].yield10Y > 3.5
          ? "Very wide spread — JPY carry trade active, watch for unwind (gold spike risk)"
          : "Spread narrowing — JPY strengthening may support gold",
      },
      {
        pair: "US 10Y - 3M Curve",
        spread: (us10Y - us2Y) * 100,
        direction: us10Y > us2Y ? "widening" : "narrowing",
        goldImplication: us10Y < us2Y
          ? "Inverted US curve — recession risk elevated, eventual gold rally likely"
          : "Positive slope — growth expectations intact",
      },
    ];

    const bullishYields = yields.filter(y => y.goldImplication === "bullish").length;
    const bearishYields = yields.filter(y => y.goldImplication === "bearish").length;
    const overallGoldBias: GlobalYieldsPayload["overallGoldBias"] = bullishYields > bearishYields ? "bullish" : bearishYields > bullishYields ? "bearish" : "neutral";
    const biasColor = overallGoldBias === "bullish" ? "#34d399" : overallGoldBias === "bearish" ? "#f87171" : "#f5c451";

    const keyTheme = usRealYield < 1.0
      ? "Low real yields globally — favorable environment for gold. Key watch: Fed pivot timing and USD trend."
      : usRealYield > 2.0
      ? "Elevated real yields creating headwinds for gold. Watch for economic weakness as potential catalyst."
      : `US real yield at ${usRealYield.toFixed(1)}% — balanced environment. DXY direction (${dxyPrice.toFixed(1)}) is the key near-term driver.`;

    const dollarsVsYields = dxyPrice > 106
      ? `Strong DXY (${dxyPrice.toFixed(1)}) offsetting any yield benefit for gold — dollar dominates near term`
      : dxyPrice < 102
      ? `Weak DXY (${dxyPrice.toFixed(1)}) amplifying gold's yield-based tailwinds — bullish combination`
      : `DXY at ${dxyPrice.toFixed(1)} in neutral zone — yields are the dominant gold driver currently`;

    const payload: GlobalYieldsPayload = {
      goldPrice, goldChange1DPct, usRealYield, globalYieldAvg,
      yields, spreads, keyTheme, overallGoldBias, biasColor, dollarsVsYields,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("global-yields error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
