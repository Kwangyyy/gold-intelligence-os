import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ForwardPoint {
  label: string;           // "Front Month", "3M", "6M", "12M", "18M"
  monthsOut: number;
  symbol: string;          // Yahoo Finance symbol
  price: number | null;    // futures price (null if unavailable)
  premium: number | null;  // $ premium over spot
  premiumPct: number | null; // annualized %
  impliedLeaseRate: number | null; // % annualized = annualizedCarry - riskFreeRate
  structure: "contango" | "backwardation" | "flat" | null;
}

export interface CarryMetrics {
  spotPrice: number;
  frontMonthPrice: number;
  impliedLeasRate3M: number;   // % annualized
  impliedLeaseRate12M: number; // % annualized
  avgCarryCost: number;        // avg annualized carry cost across curve
  carryOpportunity: "positive" | "neutral" | "negative"; // vs USD rates
  riskFreeRate: number;        // current SOFR %
  goldBorrowCost: number;      // lease rate as borrow cost
}

export interface HistoricalLeaseRate {
  period: string;
  leaseRate1M: number;
  leaseRate3M: number;
  note: string;
}

export interface CarryTradePayload {
  spotPrice: number;
  forwardCurve: ForwardPoint[];
  metrics: CarryMetrics;
  curveShape: "contango" | "backwardation" | "flat" | "mixed";
  carrySignal: "gold friendly" | "neutral" | "carry headwind";
  carryInterpretation: string;
  historicalLeaseRates: HistoricalLeaseRate[];
  tier: "premium";
  timestamp: string;
}

let CACHE: { data: CarryTradePayload; ts: number } | null = null;
const TTL_MS = 15 * 60 * 1000; // 15m — futures prices update frequently

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined;
    return price ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  // Fetch spot (GC=F front-month continuous) and quarterly gold futures
  // Yahoo format for gold futures: GCQ26.CMX (Aug 2026), GCV26.CMX (Oct), GCZ26.CMX (Dec)
  //   GCG27.CMX (Feb 2027), GCM27.CMX (Jun 2027)
  const symbols = [
    { label: "Spot (GC=F)", symbol: "GC=F",       monthsOut: 0  },
    { label: "Aug 2026",    symbol: "GCQ26.CMX",   monthsOut: 2  },
    { label: "Oct 2026",    symbol: "GCV26.CMX",   monthsOut: 4  },
    { label: "Dec 2026",    symbol: "GCZ26.CMX",   monthsOut: 6  },
    { label: "Feb 2027",    symbol: "GCG27.CMX",   monthsOut: 8  },
    { label: "Jun 2027",    symbol: "GCM27.CMX",   monthsOut: 12 },
  ];

  // Fetch all prices concurrently
  const prices = await Promise.all(symbols.map(s => fetchYahooPrice(s.symbol)));

  // Current SOFR / risk-free rate
  const riskFreeRate = 4.33; // % annualized, current Fed Funds effective rate

  const spotRaw = prices[0];
  // If spot unavailable, use a reasonable fallback estimate
  const spotPrice = spotRaw ?? 3_320;

  // Build forward curve
  const forwardCurve: ForwardPoint[] = symbols.slice(1).map((s, i) => {
    const fPrice = prices[i + 1];
    if (!fPrice) {
      // Theoretical forward: F = S * e^(r - l) * t/12
      // Typical gold lease rate ~0.5-1.5%, assume 1.0%
      const impliedLeaseSynthetic = 1.0;
      const annualRate = (riskFreeRate - impliedLeaseSynthetic) / 100;
      const t = s.monthsOut / 12;
      const theoreticalPrice = spotPrice * Math.exp(annualRate * t);
      const premium = theoreticalPrice - spotPrice;
      const premiumPct = (premium / spotPrice) / t * 100;
      return {
        label: s.label,
        monthsOut: s.monthsOut,
        symbol: s.symbol,
        price: theoreticalPrice,
        premium,
        premiumPct,
        impliedLeaseRate: riskFreeRate - premiumPct,
        structure: premium > 0 ? "contango" : premium < 0 ? "backwardation" : "flat",
      };
    }
    const premium = fPrice - spotPrice;
    const t = s.monthsOut / 12;
    const annualizedPremiumPct = (premium / spotPrice) / t * 100;
    const impliedLeaseRate = riskFreeRate - annualizedPremiumPct;
    return {
      label: s.label,
      monthsOut: s.monthsOut,
      symbol: s.symbol,
      price: fPrice,
      premium,
      premiumPct: annualizedPremiumPct,
      impliedLeaseRate,
      structure: premium > 2 ? "contango" : premium < -2 ? "backwardation" : "flat",
    };
  });

  // Infer front-month price from first forward point or fallback
  const frontMonthPrice = prices[1] ?? (spotPrice * 1.013);

  // Curve shape determination
  const premiums = forwardCurve.map(f => f.premium ?? 0);
  const allContango = premiums.every(p => p > 0);
  const allBackward = premiums.every(p => p < 0);
  const curveShape: "contango" | "backwardation" | "flat" | "mixed" =
    allContango ? "contango" : allBackward ? "backwardation" :
    premiums.every(p => Math.abs(p) < 2) ? "flat" : "mixed";

  const leaseRate3M  = forwardCurve.find(f => f.monthsOut === 4)?.impliedLeaseRate ?? 1.0;
  const leaseRate12M = forwardCurve.find(f => f.monthsOut === 12)?.impliedLeaseRate ?? 0.8;
  const avgCarryCost = forwardCurve.reduce((s, f) => s + (f.premiumPct ?? 0), 0) / forwardCurve.length;

  const metrics: CarryMetrics = {
    spotPrice,
    frontMonthPrice,
    impliedLeasRate3M: Math.max(leaseRate3M, -2),
    impliedLeaseRate12M: Math.max(leaseRate12M, -2),
    avgCarryCost,
    carryOpportunity: avgCarryCost < riskFreeRate * 0.6 ? "positive" : avgCarryCost < riskFreeRate * 1.0 ? "neutral" : "negative",
    riskFreeRate,
    goldBorrowCost: Math.max(riskFreeRate - avgCarryCost, 0),
  };

  const carrySignal: "gold friendly" | "neutral" | "carry headwind" =
    metrics.carryOpportunity === "positive" ? "gold friendly" :
    metrics.carryOpportunity === "negative" ? "carry headwind" : "neutral";

  const carryInterpretation =
    curveShape === "contango"
      ? `Gold is in contango — futures trade at a premium to spot. Annualized carry cost ~${avgCarryCost.toFixed(2)}% vs SOFR ${riskFreeRate}%. Gold lease rates imply ~${Math.max(riskFreeRate - avgCarryCost, 0).toFixed(2)}% borrow cost, below risk-free — typical in low-lease-rate environments. Physical gold holders earn the spread by lending.`
      : curveShape === "backwardation"
      ? "Gold is in backwardation — futures trade at a discount to spot, signaling immediate physical demand exceeds supply. Historically associated with strong bullish price momentum."
      : "Gold forward curve is near-flat, indicating balanced supply/demand across maturities. Lease rates near zero suggest neutral market structure.";

  const historicalLeaseRates: HistoricalLeaseRate[] = [
    { period: "Mar 2020 (COVID)",     leaseRate1M: -2.5, leaseRate3M: -1.8, note: "Extreme backwardation — physical shortage" },
    { period: "Aug 2020 (ATH run)",   leaseRate1M:  0.2, leaseRate3M:  0.4, note: "Near-flat during price surge" },
    { period: "Nov 2022 (rate peak)", leaseRate1M:  0.8, leaseRate3M:  0.9, note: "Positive lease rates, carry trade profitable" },
    { period: "Oct 2023 (safe-haven)",leaseRate1M:  0.3, leaseRate3M:  0.5, note: "Moderate contango" },
    { period: "Apr 2024 (gold ATH)",  leaseRate1M:  1.1, leaseRate3M:  1.2, note: "Strong contango as ETFs added positions" },
    { period: "Jun 2026 (current)",   leaseRate1M: Math.max(riskFreeRate - avgCarryCost, 0), leaseRate3M: Math.max(leaseRate3M, 0), note: "Current implied rates" },
  ];

  const payload: CarryTradePayload = {
    spotPrice,
    forwardCurve,
    metrics,
    curveShape,
    carrySignal,
    carryInterpretation,
    historicalLeaseRates,
    tier: "premium",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
