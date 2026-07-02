import { NextResponse } from "next/server";

export const revalidate = 900; // 15-min cache

interface Driver {
  name: string;
  symbol: string;
  icon: string;
  price: number | null;
  change1d: number | null;
  goldCorr: "positive" | "inverse";
  attribution: number; // -100 to +100, contribution to gold move today
  signal: "bullish" | "neutral" | "bearish";
  description: string;
}

interface MacroDriversData {
  goldPrice: number;
  goldChange1d: number;
  totalAttribution: number;
  dominantDriver: string;
  regime: "inflation_driven" | "safe_haven" | "dollar_driven" | "rates_driven" | "mixed";
  regimeDescription: string;
  drivers: Driver[];
  insight: string;
  timestamp: string;
}

interface YFQuote {
  price: number | null;
  change: number | null;
}

async function fetchQuote(symbol: string): Promise<YFQuote> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return { price: null, change: null };
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? 0;
    const price = meta.regularMarketPrice ?? null;
    const change = price != null && prev ? ((price - prev) / prev) * 100 : null;
    return { price, change };
  } catch {
    return { price: null, change: null };
  }
}

function computeAttribution(
  assetChange: number | null,
  goldCorr: "positive" | "inverse",
  weight: number
): number {
  if (assetChange === null) return 0;
  // How much does this asset's move explain gold's move?
  const directional = goldCorr === "inverse" ? -assetChange : assetChange;
  return parseFloat((directional * weight).toFixed(2));
}

function getSignal(attribution: number): Driver["signal"] {
  if (attribution > 3) return "bullish";
  if (attribution < -3) return "bearish";
  return "neutral";
}

function detectRegime(drivers: Driver[]): MacroDriversData["regime"] {
  const inflation = drivers.find(d => d.name === "Inflation Expectations")?.attribution ?? 0;
  const realRates = drivers.find(d => d.name === "Real Rates (TIP)")?.attribution ?? 0;
  const dxy = drivers.find(d => d.name === "US Dollar (DXY)")?.attribution ?? 0;
  const riskOff = drivers.find(d => d.name === "Risk-Off (VIX)")?.attribution ?? 0;

  const magnitudes = [
    { key: "inflation_driven", val: Math.abs(inflation) },
    { key: "safe_haven", val: Math.abs(riskOff) },
    { key: "dollar_driven", val: Math.abs(dxy) },
    { key: "rates_driven", val: Math.abs(realRates) },
  ].sort((a, b) => b.val - a.val);

  if (magnitudes[0].val - magnitudes[1].val < 2) return "mixed";
  return magnitudes[0].key as MacroDriversData["regime"];
}

function regimeDescription(regime: MacroDriversData["regime"]): string {
  switch (regime) {
    case "inflation_driven":
      return "Gold is moving primarily on inflation expectations today — rising CPI bets, breakeven yields, and commodities are in the driver's seat.";
    case "safe_haven":
      return "Risk-off flows dominate. VIX spike or equity sell-off is pushing capital into gold as a safe haven.";
    case "dollar_driven":
      return "US dollar direction is the dominant macro force for gold today. DXY strength/weakness explains most of the price action.";
    case "rates_driven":
      return "Real interest rates are the key driver. Rising real yields pressure gold; falling real yields support it.";
    case "mixed":
      return "No single macro factor dominates. Gold is responding to a mix of inflation, rates, dollar, and risk sentiment.";
  }
}

export async function GET() {
  const [gold, dxy, vix, tip, tlt, spy] = await Promise.all([
    fetchQuote("GC=F"),
    fetchQuote("DX-Y.NYB"),
    fetchQuote("^VIX"),
    fetchQuote("TIP"),          // TIPS ETF as inflation proxy
    fetchQuote("TLT"),          // 20Y Treasury
    fetchQuote("SPY"),
  ]);

  const goldChg = gold.change ?? 0;

  const DRIVERS: Omit<Driver, "attribution" | "signal">[] = [
    {
      name: "US Dollar (DXY)",
      symbol: "DX-Y.NYB",
      icon: "💵",
      price: dxy.price,
      change1d: dxy.change,
      goldCorr: "inverse",
      description: "Stronger dollar makes gold more expensive in other currencies, pressuring price.",
    },
    {
      name: "Real Rates (TIP)",
      symbol: "TIP",
      icon: "📈",
      price: tip.price,
      change1d: tip.change,
      goldCorr: "positive",
      description: "Rising TIPS ETF = improving real yield expectations → pressure on gold (non-yielding asset).",
    },
    {
      name: "Risk-Off (VIX)",
      symbol: "^VIX",
      icon: "😨",
      price: vix.price,
      change1d: vix.change,
      goldCorr: "positive",
      description: "High VIX triggers safe-haven flows into gold. VIX spikes historically lift gold.",
    },
    {
      name: "Inflation Expectations",
      symbol: "TIP/TLT",
      icon: "🔥",
      price: tip.price && tlt.price ? parseFloat((tip.price / tlt.price).toFixed(4)) : null,
      change1d: tip.change && tlt.change ? parseFloat((tip.change - tlt.change).toFixed(2)) : null,
      goldCorr: "positive",
      description: "TIP vs TLT ratio proxies breakeven inflation. Higher inflation expectations = gold supportive.",
    },
    {
      name: "Equities (SPY)",
      symbol: "SPY",
      icon: "📊",
      price: spy.price,
      change1d: spy.change,
      goldCorr: "inverse",
      description: "Risk-on equity rallies can reduce safe-haven demand for gold. Inverse relationship strengthens in crises.",
    },
    {
      name: "Bond Markets (TLT)",
      symbol: "TLT",
      icon: "🏦",
      price: tlt.price,
      change1d: tlt.change,
      goldCorr: "positive",
      description: "Long-duration bonds and gold both benefit from recession fears and flight-to-safety.",
    },
  ];

  // Weights sum ≈ 1.0 — approximate macro attribution weights from academic research
  const WEIGHTS: Record<string, number> = {
    "US Dollar (DXY)": 0.30,
    "Real Rates (TIP)": 0.25,
    "Risk-Off (VIX)": 0.20,
    "Inflation Expectations": 0.15,
    "Equities (SPY)": 0.07,
    "Bond Markets (TLT)": 0.03,
  };

  const drivers: Driver[] = DRIVERS.map(d => {
    const attribution = computeAttribution(d.change1d, d.goldCorr, WEIGHTS[d.name] ?? 0.1);
    return { ...d, attribution, signal: getSignal(attribution) };
  });

  const regime = detectRegime(drivers);
  const dominantDriver = [...drivers].sort((a, b) => Math.abs(b.attribution) - Math.abs(a.attribution))[0];
  const totalAttribution = parseFloat(drivers.reduce((s, d) => s + d.attribution, 0).toFixed(2));

  const unexplained = parseFloat((goldChg - totalAttribution).toFixed(2));

  const data: MacroDriversData = {
    goldPrice: gold.price ?? 3320,
    goldChange1d: goldChg,
    totalAttribution,
    dominantDriver: dominantDriver.name,
    regime,
    regimeDescription: regimeDescription(regime),
    drivers,
    insight: `Macro model attributes ${totalAttribution >= 0 ? "+" : ""}${totalAttribution.toFixed(2)}% of gold's ${goldChg >= 0 ? "+" : ""}${goldChg.toFixed(2)}% move today. ` +
      `${dominantDriver.name} (${dominantDriver.attribution >= 0 ? "+" : ""}${dominantDriver.attribution.toFixed(2)}%) is the dominant driver. ` +
      (Math.abs(unexplained) > 0.5 ? `${Math.abs(unexplained).toFixed(2)}% is unexplained — possibly positioning flows or technical factors.` : "Model explains most of today's move."),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
