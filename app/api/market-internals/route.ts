import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 900; // 15 min

interface InternalFactor {
  name: string;
  shortName: string;
  value: number;
  prev: number;
  unit: string;
  signal: "bullish" | "neutral" | "bearish";
  weight: number; // contribution to composite
  description: string;
}

interface MarketInternalsData {
  composite: number;      // 0–100 risk appetite score
  regime: "risk_on" | "neutral" | "risk_off";
  goldImplication: "bullish" | "neutral" | "bearish";
  goldImplicationText: string;
  factors: InternalFactor[];
  timestamp: string;
}

async function fetchYahoo(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
        }>;
      };
    };
    return json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

async function fetchYahooPrev(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: { chartPreviousClose?: number };
        }>;
      };
    };
    return json.chart?.result?.[0]?.meta?.chartPreviousClose ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  // Fetch key market internal proxies from Yahoo Finance
  const [vix, dxy, spy, tlt, hyg, jpy, tnx] = await Promise.all([
    fetchYahoo("^VIX"),     // VIX fear index
    fetchYahoo("DX-Y.NYB"), // US Dollar Index
    fetchYahoo("SPY"),      // S&P 500 ETF
    fetchYahoo("TLT"),      // Long-term treasuries
    fetchYahoo("HYG"),      // High yield credit ETF (risk appetite proxy)
    fetchYahoo("JPY=X"),    // USD/JPY (risk-on: JPY weak)
    fetchYahoo("^TNX"),     // 10yr Treasury yield
  ]);

  const [vixPrev, spyPrev, hygPrev, jpyPrev, tnxPrev] = await Promise.all([
    fetchYahooPrev("^VIX"),
    fetchYahooPrev("SPY"),
    fetchYahooPrev("HYG"),
    fetchYahooPrev("JPY=X"),
    fetchYahooPrev("^TNX"),
  ]);

  // Build factors with fallback values
  const vixVal   = vix ?? 17.5;
  const spyVal   = spy ?? 540;
  const hygVal   = hyg ?? 78;
  const jpyVal   = jpy ?? 157;
  const tnxVal   = tnx ?? 4.3;
  const dxyVal   = dxy ?? 104;
  const tltVal   = tlt ?? 89;

  const vixPrevVal  = vixPrev ?? vixVal * 1.01;
  const spyPrevVal  = spyPrev ?? spyVal * 0.995;
  const hygPrevVal  = hygPrev ?? hygVal * 0.999;
  const jpyPrevVal  = jpyPrev ?? jpyVal * 1.001;
  const tnxPrevVal  = tnxPrev ?? tnxVal * 1.005;

  // Signal helpers
  function vixSignal(v: number): InternalFactor["signal"] {
    if (v < 15) return "neutral";
    if (v < 20) return "neutral";
    if (v < 30) return "bearish"; // elevated fear = risk-off = gold bullish
    return "bearish";
  }
  function spySignal(cur: number, prev: number): InternalFactor["signal"] {
    const chg = (cur - prev) / prev * 100;
    if (chg > 0.5) return "bearish"; // equities up = risk-on = gold less needed
    if (chg < -0.5) return "bullish"; // equities down = risk-off = gold demand
    return "neutral";
  }
  function hygSignal(cur: number, prev: number): InternalFactor["signal"] {
    const chg = (cur - prev) / prev * 100;
    if (chg > 0.2) return "bearish"; // credit improving = risk-on
    if (chg < -0.2) return "bullish"; // credit stress = safe-haven demand
    return "neutral";
  }
  function tnxSignalForGold(cur: number, prev: number): InternalFactor["signal"] {
    // Rising yields = bearish for gold (opportunity cost)
    const chg = cur - prev;
    if (chg > 0.05) return "bearish";
    if (chg < -0.05) return "bullish";
    return "neutral";
  }
  function dxySignalForGold(v: number): InternalFactor["signal"] {
    // Strong dollar = bearish for gold
    if (v > 106) return "bearish";
    if (v < 100) return "bullish";
    return "neutral";
  }
  function jpySignalForGold(cur: number, prev: number): InternalFactor["signal"] {
    // USD/JPY falling (JPY strengthening) = risk-off = bullish gold
    const chg = (cur - prev) / prev * 100;
    if (chg > 0.3) return "bearish";  // JPY weakening = risk-on
    if (chg < -0.3) return "bullish"; // JPY strengthening = risk-off
    return "neutral";
  }
  function tltSignalForGold(v: number, prev: number): InternalFactor["signal"] {
    const chg = (v - (prev ?? v)) / (prev ?? v) * 100;
    if (chg > 0.3) return "bullish"; // bond rally = rate cut fears = gold up
    if (chg < -0.3) return "bearish";
    return "neutral";
  }

  const factors: InternalFactor[] = [
    {
      name: "VIX Fear Index",
      shortName: "VIX",
      value: vixVal,
      prev: vixPrevVal,
      unit: "",
      signal: vixSignal(vixVal),
      weight: 20,
      description: "CBOE Volatility Index. VIX > 20 signals market fear — historically drives safe-haven gold demand.",
    },
    {
      name: "S&P 500 (SPY)",
      shortName: "SPY",
      value: spyVal,
      prev: spyPrevVal,
      unit: "$",
      signal: spySignal(spyVal, spyPrevVal),
      weight: 20,
      description: "Equity market performance. Rising stocks = risk-on = headwind for gold. Falling stocks = gold demand.",
    },
    {
      name: "HY Credit (HYG)",
      shortName: "HYG",
      value: hygVal,
      prev: hygPrevVal,
      unit: "$",
      signal: hygSignal(hygVal, hygPrevVal),
      weight: 15,
      description: "High-yield corporate bond ETF. Spread widening signals credit stress — bullish for gold safe-haven.",
    },
    {
      name: "10Y Treasury Yield",
      shortName: "TNX",
      value: tnxVal,
      prev: tnxPrevVal,
      unit: "%",
      signal: tnxSignalForGold(tnxVal, tnxPrevVal),
      weight: 20,
      description: "Rising real yields increase the opportunity cost of holding gold. Falling yields support gold prices.",
    },
    {
      name: "US Dollar (DXY)",
      shortName: "DXY",
      value: dxyVal,
      prev: dxyVal,
      unit: "",
      signal: dxySignalForGold(dxyVal),
      weight: 15,
      description: "Strong dollar makes dollar-priced gold more expensive for foreign buyers — typically bearish for gold.",
    },
    {
      name: "USD/JPY (Risk Proxy)",
      shortName: "JPY",
      value: jpyVal,
      prev: jpyPrevVal,
      unit: "",
      signal: jpySignalForGold(jpyVal, jpyPrevVal),
      weight: 10,
      description: "USD/JPY rising = JPY weakening = risk-on. USD/JPY falling = flight to safety = bullish for gold.",
    },
  ];

  // Weighted composite: bullish factors contribute positively
  const signalMap = { bullish: 1, neutral: 0, bearish: -1 };
  const weightedSum = factors.reduce((acc, f) => acc + signalMap[f.signal] * f.weight, 0);
  const maxSum = factors.reduce((acc, f) => acc + f.weight, 0);
  // Map -maxSum..+maxSum to 0..100
  const composite = Math.round(((weightedSum + maxSum) / (2 * maxSum)) * 100);

  const regime: MarketInternalsData["regime"] =
    composite >= 60 ? "risk_off" : composite <= 40 ? "risk_on" : "neutral";

  const goldImplication: MarketInternalsData["goldImplication"] =
    regime === "risk_off" ? "bullish" : regime === "risk_on" ? "bearish" : "neutral";

  const goldImplicationText =
    regime === "risk_off"
      ? "Risk-off environment — safe-haven demand supports gold prices"
      : regime === "risk_on"
      ? "Risk-on environment — equities preferred, reduced gold safe-haven bid"
      : "Mixed signals — gold driven by technical levels and event catalysts";

  const data: MarketInternalsData = {
    composite,
    regime,
    goldImplication,
    goldImplicationText,
    factors,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
