import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface DXYComponent {
  currency: string;
  currencyTh: string;
  pair: string;       // vs USD (e.g. EURUSD)
  yahooSym: string;
  weight: number;     // % weight in DXY calculation (ICE formula)
  rate: number;       // current exchange rate
  change1d: number;   // % change vs USD
  change1w: number;
  contribution1d: number;  // weight * change1d / 100 (contribution to DXY)
  trend: "strengthening" | "weakening" | "neutral"; // vs USD
  trendColor: string;
  goldImpact: "bullish" | "neutral" | "bearish";    // on gold
  goldImpactTh: string;
  country: string;
  flag: string;
}

export interface DXYBreakdownPayload {
  dxyLevel: number;
  dxyChange1d: number;
  dxyChange1w: number;
  dxyZone: "strong" | "neutral" | "weak";
  dxyZoneTh: string;
  dxyColor: string;
  dominantDriver: string;      // currency with biggest 1d contribution
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  goldPrice: number;
  components: DXYComponent[];
  generatedAt: string;
}

// DXY ICE weights (approx, sum to 100%)
const COMPONENT_META: Array<{
  currency: string; currencyTh: string; pair: string; yahooSym: string;
  weight: number; country: string; flag: string;
}> = [
  { currency: "EUR", currencyTh: "ยูโร",    pair: "EURUSD", yahooSym: "EURUSD=X", weight: 57.6, country: "Eurozone",       flag: "🇪🇺" },
  { currency: "JPY", currencyTh: "เยน",     pair: "USDJPY", yahooSym: "JPY=X",    weight: 13.6, country: "Japan",          flag: "🇯🇵" },
  { currency: "GBP", currencyTh: "ปอนด์",  pair: "GBPUSD", yahooSym: "GBPUSD=X", weight: 11.9, country: "United Kingdom", flag: "🇬🇧" },
  { currency: "CAD", currencyTh: "ดอลลาร์แคนาดา", pair: "USDCAD", yahooSym: "CAD=X", weight: 9.1, country: "Canada",   flag: "🇨🇦" },
  { currency: "SEK", currencyTh: "โครนา",  pair: "USDSEK", yahooSym: "SEK=X",    weight: 4.2,  country: "Sweden",         flag: "🇸🇪" },
  { currency: "CHF", currencyTh: "ฟรังก์", pair: "USDCHF", yahooSym: "CHF=X",    weight: 3.6,  country: "Switzerland",    flag: "🇨🇭" },
];

type YChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; previousClose?: number };
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
        quote?: Array<{ close?: (number | null)[] }>;
      };
    }>;
  };
};

async function fetchRate(sym: string): Promise<{ price: number; prev1d: number; prev1w: number }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`;
    const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    const j   = await r.json() as YChart;
    const res = j?.chart?.result?.[0];
    if (!res) return { price: 0, prev1d: 0, prev1w: 0 };
    const price = res.meta?.regularMarketPrice ?? 0;
    const raw   = res.indicators?.adjclose?.[0]?.adjclose ?? res.indicators?.quote?.[0]?.close ?? [];
    const closes = raw.filter((c): c is number => c !== null && c !== undefined && !isNaN(c));
    const n = closes.length;
    return {
      price,
      prev1d: closes[n - 2] ?? price,
      prev1w: closes[Math.max(0, n - 6)] ?? price,
    };
  } catch { return { price: 0, prev1d: 0, prev1w: 0 }; }
}

function pct(from: number, to: number): number {
  if (!from) return 0;
  return parseFloat(((to - from) / from * 100).toFixed(3));
}

// For JPY/CAD/SEK/CHF: price is USDXXX so up = USD stronger = negative for gold
// For EUR/GBP: price is XXXUSD so up = USD weaker = positive for gold
function normalizeToUsdStrength(pair: string, ratePct: number): number {
  if (pair === "EURUSD" || pair === "GBPUSD") return -ratePct;  // EUR/GBP up = USD down
  return ratePct;  // USDJPY/USDCAD/USDSEK/USDCHF up = USD stronger
}

let CACHE: { data: DXYBreakdownPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch DXY level and all components in parallel
    const [dxyData, ...compData] = await Promise.all([
      fetchRate("DX-Y.NYB"),
      ...COMPONENT_META.map(c => fetchRate(c.yahooSym)),
    ]);

    const dxyLevel   = dxyData.price || 100;
    const dxyChange1d = pct(dxyData.prev1d, dxyLevel);
    const dxyChange1w = pct(dxyData.prev1w, dxyLevel);

    const components: DXYComponent[] = COMPONENT_META.map((meta, i) => {
      const { price, prev1d, prev1w } = compData[i];
      const rawChange1d = pct(prev1d, price);
      const rawChange1w = pct(prev1w, price);
      // Normalize: positive = USD strengthening vs this currency
      const usdStrength1d = normalizeToUsdStrength(meta.pair, rawChange1d);
      const contribution1d = parseFloat((meta.weight * usdStrength1d / 100).toFixed(4));

      const trend: DXYComponent["trend"] =
        usdStrength1d >  0.1 ? "weakening"      // currency weakening vs USD
        : usdStrength1d < -0.1 ? "strengthening"  // currency strengthening vs USD
        : "neutral";

      const goldImpact: DXYComponent["goldImpact"] =
        usdStrength1d > 0.2 ? "bearish"   // currency weak vs USD = DXY up = gold pressure
        : usdStrength1d < -0.2 ? "bullish" // currency strong vs USD = DXY down = gold supported
        : "neutral";

      return {
        currency: meta.currency,
        currencyTh: meta.currencyTh,
        pair: meta.pair,
        yahooSym: meta.yahooSym,
        weight: meta.weight,
        rate: parseFloat(price.toFixed(4)),
        change1d: parseFloat(rawChange1d.toFixed(3)),
        change1w: parseFloat(rawChange1w.toFixed(3)),
        contribution1d,
        trend,
        trendColor: trend === "strengthening" ? "#34d399" : trend === "weakening" ? "#f87171" : "#9ca3af",
        goldImpact,
        goldImpactTh:
          goldImpact === "bullish" ? `${meta.currencyTh} แข็ง → DXY ลด → หนุนทอง`
          : goldImpact === "bearish" ? `${meta.currencyTh} อ่อน → DXY เพิ่ม → กดดันทอง`
          : `${meta.currencyTh} → ผลกระทบน้อย`,
        country: meta.country,
        flag: meta.flag,
      };
    });

    const dxyZone: DXYBreakdownPayload["dxyZone"] =
      dxyLevel > 104 ? "strong" : dxyLevel < 98 ? "weak" : "neutral";

    // Find dominant driver (biggest absolute contribution)
    const dominant = [...components].sort((a, b) => Math.abs(b.contribution1d) - Math.abs(a.contribution1d))[0];

    const goldBias: DXYBreakdownPayload["goldBias"] =
      dxyChange1d < -0.3 ? "bullish"
      : dxyChange1d >  0.3 ? "bearish"
      : "neutral";

    // Fetch live gold
    let goldPrice = 3200;
    try {
      const r  = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      );
      const j  = await r.json();
      goldPrice = j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? goldPrice;
    } catch { /* fallback */ }

    const data: DXYBreakdownPayload = {
      dxyLevel: parseFloat(dxyLevel.toFixed(2)),
      dxyChange1d,
      dxyChange1w,
      dxyZone,
      dxyZoneTh:
        dxyZone === "strong" ? "ดอลลาร์แข็งแกร่ง (>104)"
        : dxyZone === "weak" ? "ดอลลาร์อ่อนค่า (<98)"
        : "ดอลลาร์ปกติ",
      dxyColor: dxyZone === "strong" ? "#f87171" : dxyZone === "weak" ? "#34d399" : "#f5c451",
      dominantDriver: `${dominant?.flag} ${dominant?.currencyTh} (${dominant?.contribution1d > 0 ? "+" : ""}${dominant?.contribution1d?.toFixed(3)})`,
      goldBias,
      goldBiasTh:
        goldBias === "bullish" ? "Bullish — DXY อ่อนตัว หนุนทองคำ"
        : goldBias === "bearish" ? "Bearish — DXY แข็งค่า กดดันทอง"
        : "Neutral — DXY ทรงตัว",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      goldPrice: Math.round(goldPrice),
      components,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
