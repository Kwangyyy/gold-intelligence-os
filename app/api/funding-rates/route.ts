import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface FundingEntry {
  symbol: string;
  label: string;
  labelTh: string;
  markPrice: number;
  fundingRate: number;       // current 8h rate in decimal (e.g. 0.0001 = 0.01%)
  fundingRatePct: number;    // x100
  annualizedPct: number;     // fundingRatePct * 3 * 365
  nextFundingMs: number;     // unix ms
  sentiment: "extreme_long" | "long" | "neutral" | "short" | "extreme_short";
  sentimentTh: string;
  sentimentColor: string;
  goldImplication: "bullish" | "neutral" | "bearish";
  goldImplicationTh: string;
  history: number[];         // last 20 funding rates (pct)
}

export interface FundingRatesPayload {
  goldPrice: number;
  compositeSignal: "risk_on" | "neutral" | "risk_off";
  compositeSignalTh: string;
  compositeSignalColor: string;
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  avgFundingRate: number;    // avg pct across BTC+ETH
  entries: FundingEntry[];
  generatedAt: string;
}

const SYMBOLS = [
  { sym: "BTCUSDT", label: "BTC", labelTh: "Bitcoin" },
  { sym: "ETHUSDT", label: "ETH", labelTh: "Ethereum" },
  { sym: "XAUUSDT", label: "XAU", labelTh: "ทองคำ (Perp)" },
];

type PremiumIndex = {
  symbol?: string;
  markPrice?: string;
  lastFundingRate?: string;
  nextFundingTime?: number;
};

type FundingRecord = {
  fundingRate?: string;
  fundingTime?: number;
};

async function fetchFunding(symbol: string): Promise<{ mark: number; rate: number; nextMs: number; history: number[] }> {
  const base = "https://fapi.binance.com/fapi/v1";
  const [priR, histR] = await Promise.all([
    fetch(`${base}/premiumIndex?symbol=${symbol}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
    fetch(`${base}/fundingRate?symbol=${symbol}&limit=20`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
  ]);
  const pri  = await priR.json() as PremiumIndex;
  const hist = await histR.json() as FundingRecord[];
  const mark    = parseFloat(pri.markPrice ?? "0") || 0;
  const rate    = parseFloat(pri.lastFundingRate ?? "0") || 0;
  const nextMs  = pri.nextFundingTime ?? 0;
  const history = Array.isArray(hist)
    ? hist.map(h => parseFloat(h.fundingRate ?? "0") * 100).filter(Boolean)
    : [];
  return { mark, rate, nextMs, history };
}

function classifySentiment(ratePct: number): Pick<FundingEntry, "sentiment" | "sentimentTh" | "sentimentColor" | "goldImplication" | "goldImplicationTh"> {
  if (ratePct > 0.1) return {
    sentiment: "extreme_long", sentimentTh: "Extreme Long — ตลาดโลภมาก", sentimentColor: "#f87171",
    goldImplication: "bullish", goldImplicationTh: "Bullish ทอง — risk-off สูง, rotation มาทอง",
  };
  if (ratePct > 0.03) return {
    sentiment: "long", sentimentTh: "Long Bias — ตลาด risk-on", sentimentColor: "#f97316",
    goldImplication: "neutral", goldImplicationTh: "Neutral — risk-on กดทอง แต่ยังไม่ extreme",
  };
  if (ratePct > -0.01) return {
    sentiment: "neutral", sentimentTh: "Neutral — ตลาดสมดุล", sentimentColor: "#9ca3af",
    goldImplication: "neutral", goldImplicationTh: "Neutral — ไม่มีสัญญาณชัดเจน",
  };
  if (ratePct > -0.05) return {
    sentiment: "short", sentimentTh: "Short Bias — ตลาด risk-off", sentimentColor: "#86efac",
    goldImplication: "bullish", goldImplicationTh: "Bullish ทอง — ตลาด risk-off หนุน safe haven",
  };
  return {
    sentiment: "extreme_short", sentimentTh: "Extreme Short — ตลาดกลัวมาก", sentimentColor: "#34d399",
    goldImplication: "bullish", goldImplicationTh: "Bullish มาก — panic selling crypto → ทองเป็น safe haven",
  };
}

let CACHE: { data: FundingRatesPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000; // 10m (funding rates change every 8h but market moves faster)

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch gold price and all funding rates in parallel
    const [goldR, ...fundingResults] = await Promise.all([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
      ...SYMBOLS.map(s => fetchFunding(s.sym).catch(() => ({ mark: 0, rate: 0, nextMs: 0, history: [] as number[] }))),
    ]);

    type YJ = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
    const goldJ = await goldR.json() as YJ;
    const goldPrice = goldJ?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3200;

    const entries: FundingEntry[] = SYMBOLS.map((s, i) => {
      const { mark, rate, nextMs, history } = fundingResults[i] as { mark: number; rate: number; nextMs: number; history: number[] };
      const ratePct = rate * 100;
      const annualizedPct = parseFloat((ratePct * 3 * 365).toFixed(2));
      const cls = classifySentiment(ratePct);
      return {
        symbol: s.sym,
        label: s.label,
        labelTh: s.labelTh,
        markPrice: mark,
        fundingRate: rate,
        fundingRatePct: parseFloat(ratePct.toFixed(4)),
        annualizedPct,
        nextFundingMs: nextMs,
        history,
        ...cls,
      };
    });

    // Composite signal from BTC + ETH (exclude XAU for sentiment, XAU funding is self-referential)
    const mainRates = entries.filter(e => e.label === "BTC" || e.label === "ETH");
    const avgRate = mainRates.length
      ? mainRates.reduce((s, e) => s + e.fundingRatePct, 0) / mainRates.length
      : 0;

    const compositeSignal: FundingRatesPayload["compositeSignal"] =
      avgRate > 0.05 ? "risk_on" : avgRate < -0.01 ? "risk_off" : "neutral";

    const goldBias: FundingRatesPayload["goldBias"] =
      compositeSignal === "risk_off" ? "bullish"
      : compositeSignal === "risk_on" && avgRate > 0.08 ? "bullish"  // extreme greed = contrarian bullish gold
      : compositeSignal === "risk_on" ? "bearish"
      : "neutral";

    const data: FundingRatesPayload = {
      goldPrice: Math.round(goldPrice),
      compositeSignal,
      compositeSignalTh: compositeSignal === "risk_on"
        ? "Risk-On — ตลาด crypto กำไรดี นักลงทุนชอบ risk"
        : compositeSignal === "risk_off"
        ? "Risk-Off — ตลาด crypto bearish นักลงทุนหลีกเลี่ยง risk"
        : "Neutral — ตลาดสมดุล ไม่มีสัญญาณชัด",
      compositeSignalColor: compositeSignal === "risk_on" ? "#f97316" : compositeSignal === "risk_off" ? "#34d399" : "#9ca3af",
      goldBias,
      goldBiasTh: goldBias === "bullish"
        ? "Bullish — Funding rates หนุนทอง (risk-off / extreme greed)"
        : goldBias === "bearish"
        ? "Bearish — Risk-on environment กดดันทอง"
        : "Neutral — Funding rates ไม่ชี้ทิศทาง",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      avgFundingRate: parseFloat(avgRate.toFixed(4)),
      entries,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
