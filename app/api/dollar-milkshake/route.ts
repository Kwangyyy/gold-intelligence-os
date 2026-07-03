import { NextResponse } from "next/server";

export const revalidate = 900;

// Dollar Milkshake Theory: strong USD sucks capital from EM, leading to EM crises and eventually a reflexive dollar collapse that supercharges gold.
// This tracks USD strength + EM stress + the theory's "critical threshold" indicators.

interface DollarMilkshakeData {
  dxy: number;
  dxyChange1m: number;
  dxyChange3m: number;
  dxy5yHigh: number;
  dxyPctFrom5yHigh: number;
  emStressIndex: number; // 0–100
  eurodollarProxy: number; // TLT as proxy for dollar demand
  capitalFlowSignal: "dollar_inflow" | "neutral" | "dollar_outflow";
  theoryPhase: "early_suck" | "peak_dollar" | "reversal_watch" | "dollar_crisis" | "gold_rip";
  phaseDescription: string;
  goldImplication: string;
  indicators: {
    name: string;
    value: string;
    signal: "bullish_gold" | "bearish_gold" | "neutral";
    description: string;
  }[];
  insight: string;
  timestamp: string;
}

async function fetchPrice(symbol: string, range = "3mo"): Promise<{ price: number; change1m: number; change3m: number }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=${range}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const closes: number[] = (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c: number | null) => c != null);
    const price = closes[closes.length - 1] ?? 0;
    const prev1m = closes[closes.length - 2] ?? price;
    const prev3m = closes[closes.length - 4] ?? price;
    return {
      price,
      change1m: prev1m ? ((price - prev1m) / prev1m) * 100 : 0,
      change3m: prev3m ? ((price - prev3m) / prev3m) * 100 : 0,
    };
  } catch {
    return { price: 0, change1m: 0, change3m: 0 };
  }
}

async function fetchDXY5yHigh(): Promise<number> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1mo&range=5y",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const highs: number[] = (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.high ?? []).filter((h: number | null) => h != null);
    return highs.length ? Math.max(...highs) : 114;
  } catch {
    return 114;
  }
}

export async function GET() {
  const [dxyData, tltData, tryData, embdData] = await Promise.all([
    fetchPrice("DX-Y.NYB", "3mo"),
    fetchPrice("TLT", "3mo"),
    fetchPrice("TRY=X", "3mo"),      // USD/TRY — EM proxy
    fetchPrice("EEM", "3mo"),         // EM equities proxy
  ]);
  const dxy5yHigh = await fetchDXY5yHigh();

  const dxy = dxyData.price || 104;
  const dxyPctFrom5yHigh = ((dxy - dxy5yHigh) / dxy5yHigh) * 100;

  // EM stress: TRY weakening (positive change = USD stronger = more stress)
  const tryWeakening = tryData.change1m > 0 ? Math.min(100, tryData.change1m * 10) : 0;
  // EM equities pressure
  const emEquitiesDown = embdData.change1m < 0 ? Math.min(50, Math.abs(embdData.change1m) * 5) : 0;
  const emStressIndex = Math.round(Math.min(100, tryWeakening + emEquitiesDown + (dxyData.change1m > 0 ? dxyData.change1m * 3 : 0)));

  const capitalFlowSignal: DollarMilkshakeData["capitalFlowSignal"] =
    dxyData.change1m > 1 ? "dollar_inflow" :
    dxyData.change1m < -1 ? "dollar_outflow" : "neutral";

  // Theory phase classification
  let theoryPhase: DollarMilkshakeData["theoryPhase"];
  let phaseDescription: string;
  let goldImplication: string;

  if (dxypctFromHighAbove(dxyPctFrom5yHigh, -5) && dxyData.change3m > 0) {
    theoryPhase = "early_suck";
    phaseDescription = "Dollar near multi-year highs and still strengthening. USD is 'sucking' capital from global markets. EM currencies under pressure. Gold may temporarily struggle against the strong USD.";
    goldImplication = "Near-term gold headwind. Wait for the reversal setup. Accumulate gold on weakness.";
  } else if (dxypctFromHighAbove(dxyPctFrom5yHigh, -8) && dxyData.change1m < 0) {
    theoryPhase = "reversal_watch";
    phaseDescription = "Dollar peaked and beginning to roll over. This is often the KEY inflection point — as the USD reversal accelerates, gold historically surges as trapped EM capital repatriates.";
    goldImplication = "EXTREMELY BULLISH for gold. Dollar peak → gold surge historically. High-probability long setup.";
  } else if (dxyData.change3m < -3) {
    theoryPhase = "gold_rip";
    phaseDescription = "Dollar in clear downtrend (3M −3%+). Gold in full acceleration phase. EM relief, Fed policy shift, or geopolitical catalyst driving the dollar down and gold up.";
    goldImplication = "MAXIMUM BULLISH. Ride the gold rally. The milkshake is reversing — gold ripping.";
  } else {
    theoryPhase = "peak_dollar";
    phaseDescription = "Dollar elevated but momentum slowing. Classic late-cycle setup. Watch for a catalyst — rate pivot, debt crisis, or geopolitical shock — to trigger the reversal and gold surge.";
    goldImplication = "Bullish medium-term. Building position as dollar struggles to make new highs is optimal entry.";
  }

  const indicators: DollarMilkshakeData["indicators"] = [
    {
      name: "DXY (USD Index)",
      value: `${dxy.toFixed(2)} (${dxyData.change1m >= 0 ? "+" : ""}${dxyData.change1m.toFixed(2)}% 1M)`,
      signal: dxyData.change1m > 1 ? "bearish_gold" : dxyData.change1m < -1 ? "bullish_gold" : "neutral",
      description: "Strong/rising DXY = headwind for gold. Falling DXY = gold tailwind.",
    },
    {
      name: "DXY vs 5Y High",
      value: `${dxy.toFixed(2)} / ${dxy5yHigh.toFixed(2)} (${dxyPctFrom5yHigh.toFixed(1)}% from peak)`,
      signal: dxyPctFrom5yHigh < -5 ? "bullish_gold" : dxyPctFrom5yHigh > -3 ? "bearish_gold" : "neutral",
      description: "Dollar near 5Y high = more room to fall = more gold upside potential when reversal occurs.",
    },
    {
      name: "TLT (Long Bond / Dollar Demand)",
      value: `${tltData.price.toFixed(2)} (${tltData.change1m >= 0 ? "+" : ""}${tltData.change1m.toFixed(2)}% 1M)`,
      signal: tltData.change1m < -1 ? "bearish_gold" : tltData.change1m > 1 ? "bullish_gold" : "neutral",
      description: "Rising TLT = falling yields = less dollar demand = gold positive. Falling TLT = dollar demand rising.",
    },
    {
      name: "EM Currency Stress (TRY/USD)",
      value: `EM Stress Index: ${emStressIndex}/100`,
      signal: emStressIndex > 50 ? "bearish_gold" : emStressIndex < 25 ? "bullish_gold" : "neutral",
      description: "High EM stress = dollar still sucking capital. When stress peaks, it signals approaching reversal.",
    },
    {
      name: "EM Equities (EEM)",
      value: `${embdData.price.toFixed(2)} (${embdData.change1m >= 0 ? "+" : ""}${embdData.change1m.toFixed(2)}% 1M)`,
      signal: embdData.change1m < -2 ? "bearish_gold" : embdData.change1m > 2 ? "bullish_gold" : "neutral",
      description: "EM equity weakness signals capital flowing to USD. EM strength signals reversal and gold bullish.",
    },
  ];

  const data: DollarMilkshakeData = {
    dxy,
    dxyChange1m: parseFloat(dxyData.change1m.toFixed(2)),
    dxyChange3m: parseFloat(dxyData.change3m.toFixed(2)),
    dxy5yHigh,
    dxyPctFrom5yHigh: parseFloat(dxyPctFrom5yHigh.toFixed(1)),
    emStressIndex,
    eurodollarProxy: tltData.price,
    capitalFlowSignal,
    theoryPhase,
    phaseDescription,
    goldImplication,
    indicators,
    insight:
      `DXY at ${dxy.toFixed(2)} — ${Math.abs(dxyPctFrom5yHigh).toFixed(1)}% from 5-year high. ` +
      `1M change: ${dxyData.change1m >= 0 ? "+" : ""}${dxyData.change1m.toFixed(2)}%. EM stress: ${emStressIndex}/100. ` +
      `Theory phase: ${theoryPhase.replace(/_/g, " ").toUpperCase()}.`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}

function dxypctFromHighAbove(pct: number, threshold: number): boolean {
  return pct > threshold;
}
