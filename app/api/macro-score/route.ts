import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface MacroFactor {
  factor: string;
  factorTh: string;
  icon: string;
  value: string;          // human-readable value
  score: number;          // 0-100 (100 = most bullish for gold)
  bias: "bullish" | "bearish" | "neutral";
  color: string;
  weight: number;
  explanation: string;
  explanationTh: string;
  lastUpdated: string;    // approximate date or "live"
}

export interface MacroScorePayload {
  compositeScore: number;
  compositeLabel: string;
  compositeLabelTh: string;
  compositeColor: string;
  factors: MacroFactor[];
  goldPrice: number;
  goldChange30d: number;
  keyTakeawayTh: string;
  keyTakeawayEn: string;
  generatedAt: string;
}

async function fetchGoldData() {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=45d&interval=1d";
  const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!r.ok) return null;
  const j   = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) return null;
  const closes = (res.indicators?.quote?.[0]?.close ?? []).filter((c: unknown): c is number => c != null);
  const price   = res.meta?.regularMarketPrice ?? closes.at(-1) ?? 0;
  const past30  = closes.at(-31) ?? closes[0] ?? price;
  return { price, change30d: +((price - past30) / past30 * 100).toFixed(2) };
}

async function fetchDXY() {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=3m&interval=1d";
  const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!r.ok) return null;
  const j   = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) return null;
  const price    = res.meta?.regularMarketPrice ?? 104;
  const prevClose = res.meta?.chartPreviousClose ?? price;
  return { price: +price.toFixed(2), change1d: +((price - prevClose) / prevClose * 100).toFixed(2) };
}

async function fetchVIX() {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=5d&interval=1d";
  const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!r.ok) return null;
  const j   = await r.json();
  return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
}

async function fetchTLT() {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/TLT?range=45d&interval=1d";
  const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!r.ok) return null;
  const j   = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) return null;
  const closes = (res.indicators?.quote?.[0]?.close ?? []).filter((c: unknown): c is number => c != null);
  if (closes.length < 22) return null;
  const price   = closes.at(-1)!;
  const past30  = closes.at(-22)!;
  return { price: +price.toFixed(2), change1m: +((price - past30) / past30 * 100).toFixed(2) };
}

function scoreColor(s: number) {
  return s > 65 ? "#34d399" : s < 35 ? "#f87171" : "#f5c451";
}

let CACHE: { data: MacroScorePayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldData, dxyData, vixLevel, tltData] = await Promise.all([
      fetchGoldData(), fetchDXY(), fetchVIX(), fetchTLT(),
    ]);

    const goldPrice   = goldData?.price    ?? 3200;
    const goldCh30d   = goldData?.change30d ?? 0;
    const dxyPrice    = dxyData?.price     ?? 104;
    const dxyCh1d     = dxyData?.change1d  ?? 0;
    const vix         = vixLevel            ?? 18;
    const tltCh1m     = tltData?.change1m  ?? 0;

    const factors: MacroFactor[] = [];

    // 1. USD Strength (DXY) — inverse for gold
    {
      const score = Math.max(0, Math.min(100, 50 - (dxyPrice - 100) * 2.5));
      const bias: MacroFactor["bias"] = score > 60 ? "bullish" : score < 40 ? "bearish" : "neutral";
      factors.push({
        factor: "USD Strength (DXY)", factorTh: "ความแข็งแกร่ง USD",
        icon: "💵", value: `${dxyPrice} (${dxyCh1d > 0 ? "+" : ""}${dxyCh1d}% วันนี้)`,
        score: +score.toFixed(0), bias, color: scoreColor(score), weight: 0.25,
        explanation: `DXY at ${dxyPrice}. ${dxyPrice > 105 ? "Strong USD = headwind for gold." : dxyPrice < 100 ? "Weak USD = tailwind for gold." : "Neutral USD."}`,
        explanationTh: `DXY อยู่ที่ ${dxyPrice}. ${dxyPrice > 105 ? "USD แข็ง = แรงกดดัน gold" : dxyPrice < 100 ? "USD อ่อน = สนับสนุน gold" : "USD เป็นกลาง"}`,
        lastUpdated: "live",
      });
    }

    // 2. Gold Momentum (30d performance)
    {
      const score = Math.max(0, Math.min(100, 50 + goldCh30d * 2.5));
      const bias: MacroFactor["bias"] = goldCh30d > 2 ? "bullish" : goldCh30d < -2 ? "bearish" : "neutral";
      factors.push({
        factor: "Gold Momentum (30d)", factorTh: "โมเมนตัมทอง (30 วัน)",
        icon: "🪙", value: `${goldCh30d > 0 ? "+" : ""}${goldCh30d}%`,
        score: +score.toFixed(0), bias, color: scoreColor(score), weight: 0.20,
        explanation: `Gold 30-day return: ${goldCh30d > 0 ? "+" : ""}${goldCh30d}%. ${goldCh30d > 5 ? "Strong bullish momentum." : goldCh30d < -5 ? "Strong bearish momentum." : "Moderate trend."}`,
        explanationTh: `ผลตอบแทน 30 วัน: ${goldCh30d > 0 ? "+" : ""}${goldCh30d}%. ${goldCh30d > 5 ? "momentum ขาขึ้นแข็งแกร่ง" : goldCh30d < -5 ? "momentum ขาลงแข็งแกร่ง" : "เทรนด์ปานกลาง"}`,
        lastUpdated: "live",
      });
    }

    // 3. Market Volatility (VIX) — high VIX = gold bullish
    {
      const score = Math.max(0, Math.min(100, (vix - 10) / 30 * 100));
      const bias: MacroFactor["bias"] = vix > 25 ? "bullish" : vix < 15 ? "bearish" : "neutral";
      factors.push({
        factor: "Market Volatility (VIX)", factorTh: "ความผันผวนตลาด (VIX)",
        icon: "📊", value: `VIX ${vix.toFixed(1)}`,
        score: +score.toFixed(0), bias, color: scoreColor(score), weight: 0.15,
        explanation: `VIX = ${vix.toFixed(1)}. ${vix > 30 ? "Extreme fear — very bullish for gold." : vix > 20 ? "Elevated volatility — supportive for gold." : "Low volatility — less safe-haven demand."}`,
        explanationTh: `VIX = ${vix.toFixed(1)}. ${vix > 30 ? "ความกลัวสูงสุด — bullish gold มาก" : vix > 20 ? "ความผันผวนสูง — สนับสนุน gold" : "ความผันผวนต่ำ — demand safe-haven น้อย"}`,
        lastUpdated: "live",
      });
    }

    // 4. Real Rates / Bond proxy (TLT) — rising TLT = falling yields = bullish gold
    {
      const score = Math.max(0, Math.min(100, 50 + tltCh1m * 5));
      const bias: MacroFactor["bias"] = tltCh1m > 1 ? "bullish" : tltCh1m < -1 ? "bearish" : "neutral";
      factors.push({
        factor: "Bond Market / Real Rates (TLT)", factorTh: "พันธบัตร / อัตราดอกเบี้ยแท้จริง",
        icon: "📉", value: `TLT ${tltCh1m > 0 ? "+" : ""}${tltCh1m}% (1M)`,
        score: +score.toFixed(0), bias, color: scoreColor(score), weight: 0.20,
        explanation: `TLT 1-month return: ${tltCh1m > 0 ? "+" : ""}${tltCh1m}%. ${tltCh1m > 2 ? "Falling yields = bullish gold." : tltCh1m < -2 ? "Rising yields = bearish gold." : "Stable rates."}`,
        explanationTh: `TLT 1 เดือน: ${tltCh1m > 0 ? "+" : ""}${tltCh1m}%. ${tltCh1m > 2 ? "yield ลด = bullish gold" : tltCh1m < -2 ? "yield เพิ่ม = bearish gold" : "อัตราดอกเบี้ยเสถียร"}`,
        lastUpdated: "live",
      });
    }

    // 5. Central Bank Demand (static — WGC estimate 2024-25)
    {
      const cbScore = 78; // Historically elevated CB buying
      factors.push({
        factor: "Central Bank Demand", factorTh: "Demand ธนาคารกลาง",
        icon: "🏦", value: "~1,037 ตัน/ปี",
        score: cbScore, bias: "bullish", color: scoreColor(cbScore), weight: 0.10,
        explanation: "Central bank gold buying at 55-year high (~1,037t in 2024). Structural bullish support.",
        explanationTh: "ธนาคารกลางซื้อทองสูงสุดในรอบ 55 ปี (~1,037 ตัน ปี 2024) — สนับสนุนเชิงโครงสร้าง",
        lastUpdated: "2024-25 WGC estimate",
      });
    }

    // 6. Geopolitical Risk (static — proxy score from news/VIX)
    {
      const geoScore = vix > 25 ? 75 : vix > 18 ? 60 : 45;
      const bias: MacroFactor["bias"] = geoScore > 60 ? "bullish" : geoScore < 45 ? "bearish" : "neutral";
      factors.push({
        factor: "Geopolitical Risk", factorTh: "ความเสี่ยงภูมิรัฐศาสตร์",
        icon: "🌏", value: geoScore > 65 ? "Elevated" : geoScore > 50 ? "Moderate" : "Low",
        score: geoScore, bias, color: scoreColor(geoScore), weight: 0.10,
        explanation: `Geopolitical risk proxy (from VIX level): ${geoScore > 65 ? "Elevated — bullish for safe-haven gold." : "Moderate."}`,
        explanationTh: `ความเสี่ยงภูมิรัฐศาสตร์ (proxy จาก VIX): ${geoScore > 65 ? "สูง — สนับสนุน safe-haven gold" : "ปานกลาง"}`,
        lastUpdated: "live proxy",
      });
    }

    // Weighted composite
    const totalW = factors.reduce((a, f) => a + f.weight, 0);
    const compositeScore = Math.round(factors.reduce((a, f) => a + f.score * f.weight, 0) / totalW);
    const compositeLabel   = compositeScore > 65 ? "Strong Bullish" : compositeScore > 55 ? "Bullish" : compositeScore > 45 ? "Neutral" : compositeScore > 35 ? "Bearish" : "Strong Bearish";
    const compositeLabelTh = compositeScore > 65 ? "ปัจจัยมหภาค BULLISH แข็ง" : compositeScore > 55 ? "ปัจจัยมหภาค BULLISH" : compositeScore > 45 ? "ปัจจัยมหภาค NEUTRAL" : compositeScore > 35 ? "ปัจจัยมหภาค BEARISH" : "ปัจจัยมหภาค BEARISH แข็ง";
    const compositeColor   = scoreColor(compositeScore);

    const bullishFactors = factors.filter(f => f.bias === "bullish").map(f => f.factorTh).join(", ");
    const bearishFactors = factors.filter(f => f.bias === "bearish").map(f => f.factorTh).join(", ");
    const keyTakeawayTh = `คะแนนมหภาครวม ${compositeScore}/100 (${compositeLabelTh}). ${bullishFactors ? `สนับสนุน: ${bullishFactors}` : ""}${bearishFactors ? `. กดดัน: ${bearishFactors}` : ""}`;
    const keyTakeawayEn = `Macro score ${compositeScore}/100 (${compositeLabel}). ${bullishFactors ? `Supportive: ${factors.filter(f=>f.bias==="bullish").map(f=>f.factor).join(", ")}` : ""}${bearishFactors ? `. Headwinds: ${factors.filter(f=>f.bias==="bearish").map(f=>f.factor).join(", ")}` : ""}`;

    const data: MacroScorePayload = {
      compositeScore, compositeLabel, compositeLabelTh, compositeColor,
      factors, goldPrice, goldChange30d: goldCh30d,
      keyTakeawayTh, keyTakeawayEn,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
