import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface RelativePerformance {
  label: string;
  days: number;
  goldPct: number;
  spxPct: number;
  ratioPct: number;  // (gold/spx) ratio change
  winner: "gold" | "equities" | "tied";
}

export interface GoldSP500Payload {
  goldPrice: number;
  spxPrice: number;
  goldSpxRatio: number;           // gold / (spx / 1000) — normalized
  ratioTrend: "gold_leading" | "equities_leading" | "flat";
  ratioTrendColor: string;
  pearsonCorr30D: number;
  pearsonCorr90D: number;
  corrRegime: "positive" | "negative" | "uncorrelated";
  corrDescription: string;
  relativePerformance: RelativePerformance[];
  favorGold: boolean;
  favorGoldReasons: string[];
  goldDefensiveScore: number;     // 0-100, how defensive environment is (high = favor gold)
  goldChangeToday: number;
  spxChangeToday: number;
  historicalContext: string;
  timestamp: string;
}

let CACHE: { data: GoldSP500Payload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

async function fetchOHLC(symbol: string): Promise<{ price: number; change1D: number; closes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`;
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
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  return vx === 0 || vy === 0 ? 0 : cov / Math.sqrt(vx * vy);
}

function logReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) r.push(Math.log(closes[i] / closes[i - 1]));
  return r;
}

function pctChange(closes: number[], n: number): number {
  if (closes.length < n + 1) return 0;
  return ((closes[closes.length - 1] - closes[closes.length - 1 - n]) / closes[closes.length - 1 - n]) * 100;
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldD, spxD, vixD] = await Promise.all([
      fetchOHLC("GC=F"),
      fetchOHLC("^GSPC"),
      fetchOHLC("^VIX"),
    ]);

    const goldPrice = goldD?.price ?? 3350;
    const spxPrice = spxD?.price ?? 5500;
    const goldPrev = goldD ? goldPrice - goldD.change1D : goldPrice;
    const spxPrev = spxD ? spxPrice - spxD.change1D : spxPrice;
    const goldChangeToday = goldD?.change1D ?? 0;
    const spxChangeToday = spxD?.change1D ?? 0;
    const vixLevel = vixD?.price ?? 18;

    // Ratio: gold / (spx/100) to get comparable scale
    const goldSpxRatio = spxPrice > 0 ? (goldPrice / spxPrice) * 100 : 0;

    // Returns for correlation
    const goldCloses = goldD?.closes ?? [goldPrice];
    const spxCloses = spxD?.closes ?? [spxPrice];
    const goldR = logReturns(goldCloses);
    const spxR = logReturns(spxCloses);

    const pearsonCorr30D = pearsonCorr(goldR.slice(-30), spxR.slice(-30));
    const pearsonCorr90D = pearsonCorr(goldR.slice(-90), spxR.slice(-90));

    const corrRegime: GoldSP500Payload["corrRegime"] =
      pearsonCorr30D > 0.4 ? "positive" : pearsonCorr30D < -0.2 ? "negative" : "uncorrelated";
    const corrDescription =
      corrRegime === "positive"
        ? "Gold and equities moving together — risk-on correlation. Gold acting more like risk asset than safe haven."
        : corrRegime === "negative"
        ? "Gold and equities diverging — gold acting as safe haven. Classic risk-off / flight to safety pattern."
        : "Low correlation — gold following its own drivers (yields, dollar, physical demand) independent of equities.";

    // Relative performance across time frames
    const periods = [
      { label: "Today", days: 1, goldPct: (goldChangeToday / goldPrev) * 100, spxPct: (spxChangeToday / spxPrev) * 100 },
      { label: "1 Week", days: 5, goldPct: pctChange(goldCloses, 5), spxPct: pctChange(spxCloses, 5) },
      { label: "1 Month", days: 21, goldPct: pctChange(goldCloses, 21), spxPct: pctChange(spxCloses, 21) },
      { label: "3 Months", days: 63, goldPct: pctChange(goldCloses, 63), spxPct: pctChange(spxCloses, 63) },
      { label: "6 Months", days: 126, goldPct: pctChange(goldCloses, 126), spxPct: pctChange(spxCloses, 126) },
    ];

    // GoldSpxRatio changes
    const relativePerformance: RelativePerformance[] = periods.map(p => {
      const nG = goldCloses.length >= p.days + 1 ? goldCloses[goldCloses.length - 1 - p.days] : goldPrev;
      const nS = spxCloses.length >= p.days + 1 ? spxCloses[spxCloses.length - 1 - p.days] : spxPrev;
      const ratioBefore = nS > 0 ? (nG / nS) * 100 : 0;
      const ratioCurrent = spxPrice > 0 ? (goldPrice / spxPrice) * 100 : 0;
      const ratioPct = ratioBefore > 0 ? ((ratioCurrent - ratioBefore) / ratioBefore) * 100 : 0;
      return {
        ...p,
        ratioPct,
        winner: ratioPct > 0.5 ? "gold" : ratioPct < -0.5 ? "equities" : "tied",
      };
    });

    // Ratio trend (30D)
    const ratioHistory: number[] = [];
    const minLen = Math.min(goldCloses.length, spxCloses.length);
    for (let i = Math.max(0, minLen - 30); i < minLen; i++) {
      const g = goldCloses[goldCloses.length - minLen + i];
      const s = spxCloses[spxCloses.length - minLen + i];
      if (s > 0) ratioHistory.push((g / s) * 100);
    }
    const ratioStart = ratioHistory[0] ?? goldSpxRatio;
    const ratioEnd = ratioHistory[ratioHistory.length - 1] ?? goldSpxRatio;
    const ratioDiff = ratioStart > 0 ? ((ratioEnd - ratioStart) / ratioStart) * 100 : 0;
    const ratioTrend: GoldSP500Payload["ratioTrend"] = ratioDiff > 2 ? "gold_leading" : ratioDiff < -2 ? "equities_leading" : "flat";
    const ratioTrendColor = ratioTrend === "gold_leading" ? "#34d399" : ratioTrend === "equities_leading" ? "#c084fc" : "#f5c451";

    // Gold defensive score
    let defensiveScore = 50;
    if (vixLevel > 25) defensiveScore += 20;
    else if (vixLevel < 14) defensiveScore -= 15;
    if (corrRegime === "negative") defensiveScore += 15;
    if (ratioTrend === "gold_leading") defensiveScore += 15;
    if (goldChangeToday > 0 && spxChangeToday < 0) defensiveScore += 10;
    defensiveScore = Math.min(100, Math.max(0, defensiveScore));

    const favorGoldReasons: string[] = [];
    if (ratioTrend === "gold_leading") favorGoldReasons.push("Gold/SPX ratio in uptrend — gold outperforming equities over 30 days");
    if (vixLevel > 20) favorGoldReasons.push(`Elevated VIX (${vixLevel.toFixed(0)}) — risk-off environment favors gold`);
    if (corrRegime === "negative") favorGoldReasons.push("Negative gold-equity correlation — classic defensive regime");
    if (relativePerformance[2]?.winner === "gold") favorGoldReasons.push("Gold outperforming SPX over 1 month");
    const favorGold = favorGoldReasons.length >= 2 && defensiveScore > 55;

    const historicalContext = goldSpxRatio > 0.06
      ? `Gold/SPX ratio (${goldSpxRatio.toFixed(2)}%) elevated — historically above 0.06 has marked gold bull peaks vs equities`
      : goldSpxRatio < 0.04
      ? `Gold/SPX ratio (${goldSpxRatio.toFixed(2)}%) compressed — historically cheap gold relative to equities`
      : `Gold/SPX ratio (${goldSpxRatio.toFixed(2)}%) in mid-range. Watch for breakout above 0.06 (gold bull) or below 0.04 (equity dominance).`;

    const payload: GoldSP500Payload = {
      goldPrice, spxPrice, goldSpxRatio, ratioTrend, ratioTrendColor,
      pearsonCorr30D, pearsonCorr90D, corrRegime, corrDescription,
      relativePerformance, favorGold, favorGoldReasons,
      goldDefensiveScore: defensiveScore,
      goldChangeToday: (goldChangeToday / goldPrev) * 100,
      spxChangeToday: (spxChangeToday / spxPrev) * 100,
      historicalContext,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("gold-sp500 error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
