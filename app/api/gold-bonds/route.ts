import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface BondAsset {
  symbol: string;
  name: string;
  duration: string;     // e.g. "20Y"
  price: number;
  change1DPct: number;
  change1MPct: number;
  corrWithGold30D: number;
  corrWithGold90D: number;
  implication: string;
  implColor: string;
}

export interface GoldBondsPayload {
  goldPrice: number;
  goldChange1DPct: number;
  tipPrice: number;     // TIPS ETF (real yield proxy)
  tipChange1DPct: number;
  realYieldProxy: number;  // estimated from TIP price vs par
  realYieldSignal: "bullish" | "neutral" | "bearish";  // for gold
  bonds: BondAsset[];
  goldBondPortfolioCorr: number;  // gold correlation to blended bond portfolio
  hedgeScore: number;   // 0-100: how good is gold as bond portfolio hedge right now
  hedgeSignal: string;
  hedgeColor: string;
  tltGoldSpread1M: number;  // TLT perf minus gold perf (positive = bonds outperforming)
  overallSignal: "bonds_supportive" | "bonds_neutral" | "bonds_headwind";
  overallColor: string;
  overallLabel: string;
  overallDesc: string;
  bondReplacementNote: string;  // Is gold replacing bonds in portfolios?
  timestamp: string;
}

let CACHE: { data: GoldBondsPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30m

async function fetchDaily(symbol: string, range = "6mo"): Promise<{ price: number; change1D: number; closes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta ?? {};
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const price: number = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prev: number = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
    return { price, change1D: price - prev, closes };
  } catch { return null; }
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

function pctChange(closes: number[], n: number): number {
  if (closes.length < n + 1) return 0;
  const cur = closes[closes.length - 1];
  const past = closes[closes.length - 1 - n];
  return past > 0 ? ((cur - past) / past) * 100 : 0;
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldD, tltD, iefD, shyD, tipD, bndD] = await Promise.all([
      fetchDaily("GC=F", "6mo"),
      fetchDaily("TLT", "6mo"),    // 20Y Treasury Bond ETF
      fetchDaily("IEF", "6mo"),    // 7-10Y Treasury ETF
      fetchDaily("SHY", "6mo"),    // 1-3Y Short Duration
      fetchDaily("TIP", "6mo"),    // TIPS / real yield
      fetchDaily("BND", "6mo"),    // Total bond market
    ]);

    const goldPrice = goldD?.price ?? 3350;
    const goldPrev = goldD ? goldPrice - goldD.change1D : goldPrice;
    const goldChange1DPct = goldPrev > 0 ? (goldD!.change1D / goldPrev) * 100 : 0;
    const goldCloses = goldD?.closes ?? [goldPrice];
    const goldReturns = logReturns(goldCloses);

    const tipPrice = tipD?.price ?? 110;
    const tipPrev = tipD ? tipPrice - tipD.change1D : tipPrice;
    const tipChange1DPct = tipPrev > 0 ? (tipD!.change1D / tipPrev) * 100 : 0;

    // Real yield proxy: TIP ETF moves inverse to real yields. Par ~ $115 historically.
    // Simple proxy: if TIP < 108, real yields high (bearish gold); if TIP > 115, low (bullish)
    const realYieldProxy = tipPrice > 115 ? -0.5 : tipPrice > 111 ? 0 : tipPrice > 108 ? 0.8 : 1.5;
    const realYieldSignal: GoldBondsPayload["realYieldSignal"] =
      tipPrice > 112 ? "bullish" : tipPrice > 108 ? "neutral" : "bearish";

    const bondDefs = [
      { symbol: "TLT", name: "US 20Y Treasury (TLT)", duration: "20Y", data: tltD },
      { symbol: "IEF", name: "US 7-10Y Treasury (IEF)", duration: "7-10Y", data: iefD },
      { symbol: "SHY", name: "US 1-3Y Treasury (SHY)", duration: "1-3Y", data: shyD },
      { symbol: "TIP", name: "TIPS Real Yield ETF (TIP)", duration: "Inflation-linked", data: tipD },
      { symbol: "BND", name: "Total Bond Market (BND)", duration: "Mixed", data: bndD },
    ];

    const bonds: BondAsset[] = bondDefs.map(b => {
      const price = b.data?.price ?? 0;
      const change1D = b.data?.change1D ?? 0;
      const prev = b.data ? price - change1D : price;
      const change1DPct = prev > 0 && price > 0 ? (change1D / prev) * 100 : 0;
      const closes = b.data?.closes ?? [price];
      const change1MPct = pctChange(closes, 21);
      const returns = logReturns(closes);
      const corrWithGold30D = pearsonCorr(returns.slice(-30), goldReturns.slice(-30));
      const corrWithGold90D = pearsonCorr(returns, goldReturns);

      let implication = "";
      let implColor = "#f5c451";

      // TLT/IEF: positive corr with gold is unusual; gold often moves when bonds sell off
      // Normal: gold and long bonds both benefit from flight-to-safety, but can diverge on real yield changes
      if (b.symbol === "TIP") {
        implication = tipPrice > 112 ? "Low real yields — gold positive (TIPS rising)" : tipPrice < 108 ? "High real yields — gold headwind (TIPS falling)" : "Neutral real yield environment";
        implColor = tipPrice > 112 ? "#34d399" : tipPrice < 108 ? "#f87171" : "#f5c451";
      } else if (corrWithGold30D > 0.4) {
        implication = "Co-moving with gold — both in risk-off / flight-to-safety mode";
        implColor = "#34d399";
      } else if (corrWithGold30D < -0.3) {
        implication = "Diverging from gold — bonds rallying while gold pressured (or vice versa)";
        implColor = "#f87171";
      } else {
        implication = "Low correlation — gold and bonds moving independently this month";
        implColor = "#f5c451";
      }

      return {
        symbol: b.symbol,
        name: b.name,
        duration: b.duration,
        price: price || 0,
        change1DPct,
        change1MPct,
        corrWithGold30D,
        corrWithGold90D,
        implication,
        implColor,
      };
    });

    // Blended bond returns (simple average of available)
    const bondReturnsArrays = [tltD, iefD, bndD]
      .filter(Boolean)
      .map(d => logReturns(d!.closes));
    const minBondLen = bondReturnsArrays.length > 0 ? Math.min(...bondReturnsArrays.map(a => a.length)) : 0;
    const blendedBondReturns: number[] = [];
    for (let i = 0; i < minBondLen; i++) {
      const avg = bondReturnsArrays.reduce((s, a) => s + a[a.length - minBondLen + i], 0) / bondReturnsArrays.length;
      blendedBondReturns.push(avg);
    }

    const goldBondPortfolioCorr = blendedBondReturns.length > 5
      ? pearsonCorr(goldReturns.slice(-blendedBondReturns.length), blendedBondReturns)
      : 0;

    // Hedge score: gold as bond hedge is best when correlation < 0 (diversification)
    // or when real yields are low (TIP high) and bonds and gold both rise (crisis hedge)
    const hedgeScore = Math.max(0, Math.min(100, Math.round(
      50 +
      (goldBondPortfolioCorr < 0 ? Math.abs(goldBondPortfolioCorr) * 30 : -goldBondPortfolioCorr * 20) +
      (tipPrice > 112 ? 15 : tipPrice < 108 ? -15 : 0)
    )));

    const hedgeSignal = hedgeScore >= 70 ? "Strong portfolio hedge" : hedgeScore >= 50 ? "Moderate hedge" : "Weak hedge — correlated with bonds";
    const hedgeColor = hedgeScore >= 70 ? "#34d399" : hedgeScore >= 50 ? "#f5c451" : "#f87171";

    // TLT vs Gold 1M spread
    const tltChange1M = tltD ? pctChange(tltD.closes, 21) : 0;
    const goldChange1M = pctChange(goldCloses, 21);
    const tltGoldSpread1M = tltChange1M - goldChange1M;

    // Overall bond signal for gold
    const supportiveCount = bonds.filter(b => b.implColor === "#34d399").length;
    const headwindCount = bonds.filter(b => b.implColor === "#f87171").length;
    let overallSignal: GoldBondsPayload["overallSignal"] = "bonds_neutral";
    let overallColor = "#f5c451";
    let overallLabel = "Neutral Bond Environment";
    let overallDesc = "";

    if (supportiveCount >= 3 || realYieldSignal === "bullish") {
      overallSignal = "bonds_supportive";
      overallColor = "#34d399";
      overallLabel = "Bonds Supportive for Gold";
      overallDesc = "Bond market conditions (real yields, duration pricing) favor gold. Long-bond rally + low real yields = gold bullish macro backdrop.";
    } else if (headwindCount >= 3 || realYieldSignal === "bearish") {
      overallSignal = "bonds_headwind";
      overallColor = "#f87171";
      overallLabel = "Bond Market Headwind";
      overallDesc = "Rising real yields and bond sell-off pressure gold. Historically, sustained bond weakness creates headwinds for gold unless offset by dollar weakness or crisis demand.";
    } else {
      overallDesc = "Bond market is not sending a clear signal for gold. Watch TIP ETF direction and TLT vs gold spread for early trend clues.";
    }

    const bondReplacementNote = goldChange1M > tltChange1M + 2
      ? `Gold has outperformed 20Y Treasuries by ${(goldChange1M - tltChange1M).toFixed(1)}% this month — institutions may be rotating from bonds to gold as portfolio ballast.`
      : tltChange1M > goldChange1M + 2
      ? `20Y Treasuries outperformed gold by ${(tltChange1M - goldChange1M).toFixed(1)}% this month — bond prices rising suggests duration demand > gold safe-haven demand.`
      : `Gold and long-bonds have had similar performance this month (spread: ${tltGoldSpread1M.toFixed(1)}%) — complementary hedge roles intact.`;

    const payload: GoldBondsPayload = {
      goldPrice, goldChange1DPct,
      tipPrice, tipChange1DPct,
      realYieldProxy, realYieldSignal,
      bonds,
      goldBondPortfolioCorr,
      hedgeScore, hedgeSignal, hedgeColor,
      tltGoldSpread1M,
      overallSignal, overallColor, overallLabel, overallDesc,
      bondReplacementNote,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("gold-bonds error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
