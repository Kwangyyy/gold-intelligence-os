import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface FairValuePoint {
  date: string;
  actualPrice: number;
  fairValue: number;
  premium: number;  // % above or below fair value
}

export interface DriverContribution {
  name: string;
  currentValue: string;
  contribution: number;  // $ contribution to fair value
  direction: "bullish" | "neutral" | "bearish";
  description: string;
}

export interface FairValuePayload {
  goldPrice: number;
  fairValue: number;
  premium: number;         // % above fair value (+) or discount (-) below
  premiumColor: string;
  verdict: "overvalued" | "fairly_valued" | "undervalued";
  verdictColor: string;
  verdictDescription: string;
  drivers: DriverContribution[];
  targetBull: number;
  targetBase: number;
  targetBear: number;
  historyPoints: FairValuePoint[];
  modelNote: string;
  rSquared: number;  // model R² (quality indicator)
  timestamp: string;
}

let CACHE: { data: FairValuePayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

async function fetchClose(symbol: string, range = "1y"): Promise<{ price: number; closes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
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

// Simple OLS regression: y = a + b1*x1 + b2*x2 + b3*x3
function multiRegression(y: number[], x1: number[], x2: number[], x3: number[]): { a: number; b1: number; b2: number; b3: number; rSq: number } {
  const n = Math.min(y.length, x1.length, x2.length, x3.length);
  if (n < 10) return { a: y[y.length - 1], b1: 0, b2: 0, b3: 0, rSq: 0 };

  // Using mean-centered approach for stability
  const ys = y.slice(-n), xs1 = x1.slice(-n), xs2 = x2.slice(-n), xs3 = x3.slice(-n);
  const meanY = ys.reduce((a, b) => a + b) / n;
  const meanX1 = xs1.reduce((a, b) => a + b) / n;
  const meanX2 = xs2.reduce((a, b) => a + b) / n;
  const meanX3 = xs3.reduce((a, b) => a + b) / n;

  // Build normal equations (simplified 3-variable OLS via gradient descent)
  // Using simple univariate betas as approximation (ignores cross-correlations)
  function univariateBeta(xArr: number[], yArr: number[], mx: number, my: number): number {
    let cov = 0, varX = 0;
    for (let i = 0; i < n; i++) { cov += (xArr[i] - mx) * (yArr[i] - my); varX += (xArr[i] - mx) ** 2; }
    return varX === 0 ? 0 : cov / varX;
  }

  const b1 = univariateBeta(xs1, ys, meanX1, meanY);
  const b2 = univariateBeta(xs2, ys, meanX2, meanY);
  const b3 = univariateBeta(xs3, ys, meanX3, meanY);
  const a = meanY - b1 * meanX1 - b2 * meanX2 - b3 * meanX3;

  // R²
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = a + b1 * xs1[i] + b2 * xs2[i] + b3 * xs3[i];
    ssTot += (ys[i] - meanY) ** 2;
    ssRes += (ys[i] - pred) ** 2;
  }
  const rSq = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;

  return { a, b1, b2, b3, rSq };
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldD, tipD, dxyD, vixD] = await Promise.all([
      fetchClose("GC=F", "2y"),
      fetchClose("TIP", "2y"),     // TIPS ETF as real yield proxy (inverse: higher TIP = lower real yield)
      fetchClose("DX-Y.NYB", "2y"),
      fetchClose("^VIX", "2y"),
    ]);

    const goldPrice = goldD?.price ?? 3350;
    const tipPrice = tipD?.price ?? 110;
    const dxyPrice = dxyD?.price ?? 104;
    const vixPrice = vixD?.price ?? 18;

    const goldCloses = goldD?.closes ?? [goldPrice];
    const tipCloses = tipD?.closes ?? [tipPrice];
    const dxyCloses = dxyD?.closes ?? [dxyPrice];
    const vixCloses = vixD?.closes ?? [vixPrice];

    // Align lengths
    const n = Math.min(goldCloses.length, tipCloses.length, dxyCloses.length, vixCloses.length);

    // Fit model: gold = a + b1*TIP + b2*DXY + b3*VIX
    const { a, b1, b2, b3, rSq } = multiRegression(
      goldCloses.slice(-n),
      tipCloses.slice(-n),
      dxyCloses.slice(-n),
      vixCloses.slice(-n)
    );

    // Current fair value
    const fairValue = a + b1 * tipPrice + b2 * dxyPrice + b3 * vixPrice;
    const premium = fairValue > 0 ? ((goldPrice - fairValue) / fairValue) * 100 : 0;

    const verdict: FairValuePayload["verdict"] = premium > 8 ? "overvalued" : premium < -8 ? "undervalued" : "fairly_valued";
    const verdictColor = verdict === "overvalued" ? "#f87171" : verdict === "undervalued" ? "#34d399" : "#f5c451";
    const verdictDescription = verdict === "overvalued"
      ? `Gold is trading ${premium.toFixed(1)}% above model fair value — elevated vs historical drivers. Expect mean reversion or fundamental shift needed to sustain current levels.`
      : verdict === "undervalued"
      ? `Gold is trading ${Math.abs(premium).toFixed(1)}% below model fair value — potentially cheap given current yields, dollar, and risk. Historical support level.`
      : `Gold is trading near model fair value (${premium >= 0 ? "+" : ""}${premium.toFixed(1)}% deviation) — fairly priced given the current macro environment.`;

    // Driver contributions
    const drivers: DriverContribution[] = [
      {
        name: "TIPS / Real Yield (TIP ETF)",
        currentValue: `$${tipPrice.toFixed(1)}`,
        contribution: b1 * tipPrice,
        direction: b1 > 0 ? (tipPrice > 110 ? "bullish" : "bearish") : (tipPrice > 110 ? "bearish" : "bullish"),
        description: `TIP at $${tipPrice.toFixed(1)} — ${tipPrice > 112 ? "low real yields (gold positive)" : tipPrice < 108 ? "high real yields (gold negative)" : "neutral real yields"}`,
      },
      {
        name: "US Dollar Index (DXY)",
        currentValue: dxyPrice.toFixed(1),
        contribution: b2 * dxyPrice,
        direction: b2 < 0 ? (dxyPrice > 106 ? "bearish" : "bullish") : "neutral",
        description: `DXY at ${dxyPrice.toFixed(1)} — ${dxyPrice > 106 ? "strong dollar headwind" : dxyPrice < 102 ? "weak dollar tailwind" : "neutral range"}`,
      },
      {
        name: "VIX (Market Fear Index)",
        currentValue: vixPrice.toFixed(1),
        contribution: b3 * vixPrice,
        direction: b3 > 0 ? (vixPrice > 20 ? "bullish" : "neutral") : "neutral",
        description: `VIX at ${vixPrice.toFixed(1)} — ${vixPrice > 25 ? "elevated fear, gold safe-haven bid" : vixPrice < 14 ? "low fear, gold demand limited" : "moderate risk level"}`,
      },
      {
        name: "Intercept / Base Level",
        currentValue: `$${a.toFixed(0)}`,
        contribution: a,
        direction: "neutral",
        description: "Long-run structural gold level not explained by current model variables",
      },
    ];

    // Price targets
    const stdDev = (() => {
      const fvHist = goldCloses.slice(-n).map((g, i) =>
        g - (a + b1 * tipCloses.slice(-n)[i] + b2 * dxyCloses.slice(-n)[i] + b3 * vixCloses.slice(-n)[i])
      );
      const mean = fvHist.reduce((s, x) => s + x, 0) / fvHist.length;
      return Math.sqrt(fvHist.reduce((s, x) => s + (x - mean) ** 2, 0) / fvHist.length);
    })();

    const targetBull = fairValue + 1.5 * stdDev;
    const targetBase = fairValue;
    const targetBear = fairValue - 1.5 * stdDev;

    // History points (last 30D)
    const histLen = Math.min(30, n);
    const historyPoints: FairValuePoint[] = [];
    for (let i = n - histLen; i < n; i++) {
      const g = goldCloses[goldCloses.length - n + i];
      const fv = a + b1 * tipCloses.slice(-n)[i] + b2 * dxyCloses.slice(-n)[i] + b3 * vixCloses.slice(-n)[i];
      const prem = fv > 0 ? ((g - fv) / fv) * 100 : 0;
      historyPoints.push({ date: "", actualPrice: g, fairValue: fv, premium: prem });
    }

    const premiumColor = premium > 8 ? "#f87171" : premium > 3 ? "#fb923c" : premium < -8 ? "#34d399" : premium < -3 ? "#86efac" : "#f5c451";

    const modelNote = `3-factor regression model: Gold ~ TIP ETF (real yields) + DXY (dollar) + VIX (fear). R² = ${(rSq * 100).toFixed(0)}% — ${rSq > 0.7 ? "good" : rSq > 0.5 ? "moderate" : "low"} explanatory power. Model updated every hour.`;

    const payload: FairValuePayload = {
      goldPrice, fairValue: Math.round(fairValue), premium,
      premiumColor, verdict, verdictColor, verdictDescription,
      drivers, targetBull: Math.round(targetBull), targetBase: Math.round(targetBase),
      targetBear: Math.round(targetBear), historyPoints, modelNote, rSquared: rSq,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("fair-value error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
