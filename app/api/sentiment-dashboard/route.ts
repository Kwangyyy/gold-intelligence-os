import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface SentimentSignal {
  id: string;
  name: string;
  nameTh: string;
  icon: string;
  value: string;        // formatted display value
  rawValue: number;
  signal: "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";
  signalTh: string;
  signalColor: string;
  score: number;        // 0-100 (100=most bullish for gold)
  weight: number;       // relative weight in composite
  description: string;
}

export interface SentimentDashboardPayload {
  compositeScore: number;      // 0-100 weighted average
  goldBias: "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  bullishSignals: number;
  bearishSignals: number;
  neutralSignals: number;
  goldPrice: number;
  goldChange: number;          // 1d % change
  signals: SentimentSignal[];
  generatedAt: string;
}

type YJ = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number } }> } };

async function yFetch(sym: string): Promise<{ price: number; prevClose: number }> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
    );
    const j = await r.json() as YJ;
    const m = j?.chart?.result?.[0]?.meta ?? {};
    return { price: m.regularMarketPrice ?? 0, prevClose: m.previousClose ?? 0 };
  } catch { return { price: 0, prevClose: 0 }; }
}

async function fetchBtcFunding(): Promise<number> {
  try {
    type PI = { lastFundingRate?: string };
    const r = await fetch("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT",
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    const j = await r.json() as PI;
    return parseFloat(j?.lastFundingRate ?? "0.0001") * 100;
  } catch { return 0.01; }
}

function scoreVix(vix: number): { score: number; signal: SentimentSignal["signal"]; text: string } {
  // High VIX = fear = bullish for gold safe haven
  if (vix > 30) return { score: 90, signal: "very_bullish", text: "Extreme Fear — strong safe-haven demand" };
  if (vix > 22) return { score: 75, signal: "bullish",      text: "Elevated Fear — risk-off ดีต่อทอง" };
  if (vix > 16) return { score: 50, signal: "neutral",      text: "Normal — VIX ปกติ" };
  if (vix > 12) return { score: 30, signal: "bearish",      text: "Calm — risk-on, กดทอง" };
  return              { score: 10, signal: "very_bearish",  text: "Extreme Calm — risk appetite สูงมาก" };
}

function scoreDxy(chgPct: number): { score: number; signal: SentimentSignal["signal"]; text: string } {
  // DXY up = USD strong = bearish for gold
  if (chgPct < -0.5) return { score: 85, signal: "bullish",      text: "USD อ่อนแรง — Bullish ทอง" };
  if (chgPct < -0.1) return { score: 65, signal: "bullish",      text: "USD ค่อยๆ อ่อน — เล็กน้อย Bullish" };
  if (chgPct < 0.1)  return { score: 50, signal: "neutral",      text: "USD ทรงตัว — Neutral" };
  if (chgPct < 0.5)  return { score: 35, signal: "bearish",      text: "USD แข็งค่า — กดดันทอง" };
  return                    { score: 15, signal: "very_bearish",  text: "USD แข็งมาก — Bearish ทอง" };
}

function scoreYield10y(yld: number): { score: number; signal: SentimentSignal["signal"]; text: string } {
  // Very high real yield = bad for gold; very low = good
  if (yld < 3.5) return { score: 80, signal: "bullish",      text: "Yield ต่ำ — ทองแข่งขันได้" };
  if (yld < 4.2) return { score: 55, signal: "neutral",      text: "Yield ปกติ — Neutral" };
  if (yld < 4.8) return { score: 35, signal: "bearish",      text: "Yield สูง — กดดัน gold" };
  return               { score: 15, signal: "very_bearish",  text: "Yield สูงมาก — Bearish ทอง" };
}

function scoreYieldChange(chgBps: number): { score: number; signal: SentimentSignal["signal"]; text: string } {
  // Yield falling = bullish for gold
  if (chgBps < -5)  return { score: 85, signal: "bullish",     text: "Yield ลด — Bullish ทอง" };
  if (chgBps < -1)  return { score: 65, signal: "bullish",     text: "Yield ลดเล็กน้อย" };
  if (chgBps < 1)   return { score: 50, signal: "neutral",     text: "Yield ทรงตัว" };
  if (chgBps < 5)   return { score: 35, signal: "bearish",     text: "Yield เพิ่ม — กดทอง" };
  return                   { score: 15, signal: "very_bearish", text: "Yield พุ่งขึ้น — Bearish ทอง" };
}

function scoreFunding(ratePct: number): { score: number; signal: SentimentSignal["signal"]; text: string } {
  // High positive funding = extreme risk-on = short-term bearish gold (but may reversal)
  // Negative funding = risk-off = bullish gold
  if (ratePct < -0.03) return { score: 85, signal: "bullish",      text: "Negative funding — Risk-Off → Bullish ทอง" };
  if (ratePct < 0.01)  return { score: 55, signal: "neutral",      text: "Funding ต่ำ — ตลาด neutral" };
  if (ratePct < 0.06)  return { score: 40, signal: "bearish",      text: "Funding สูง — Risk-On → กดทอง" };
  return                     { score: 20, signal: "very_bearish",  text: "Funding สูงมาก — Extreme greed" };
}

function scoreGoldMomentum(chgPct: number): { score: number; signal: SentimentSignal["signal"]; text: string } {
  if (chgPct > 1.5)  return { score: 90, signal: "very_bullish", text: "ทองขึ้นแรง — Momentum แข็ง" };
  if (chgPct > 0.3)  return { score: 70, signal: "bullish",      text: "ทองขึ้น — Momentum ดี" };
  if (chgPct > -0.3) return { score: 50, signal: "neutral",      text: "ทองทรงตัว" };
  if (chgPct > -1.5) return { score: 30, signal: "bearish",      text: "ทองลง — Momentum อ่อน" };
  return                    { score: 10, signal: "very_bearish",  text: "ทองร่วงแรง — Momentum ลบ" };
}

function signalLabel(s: SentimentSignal["signal"]): string {
  const m: Record<SentimentSignal["signal"], string> = {
    very_bullish: "Bullish มาก", bullish: "Bullish", neutral: "Neutral",
    bearish: "Bearish", very_bearish: "Bearish มาก",
  };
  return m[s];
}
function signalColor(s: SentimentSignal["signal"]): string {
  const m: Record<SentimentSignal["signal"], string> = {
    very_bullish: "#34d399", bullish: "#86efac", neutral: "#9ca3af",
    bearish: "#f97316", very_bearish: "#f87171",
  };
  return m[s];
}

let CACHE: { data: SentimentDashboardPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [gold, vix, dxy, tnx, btcFunding] = await Promise.all([
      yFetch("GC=F"),
      yFetch("^VIX"),
      yFetch("DX-Y.NYB"),
      yFetch("^TNX"),
      fetchBtcFunding(),
    ]);

    const goldChgPct  = gold.prevClose ? ((gold.price - gold.prevClose) / gold.prevClose) * 100 : 0;
    const dxyChgPct   = dxy.prevClose  ? ((dxy.price  - dxy.prevClose)  / dxy.prevClose)  * 100 : 0;
    const tnxChgBps   = (tnx.price - tnx.prevClose) * 100;

    const vixS    = scoreVix(vix.price || 20);
    const dxyS    = scoreDxy(dxyChgPct);
    const yieldS  = scoreYield10y(tnx.price || 4.2);
    const yldChgS = scoreYieldChange(tnxChgBps);
    const fundS   = scoreFunding(btcFunding);
    const momS    = scoreGoldMomentum(goldChgPct);

    const rawSignals: Array<{ id: string; name: string; nameTh: string; icon: string; raw: number; formatted: string; weight: number; s: ReturnType<typeof scoreVix>; desc: string }> = [
      { id: "vix",       name: "VIX Fear Index",      nameTh: "VIX ดัชนีความกลัว",    icon: "😱", raw: vix.price,      formatted: vix.price.toFixed(1),                   weight: 25, s: vixS,    desc: "ความผันผวนตลาด S&P 500 — สูง = fear = bullish ทอง" },
      { id: "dxy",       name: "DXY (US Dollar)",     nameTh: "ดอลลาร์สหรัฐ (DXY)",   icon: "💵", raw: dxyChgPct,     formatted: `${dxy.price.toFixed(2)} (${dxyChgPct >= 0 ? "+" : ""}${dxyChgPct.toFixed(2)}%)`, weight: 25, s: dxyS,    desc: "USD อ่อน = ทองแข็ง, USD แข็ง = ทองอ่อน" },
      { id: "yield",     name: "10Y Treasury Yield",  nameTh: "อัตราผลตอบแทน 10 ปี", icon: "📉", raw: tnx.price,     formatted: `${tnx.price.toFixed(2)}%`,                weight: 20, s: yieldS,  desc: "Yield สูง = โอกาสเสียค่าเสียหายสูง กดดัน non-yielding gold" },
      { id: "yld_chg",  name: "Yield Direction",      nameTh: "ทิศทาง Yield",          icon: "📊", raw: tnxChgBps,    formatted: `${tnxChgBps >= 0 ? "+" : ""}${tnxChgBps.toFixed(1)} bps`,                        weight: 10, s: yldChgS, desc: "Yield ลง = bullish ทอง, Yield ขึ้น = bearish" },
      { id: "funding",   name: "BTC Funding Rate",    nameTh: "BTC Funding Rate",      icon: "₿",  raw: btcFunding,   formatted: `${btcFunding >= 0 ? "+" : ""}${btcFunding.toFixed(4)}%/8h`,                     weight: 10, s: fundS,   desc: "Funding ติดลบ = risk-off = หนุนทอง" },
      { id: "momentum",  name: "Gold Momentum",       nameTh: "Momentum ทอง",          icon: "🪙", raw: goldChgPct,   formatted: `${goldChgPct >= 0 ? "+" : ""}${goldChgPct.toFixed(2)}%`,                         weight: 10, s: momS,    desc: "ทิศทางราคาทองวันนี้" },
    ];

    const signals: SentimentSignal[] = rawSignals.map(r => ({
      id: r.id, name: r.name, nameTh: r.nameTh, icon: r.icon,
      value: r.formatted, rawValue: r.raw,
      signal: r.s.signal,
      signalTh: signalLabel(r.s.signal),
      signalColor: signalColor(r.s.signal),
      score: r.s.score,
      weight: r.weight,
      description: r.desc,
    }));

    const totalWeight = signals.reduce((s, sg) => s + sg.weight, 0);
    const compositeScore = Math.round(
      signals.reduce((s, sg) => s + sg.score * sg.weight, 0) / totalWeight
    );

    const goldBias: SentimentDashboardPayload["goldBias"] =
      compositeScore >= 75 ? "strong_bullish"
      : compositeScore >= 58 ? "bullish"
      : compositeScore >= 42 ? "neutral"
      : compositeScore >= 25 ? "bearish"
      : "strong_bearish";

    const biasLabels: Record<SentimentDashboardPayload["goldBias"], [string, string]> = {
      strong_bullish: ["Bullish แข็งแกร่ง", "#34d399"],
      bullish:        ["Bullish",            "#86efac"],
      neutral:        ["Neutral",            "#9ca3af"],
      bearish:        ["Bearish",            "#f97316"],
      strong_bearish: ["Bearish แข็งแกร่ง", "#f87171"],
    };

    const data: SentimentDashboardPayload = {
      compositeScore,
      goldBias,
      goldBiasTh: biasLabels[goldBias][0],
      goldBiasColor: biasLabels[goldBias][1],
      bullishSignals:  signals.filter(s => s.signal === "very_bullish" || s.signal === "bullish").length,
      bearishSignals:  signals.filter(s => s.signal === "very_bearish" || s.signal === "bearish").length,
      neutralSignals:  signals.filter(s => s.signal === "neutral").length,
      goldPrice: Math.round(gold.price || 3200),
      goldChange: parseFloat(goldChgPct.toFixed(2)),
      signals,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
