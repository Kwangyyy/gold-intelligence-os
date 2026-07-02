import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ScenarioFactor {
  name: string;
  nameTh: string;
  direction: "up" | "down" | "flat";
  magnitude: "large" | "moderate" | "small";
  note: string;
}

export interface MacroScenario {
  id: string;
  name: string;
  nameTh: string;
  icon: string;
  probability: number;        // % probability estimate
  goldImpact: "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";
  goldImpactTh: string;
  goldImpactColor: string;
  priceRangeLow: number;      // projected gold price range
  priceRangeHigh: number;
  timeframe: string;          // "3-6 months"
  timeframeTh: string;
  factors: ScenarioFactor[];
  description: string;
  descriptionTh: string;
  historicalAnalog: string;
  historicalAnalogTh: string;
}

export interface MacroScenarioPayload {
  goldPrice: number;
  baseCase: string;            // id of current most likely scenario
  scenarios: MacroScenario[];
  totalProbability: number;    // should sum to 100
  weightedGoldTarget: number;  // probability-weighted price target
  generatedAt: string;
}

const SCENARIOS: Omit<MacroScenario, "priceRangeLow" | "priceRangeHigh">[] = [
  {
    id: "soft_landing",
    name: "Soft Landing",
    nameTh: "Soft Landing",
    icon: "✈️",
    probability: 35,
    goldImpact: "neutral",
    goldImpactTh: "Neutral — ทองรักษาระดับ อาจถูกทดแทนด้วย equities",
    goldImpactColor: "#f5c451",
    timeframe: "3-9 months",
    timeframeTh: "3-9 เดือน",
    factors: [
      { name: "GDP Growth", nameTh: "GDP", direction: "up", magnitude: "moderate", note: "2-2.5% growth" },
      { name: "Inflation",  nameTh: "เงินเฟ้อ", direction: "down", magnitude: "moderate", note: "CPI → 2%" },
      { name: "Fed Rates",  nameTh: "อัตราดอกเบี้ย", direction: "down", magnitude: "small", note: "2-3 cuts" },
      { name: "Equities",   nameTh: "ตลาดหุ้น", direction: "up", magnitude: "moderate", note: "SPX new highs" },
    ],
    description: "Fed achieves disinflation without recession. Risk assets rally, reducing gold safe haven demand.",
    descriptionTh: "Fed คุม inflation ได้โดยไม่ทำให้เศรษฐกิจถดถอย ตลาดหุ้นขึ้น ทองอาจ underperform",
    historicalAnalog: "1995-1996 Greenspan soft landing",
    historicalAnalogTh: "คล้าย 1995-1996 ยุค Greenspan",
  },
  {
    id: "recession",
    name: "Mild Recession",
    nameTh: "Recession เล็กน้อย",
    icon: "📉",
    probability: 25,
    goldImpact: "bullish",
    goldImpactTh: "Bullish — safe haven demand สูง Fed กลับมา dovish",
    goldImpactColor: "#34d399",
    timeframe: "6-18 months",
    timeframeTh: "6-18 เดือน",
    factors: [
      { name: "GDP Growth",  nameTh: "GDP", direction: "down", magnitude: "moderate", note: "2 negative quarters" },
      { name: "Unemployment", nameTh: "การว่างงาน", direction: "up", magnitude: "moderate", note: "5-6%" },
      { name: "Fed Rates",   nameTh: "อัตราดอกเบี้ย", direction: "down", magnitude: "large", note: "emergency cuts" },
      { name: "Credit",      nameTh: "เครดิต", direction: "down", magnitude: "large", note: "spreads widen" },
    ],
    description: "Growth slowdown triggers Fed pivot. Gold benefits from rate cuts and risk-off positioning.",
    descriptionTh: "เศรษฐกิจชะลอตัว Fed ลดดอกเบี้ยเร็ว ทองได้รับประโยชน์จาก safe haven + real yield ลด",
    historicalAnalog: "2008 GFC gold rally (+5-30% YoY)",
    historicalAnalogTh: "คล้าย 2008 — ทองขึ้นในช่วงแรกของวิกฤต",
  },
  {
    id: "stagflation",
    name: "Stagflation",
    nameTh: "Stagflation",
    icon: "🔥",
    probability: 20,
    goldImpact: "very_bullish",
    goldImpactTh: "Very Bullish — สภาพแวดล้อมที่ดีที่สุดสำหรับทอง",
    goldImpactColor: "#34d399",
    timeframe: "12-24 months",
    timeframeTh: "12-24 เดือน",
    factors: [
      { name: "Inflation",   nameTh: "เงินเฟ้อ", direction: "up", magnitude: "large", note: "CPI > 5%" },
      { name: "GDP Growth",  nameTh: "GDP", direction: "down", magnitude: "moderate", note: "near 0%" },
      { name: "Fed Dilemma", nameTh: "Fed", direction: "flat", magnitude: "large", note: "cannot cut or hike" },
      { name: "Real Rates",  nameTh: "Real Yield", direction: "down", magnitude: "large", note: "deeply negative" },
    ],
    description: "High inflation + low growth = Fed trapped. Historically best gold environment.",
    descriptionTh: "เงินเฟ้อสูง + เศรษฐกิจซบเซา = Fed ติดกับดัก ทองขึ้นแรงที่สุดในสภาวะนี้",
    historicalAnalog: "1970s gold rose 2,300% (1971-1980)",
    historicalAnalogTh: "คล้าย 1970s — ทองขึ้น 2,300% ในทศวรรษ stagflation",
  },
  {
    id: "risk_off",
    name: "Global Risk-Off",
    nameTh: "Global Risk-Off",
    icon: "🌊",
    probability: 12,
    goldImpact: "very_bullish",
    goldImpactTh: "Very Bullish — capital flight to safe haven",
    goldImpactColor: "#34d399",
    timeframe: "1-6 months",
    timeframeTh: "1-6 เดือน",
    factors: [
      { name: "Equities", nameTh: "ตลาดหุ้น", direction: "down", magnitude: "large", note: "crash -20%+" },
      { name: "VIX",      nameTh: "VIX", direction: "up", magnitude: "large", note: "VIX > 40" },
      { name: "DXY",      nameTh: "ดอลลาร์", direction: "up", magnitude: "large", note: "flight to USD" },
      { name: "Gold",     nameTh: "ทอง", direction: "up", magnitude: "large", note: "safe haven bid" },
    ],
    description: "Geopolitical shock or financial crisis. Gold spikes as capital flees risk assets.",
    descriptionTh: "วิกฤตภูมิรัฐศาสตร์หรือการเงิน เงินไหลเข้าทองและ safe haven",
    historicalAnalog: "COVID crash 2020, Ukraine invasion 2022",
    historicalAnalogTh: "คล้าย COVID 2020 (ทองขึ้น), Ukraine 2022 (+$200 ใน 2 สัปดาห์)",
  },
  {
    id: "reflation",
    name: "Reflation",
    nameTh: "Reflation (Fed Easing)",
    icon: "💉",
    probability: 8,
    goldImpact: "bullish",
    goldImpactTh: "Bullish — Fed QE ใหม่ + fiscal stimulus",
    goldImpactColor: "#34d399",
    timeframe: "12-24 months",
    timeframeTh: "12-24 เดือน",
    factors: [
      { name: "Fed Balance Sheet", nameTh: "Fed QE", direction: "up", magnitude: "large", note: "new QE cycle" },
      { name: "Fiscal Spending",   nameTh: "งบประมาณ", direction: "up", magnitude: "large", note: "stimulus packages" },
      { name: "Inflation",         nameTh: "เงินเฟ้อ", direction: "up", magnitude: "moderate", note: "reflation" },
      { name: "Real Rates",        nameTh: "Real Yield", direction: "down", magnitude: "large", note: "negative" },
    ],
    description: "Policy stimulus creates new money supply expansion. Gold benefits from debasement.",
    descriptionTh: "QE ใหม่ + fiscal stimulus สร้าง M2 expansion ทองขึ้นจาก currency debasement",
    historicalAnalog: "2008-2012 QE era gold +166%",
    historicalAnalogTh: "คล้าย 2008-2012 QE era — ทองขึ้น 166%",
  },
];

let CACHE: { data: MacroScenarioPayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    let goldPrice = 3200;
    try {
      const r  = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      );
      const j  = await r.json();
      goldPrice = j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? goldPrice;
    } catch { /* fallback */ }

    const gp = Math.round(goldPrice);

    // Price ranges per scenario (based on current price + scenario impact multipliers)
    const RANGE_MULTIPLIERS: Record<string, [number, number]> = {
      soft_landing: [0.85, 1.05],
      recession:    [1.05, 1.25],
      stagflation:  [1.15, 1.45],
      risk_off:     [1.10, 1.35],
      reflation:    [1.10, 1.30],
    };

    const scenarios: MacroScenario[] = SCENARIOS.map(s => {
      const [lo, hi] = RANGE_MULTIPLIERS[s.id] ?? [0.9, 1.1];
      return {
        ...s,
        priceRangeLow:  Math.round(gp * lo / 50) * 50,
        priceRangeHigh: Math.round(gp * hi / 50) * 50,
      };
    });

    // Weighted price target
    const weightedTarget = Math.round(
      scenarios.reduce((s, sc) => s + ((sc.priceRangeLow + sc.priceRangeHigh) / 2) * (sc.probability / 100), 0)
    );

    const data: MacroScenarioPayload = {
      goldPrice:            gp,
      baseCase:             "soft_landing",  // current most likely
      scenarios,
      totalProbability:     SCENARIOS.reduce((s, sc) => s + sc.probability, 0),
      weightedGoldTarget:   Math.round(weightedTarget / 50) * 50,
      generatedAt:          new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
