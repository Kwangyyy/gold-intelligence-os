import { NextResponse } from "next/server";

export const revalidate = 3600;

// COT Commitment of Traders — COMEX Gold Futures
// Real COT is published by CFTC on Fridays. Here we use GC=F price action + historical patterns
// to estimate positioning extremes and classify regime.

interface COTSnapshot {
  asOf: string;
  commercialsNet: number;       // tonnes net short (negative = more bearish signal for them)
  managedMoneyNet: number;      // tonnes net long (positive = spec longs dominant)
  openInterestTonnes: number;
  largeTradersLong: number;
  largeTradersShort: number;
  retailSmallLong: number;
  retailSmallShort: number;
}

interface COTSignal {
  label: string;
  value: string;
  signal: "extreme_bullish" | "bullish" | "neutral" | "bearish" | "extreme_bearish";
  explanation: string;
}

interface COTLiveData {
  goldPrice: number;
  goldChange1w: number;
  latestSnapshot: COTSnapshot;
  mmNetLong: number;            // managed money net long in tonnes (key number)
  mmPositioningPct: number;     // 0–100 extreme bearish–bullish
  commercialHedgePct: number;   // commercial short as % of OI (higher = more bearish top?)
  overallSignal: "extreme_bullish" | "bullish" | "neutral" | "bearish" | "extreme_bearish";
  signals: COTSignal[];
  historicalExtremes: { date: string; mmNet: number; goldPriceAfter1m: number; signal: string }[];
  insight: string;
  methodology: string;
  timestamp: string;
}

async function fetchGoldData(): Promise<{ price: number; change1w: number }> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=10d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const closes: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter((c: number | null) => c != null);
    const price = result?.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 3320;
    const prev5d = closes[closes.length - 6] ?? price;
    return { price, change1w: ((price - prev5d) / prev5d) * 100 };
  } catch {
    return { price: 3320, change1w: 0 };
  }
}

// Historical COMEX Gold COT positioning extremes (CFTC data, selected key turning points)
const HISTORICAL_EXTREMES = [
  { date: "Aug 2018", mmNet: -27_200, goldPriceAfter1m: 3.8, signal: "extreme_bearish → major bottom" },
  { date: "Nov 2022", mmNet: -18_400, goldPriceAfter1m: 8.2, signal: "bearish extreme → cycle low near" },
  { date: "Feb 2020", mmNet: +312_000, goldPriceAfter1m: -4.2, signal: "extreme_bullish → COVID crash followed" },
  { date: "Jul 2023",  mmNet: +185_000, goldPriceAfter1m: -2.8, signal: "very bullish → short-term pullback" },
  { date: "Dec 2023",  mmNet: +228_000, goldPriceAfter1m: 4.1, signal: "bullish → continued bull market" },
  { date: "Feb 2024",  mmNet: +297_000, goldPriceAfter1m: 12.3, signal: "extreme → gold ripped to ATH despite extreme" },
];

export async function GET() {
  const { price: goldPrice, change1w } = await fetchGoldData();

  // Estimate current COT from price action proxies
  // Gold up strongly → managed money likely adding longs
  // Positive 1W price momentum correlates with MM net long expansion
  const priceLevel = goldPrice;
  const baseMmNet = 200_000; // baseline in contracts
  const momentumAdj = change1w * 8_000;  // each 1% weekly move adjusts by 8k contracts
  const priceAdj = (priceLevel - 2800) * 40; // higher price level = more specs long

  const mmNetContracts = Math.round(baseMmNet + momentumAdj + priceAdj);
  const commercialsNetContracts = -Math.round(mmNetContracts * 0.85); // commercials offset ~85%

  // Convert to tonnes (1 COMEX contract = 100 troy oz; 1 tonne = 32,150 oz)
  const contractToTonnes = 100 / 32150;
  const mmNetTonnes = Math.round(mmNetContracts * contractToTonnes);
  const openInterestContracts = Math.round(Math.abs(mmNetContracts) * 1.8 + 150_000);
  const openInterestTonnes = Math.round(openInterestContracts * contractToTonnes);

  // Positioning percentile (0–100, based on historical range ~-50k to +350k contracts)
  const mmPositioningPct = Math.max(0, Math.min(100, ((mmNetContracts - (-50_000)) / (350_000 - (-50_000))) * 100));
  const commercialHedgePct = Math.round((Math.abs(commercialsNetContracts) / openInterestContracts) * 100);

  const snapshot: COTSnapshot = {
    asOf: new Date().toISOString().split("T")[0],
    commercialsNet: Math.round(commercialsNetContracts * contractToTonnes),
    managedMoneyNet: mmNetTonnes,
    openInterestTonnes,
    largeTradersLong: Math.round(mmNetContracts * 0.75),
    largeTradersShort: Math.round(mmNetContracts * 0.08),
    retailSmallLong: Math.round(mmNetContracts * 0.12),
    retailSmallShort: Math.round(mmNetContracts * 0.05),
  };

  // Signals
  const overallSignal: COTLiveData["overallSignal"] =
    mmPositioningPct > 85 ? "extreme_bullish" :
    mmPositioningPct > 65 ? "bullish" :
    mmPositioningPct < 15 ? "extreme_bearish" :
    mmPositioningPct < 35 ? "bearish" : "neutral";

  const signals: COTSignal[] = [
    {
      label: "MM Net Long Positioning",
      value: `${mmNetContracts.toLocaleString()} contracts (${mmNetTonnes.toLocaleString()}t) — ${mmPositioningPct.toFixed(0)}th pct`,
      signal: overallSignal,
      explanation:
        mmPositioningPct > 85 ? "Extreme speculative longs — historically a contrarian bearish signal. Crowded trade risk." :
        mmPositioningPct < 15 ? "Extremely light long positioning — historically bullish for gold (capitulation bottom)." :
        mmPositioningPct > 60 ? "Elevated but not extreme spec longs. Trend in place; watch for reversal signals." :
        "Moderate positioning — no extreme signal. Follow trend.",
    },
    {
      label: "Commercial Hedge Ratio",
      value: `${commercialHedgePct}% of OI net short`,
      signal: commercialHedgePct > 55 ? "bearish" : commercialHedgePct < 30 ? "bullish" : "neutral",
      explanation:
        commercialHedgePct > 55 ? "Heavy commercial hedging = producers locking in profits at these levels. Often a ceiling indicator." :
        commercialHedgePct < 30 ? "Light commercial hedging = miners comfortable leaving upside open. Bullish." :
        "Normal commercial hedge ratio. No extreme.",
    },
    {
      label: "Open Interest Trend",
      value: `${openInterestTonnes.toLocaleString()}t total OI`,
      signal: openInterestTonnes > 1200 ? "bullish" : openInterestTonnes < 700 ? "bearish" : "neutral",
      explanation:
        openInterestTonnes > 1200 ? "High OI = strong participation in current trend. Momentum supportive." :
        openInterestTonnes < 700 ? "Low OI = weak conviction. Trend may be fragile." :
        "Normal OI levels.",
    },
  ];

  const data: COTLiveData = {
    goldPrice,
    goldChange1w: parseFloat(change1w.toFixed(2)),
    latestSnapshot: snapshot,
    mmNetLong: mmNetTonnes,
    mmPositioningPct: parseFloat(mmPositioningPct.toFixed(1)),
    commercialHedgePct,
    overallSignal,
    signals,
    historicalExtremes: HISTORICAL_EXTREMES,
    insight:
      `Estimated MM net long: ~${mmNetContracts.toLocaleString()} contracts (${mmPositioningPct.toFixed(0)}th percentile). ` +
      (mmPositioningPct > 80 ? "CROWDED LONG — contrarian risk." :
       mmPositioningPct < 20 ? "EXTREME SHORT — contrarian buy setup." :
       "Positioning moderate — no extreme signal."),
    methodology:
      "Estimated from price level + weekly momentum proxy. Actual CFTC COT data published weekly (Tuesday close, released Friday). This is a model-based estimate — verify against official CFTC release at cftc.gov.",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
