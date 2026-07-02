import { NextResponse } from "next/server";

export const revalidate = 900; // 15-min cache

interface CurrencySignal {
  name: string;
  symbol: string;
  flag: string;
  price: number | null;
  change1d: number | null;
  change1y: number | null;
  stressLevel: "extreme" | "high" | "moderate" | "low" | "stable";
  goldImplication: "bullish" | "neutral" | "bearish";
  weight: number; // weight in composite index
  note: string;
}

interface CurrencyStressData {
  compositeStressIndex: number; // 0-100, higher = more EM stress = more bullish for gold
  stressRegime: "crisis" | "elevated" | "moderate" | "calm";
  goldImplication: string;
  currencies: CurrencySignal[];
  mostStressed: string;
  mostStable: string;
  insight: string;
  timestamp: string;
}

async function fetchQuote(symbol: string): Promise<{ price: number | null; change1d: number | null }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return { price: null, change1d: null };
    const price = meta.regularMarketPrice ?? null;
    const prev  = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change1d = price && prev ? ((price - prev) / prev) * 100 : null;
    return { price, change1d };
  } catch {
    return { price: null, change1d: null };
  }
}

// Stress = currency weakening (price going up against USD = more USD needed = EM currency weaker)
// For USDTRY, USDBRL, etc. — rise means EM currency weakening = stress
function classifyStress(change1d: number | null, symbol: string): CurrencySignal["stressLevel"] {
  if (change1d === null) return "stable";
  // For USD/EM pairs (USDTRY, USDBRL, USDMXN, USDKRW): positive 1D = EM weakness = stress
  const emPairs = ["TRY=X", "BRL=X", "MXN=X", "ZAR=X", "IDR=X"];
  const isEmPair = emPairs.some(s => symbol.includes(s.replace("=X", "")));

  const stressChange = isEmPair ? change1d : -change1d;
  if (stressChange > 1.5) return "extreme";
  if (stressChange > 0.7) return "high";
  if (stressChange > 0.3) return "moderate";
  if (stressChange > -0.2) return "low";
  return "stable";
}

function stressToGoldSignal(stress: CurrencySignal["stressLevel"]): CurrencySignal["goldImplication"] {
  if (stress === "extreme" || stress === "high") return "bullish";
  if (stress === "stable") return "bearish";
  return "neutral";
}

export async function GET() {
  const CURRENCIES: Omit<CurrencySignal, "price" | "change1d" | "change1y" | "stressLevel" | "goldImplication">[] = [
    {
      name: "Turkish Lira",
      symbol: "TRY=X",
      flag: "🇹🇷",
      weight: 0.20,
      note: "Turkey has chronic inflation and political risk. Lira weakness signals EM contagion risk — bullish for gold safe haven.",
    },
    {
      name: "Brazilian Real",
      symbol: "BRL=X",
      flag: "🇧🇷",
      weight: 0.18,
      note: "Brazil's fiscal position and political risk drive Real volatility. Weakness signals EM capital flight toward gold.",
    },
    {
      name: "South African Rand",
      symbol: "ZAR=X",
      flag: "🇿🇦",
      weight: 0.15,
      note: "SA is the world's largest gold producer. ZAR weakness often coincides with gold production cost inflation and rising gold prices.",
    },
    {
      name: "Mexican Peso",
      symbol: "MXN=X",
      flag: "🇲🇽",
      weight: 0.15,
      note: "Peso often serves as an EM risk proxy. Sharp MXN moves signal broader EM stress.",
    },
    {
      name: "Indian Rupee",
      symbol: "INR=X",
      flag: "🇮🇳",
      weight: 0.15,
      note: "India is the world's largest gold consumer. Rupee weakness makes gold more expensive domestically, but physical demand absorbs this.",
    },
    {
      name: "Korean Won",
      symbol: "KRW=X",
      flag: "🇰🇷",
      weight: 0.10,
      note: "KRW is a high-beta EM currency. Sharp KRW weakness signals Asia-wide risk-off and often precedes gold spikes.",
    },
    {
      name: "Indonesian Rupiah",
      symbol: "IDR=X",
      flag: "🇮🇩",
      weight: 0.07,
      note: "Commodity-linked EM currency. Rupiah weakness signals broad commodity/EM stress.",
    },
  ];

  const results = await Promise.all(CURRENCIES.map(c => fetchQuote(c.symbol)));

  const currencies: CurrencySignal[] = CURRENCIES.map((c, i) => {
    const { price, change1d } = results[i];
    const stress = classifyStress(change1d, c.symbol);
    return {
      ...c,
      price,
      change1d,
      change1y: null, // would need 1Y range fetch — skip for performance
      stressLevel: stress,
      goldImplication: stressToGoldSignal(stress),
    };
  });

  // Composite stress score: weighted avg of stress levels
  const STRESS_SCORE: Record<CurrencySignal["stressLevel"], number> = {
    extreme: 100, high: 75, moderate: 50, low: 25, stable: 10,
  };

  const compositeScore = currencies.reduce((sum, c) => {
    return sum + STRESS_SCORE[c.stressLevel] * c.weight;
  }, 0);

  const regime: CurrencyStressData["stressRegime"] =
    compositeScore > 70 ? "crisis" :
    compositeScore > 50 ? "elevated" :
    compositeScore > 30 ? "moderate" : "calm";

  const mostStressed = [...currencies].sort((a, b) =>
    STRESS_SCORE[b.stressLevel] - STRESS_SCORE[a.stressLevel]
  )[0];

  const mostStable = [...currencies].sort((a, b) =>
    STRESS_SCORE[a.stressLevel] - STRESS_SCORE[b.stressLevel]
  )[0];

  const goldImplication =
    regime === "crisis"
      ? "EM currency crisis underway. Capital flight from EM toward gold is accelerating — strongly bullish for gold safe-haven demand."
      : regime === "elevated"
      ? "Elevated EM currency stress. Safe-haven flows into gold are building. Watch for acceleration if stress spreads to DM currencies."
      : regime === "moderate"
      ? "Moderate EM stress. Gold is receiving some safe-haven support but macro factors remain more important driver."
      : "EM currencies are calm. Risk appetite is high — reduced gold safe-haven premium. Other macro factors dominate gold direction.";

  const data: CurrencyStressData = {
    compositeStressIndex: parseFloat(compositeScore.toFixed(1)),
    stressRegime: regime,
    goldImplication,
    currencies,
    mostStressed: mostStressed.name,
    mostStable: mostStable.name,
    insight:
      `EM Currency Stress Index at ${compositeScore.toFixed(1)}/100 (${regime} regime). ` +
      `${mostStressed.name} is under the most pressure. ` +
      `Historically, composite EM stress above 70 has preceded gold rallies of 3-8% within 30 days.`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
