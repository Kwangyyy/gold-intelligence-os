import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CopperGoldPayload {
  copperPrice: number;     // USD per lb
  goldPrice: number;       // USD per oz
  ratio: number;           // copper/gold × 10000 (normalized for readability)
  rawRatio: number;        // actual copper/gold ratio
  ratioMean90D: number;    // 90D moving average of ratio
  ratioPct90D: number;     // current vs 90D MA
  ratioTrend: "rising" | "falling" | "flat";
  economicSignal: "growth" | "neutral" | "recession_risk";
  signalColor: string;
  signalLabel: string;
  signalDescription: string;
  copperChange1DPct: number;
  goldChange1DPct: number;
  copperYTDPct: number;
  goldYTDPct: number;
  spxChange1DPct: number;
  spxCorr30D: number;       // copper-gold ratio correlation to SPX
  historicalContext: string;
  tradingImplication: string;
  ratioHistory: { date: string; ratio: number }[];  // last 30 points
  timestamp: string;
}

let CACHE: { data: CopperGoldPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

async function fetchOHLC(symbol: string, range = "6mo"): Promise<{ price: number; change1D: number; closes: number[]; timestamps: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta ?? {};
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const timestamps: number[] = r.timestamp ?? [];
    const price: number = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prev: number = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
    return { price, change1D: price - prev, closes, timestamps };
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

function pctChange(closes: number[], n: number): number {
  if (closes.length < n + 1) return 0;
  const cur = closes[closes.length - 1];
  const past = closes[closes.length - 1 - n];
  return past > 0 ? ((cur - past) / past) * 100 : 0;
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [copper, gold, spx] = await Promise.all([
      fetchOHLC("HG=F", "6mo"),   // COMEX copper futures
      fetchOHLC("GC=F", "6mo"),
      fetchOHLC("^GSPC", "6mo"),
    ]);

    const copperPrice = copper?.price ?? 4.2;  // price in USD per lb
    const goldPrice = gold?.price ?? 3350;
    const copperPrev = copper ? copperPrice - copper.change1D : copperPrice;
    const goldPrev = gold ? goldPrice - gold.change1D : goldPrice;
    const spxPrev = spx ? spx.price - spx.change1D : 5500;

    const copperChange1DPct = copperPrev > 0 ? (copper!.change1D / copperPrev) * 100 : 0;
    const goldChange1DPct = goldPrev > 0 ? (gold!.change1D / goldPrev) * 100 : 0;
    const spxChange1DPct = spxPrev > 0 ? ((spx!.price - spxPrev) / spxPrev) * 100 : 0;

    const copperCloses = copper?.closes ?? [copperPrice];
    const goldCloses = gold?.closes ?? [goldPrice];
    const spxCloses = spx?.closes ?? [spx?.price ?? 5500];
    const goldTimestamps = gold?.timestamps ?? [];

    // Build ratio history (matched length)
    const minLen = Math.min(copperCloses.length, goldCloses.length);
    const ratioCloses: number[] = [];
    const ratioHistory: { date: string; ratio: number }[] = [];
    for (let i = 0; i < minLen; i++) {
      const g = goldCloses[goldCloses.length - minLen + i];
      const c = copperCloses[copperCloses.length - minLen + i];
      const r = g > 0 ? (c / g) * 10000 : 0;
      ratioCloses.push(r);
      if (i >= minLen - 30) {
        const ts = goldTimestamps[goldTimestamps.length - minLen + i];
        ratioHistory.push({
          date: ts ? new Date(ts * 1000).toISOString().split("T")[0] : "",
          ratio: r,
        });
      }
    }

    const rawRatio = goldPrice > 0 ? copperPrice / goldPrice : 0;
    const ratio = rawRatio * 10000;

    // 90D mean of ratio
    const ratio90 = ratioCloses.slice(-90);
    const ratioMean90D = ratio90.length > 0 ? ratio90.reduce((a, b) => a + b) / ratio90.length : ratio;
    const ratioPct90D = ratioMean90D > 0 ? ((ratio - ratioMean90D) / ratioMean90D) * 100 : 0;

    // Ratio trend (compare last 10 vs prior 10)
    const r10 = ratioCloses.slice(-10);
    const r20 = ratioCloses.slice(-20, -10);
    const recent10 = r10.reduce((a, b) => a + b, 0) / (r10.length || 1);
    const prior10 = r20.reduce((a, b) => a + b, 0) / (r20.length || 1);
    const diff = prior10 > 0 ? (recent10 - prior10) / prior10 : 0;
    const ratioTrend: "rising" | "falling" | "flat" = diff > 0.02 ? "rising" : diff < -0.02 ? "falling" : "flat";

    // SPX correlation to copper-gold ratio (monthly returns)
    const ratioMonthly: number[] = [];
    const spxMonthly: number[] = [];
    for (let i = 1; i < Math.min(ratioCloses.length, spxCloses.length); i++) {
      const rPrev = ratioCloses[ratioCloses.length - i - 1];
      const rNow = ratioCloses[ratioCloses.length - i];
      if (rPrev > 0) ratioMonthly.push((rNow - rPrev) / rPrev);
      const sPrev = spxCloses[spxCloses.length - i - 1];
      const sNow = spxCloses[spxCloses.length - i];
      if (sPrev > 0) spxMonthly.push((sNow - sPrev) / sPrev);
    }
    const spxCorr30D = pearsonCorr(ratioMonthly.slice(-30), spxMonthly.slice(-30));

    // Economic signal
    let economicSignal: CopperGoldPayload["economicSignal"] = "neutral";
    let signalColor = "#f5c451";
    let signalLabel = "Neutral — Balanced";
    let signalDescription = "";

    if (ratioTrend === "rising" && ratio > ratioMean90D) {
      economicSignal = "growth";
      signalColor = "#34d399";
      signalLabel = "Growth Signal — Risk-On";
      signalDescription = "Copper outperforming gold signals improving growth expectations. Historically bullish for equities, potential headwind for gold as safe-haven demand wanes.";
    } else if (ratioTrend === "falling" && ratio < ratioMean90D) {
      economicSignal = "recession_risk";
      signalColor = "#f87171";
      signalLabel = "Recession Risk — Risk-Off";
      signalDescription = "Gold outperforming copper signals slowing growth expectations. Historically a leading indicator for economic weakness — supports gold's safe-haven role.";
    } else {
      signalDescription = "Copper/gold ratio near 90D average — balanced economic signals. Neither strong growth nor recession risk evident from this indicator alone.";
    }

    const copperYTDPct = pctChange(copperCloses, Math.min(126, copperCloses.length - 1));
    const goldYTDPct = pctChange(goldCloses, Math.min(126, goldCloses.length - 1));

    const historicalContext = ratioPct90D > 10
      ? `Ratio ${ratioPct90D.toFixed(1)}% above 90D average — elevated vs recent history. Copper strength may be signaling strong industrial demand or commodity cycle.`
      : ratioPct90D < -10
      ? `Ratio ${Math.abs(ratioPct90D).toFixed(1)}% below 90D average — gold gaining significant ground vs copper. Watch for confirmation from yield curve and credit spreads.`
      : `Ratio close to 90D average (${ratioPct90D > 0 ? "+" : ""}${ratioPct90D.toFixed(1)}%). No strong macro divergence signal from copper-gold alone.`;

    const tradingImplication = economicSignal === "growth"
      ? "Risk-on environment: copper leading suggests equities and risk assets favored. Gold may underperform vs stocks short-term but gold bull trend can persist if real yields stay low."
      : economicSignal === "recession_risk"
      ? "Risk-off environment: gold leading copper supports gold allocation. Consider reducing equity exposure and increasing gold/bonds as macro hedge."
      : "Monitor for breakout of range. A rising copper-gold ratio for 3+ weeks is a reliable early cycle indicator; a falling ratio for 3+ weeks supports gold.";

    const payload: CopperGoldPayload = {
      copperPrice, goldPrice, ratio, rawRatio, ratioMean90D, ratioPct90D,
      ratioTrend, economicSignal, signalColor, signalLabel, signalDescription,
      copperChange1DPct, goldChange1DPct, copperYTDPct, goldYTDPct,
      spxChange1DPct, spxCorr30D, historicalContext, tradingImplication,
      ratioHistory, timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("copper-gold error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
