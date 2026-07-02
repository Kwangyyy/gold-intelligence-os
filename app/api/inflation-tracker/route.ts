import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface InflationMetric {
  id: string;
  name: string;
  nameTh: string;
  value: number;        // current reading in %
  prevValue: number;    // previous reading
  change: number;       // MoM or YoY change in pp
  trend: "rising" | "falling" | "stable";
  trendColor: string;
  fedTarget: number;    // Fed's target (2% for most)
  vsTarget: number;     // value - fedTarget
  goldImpact: "bullish" | "neutral" | "bearish";
  goldImpactTh: string;
  releaseDate: string;  // "Jun 2026" etc
  period: string;       // "YoY" or "MoM"
}

export interface InflationTrackerPayload {
  goldPrice: number;
  yield10y: number;
  breakEvenInflation: number;  // nominal 10Y - real yield proxy
  realYield: number;
  goldVsInflation: "undervalued" | "fair" | "overvalued"; // gold implied inflation vs breakeven
  inflationEnvironment: "deflationary" | "below_target" | "at_target" | "above_target" | "high";
  inflationEnvironmentTh: string;
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  metrics: InflationMetric[];
  generatedAt: string;
}

// Static data — latest official releases as of mid-2026
// Updated: US CPI May 2026, PCE Apr 2026, PPI May 2026
const INFLATION_DATA: Omit<InflationMetric, "trend" | "trendColor">[] = [
  {
    id: "cpi_yoy",   name: "US CPI (YoY)",      nameTh: "CPI สหรัฐ (เทียบปีก่อน)",
    value: 2.4,      prevValue: 2.3,  change: +0.1, fedTarget: 2.0, vsTarget: +0.4,
    goldImpact: "bullish",
    goldImpactTh: "Bullish — CPI เหนือ target กระตุ้น demand ทอง hedge",
    releaseDate: "May 2026", period: "YoY",
  },
  {
    id: "core_cpi",  name: "Core CPI (YoY)",     nameTh: "Core CPI (ไม่รวมอาหาร/น้ำมัน)",
    value: 2.8,      prevValue: 3.0,  change: -0.2, fedTarget: 2.0, vsTarget: +0.8,
    goldImpact: "bullish",
    goldImpactTh: "Bullish — Core inflation เหนือ target หนุน safe-haven demand",
    releaseDate: "May 2026", period: "YoY",
  },
  {
    id: "pce_yoy",   name: "PCE (YoY)",           nameTh: "PCE (ดัชนี Fed ชอบ)",
    value: 2.2,      prevValue: 2.3,  change: -0.1, fedTarget: 2.0, vsTarget: +0.2,
    goldImpact: "neutral",
    goldImpactTh: "Neutral — PCE ใกล้ target แล้ว ความดันน้อยลง",
    releaseDate: "Apr 2026", period: "YoY",
  },
  {
    id: "core_pce",  name: "Core PCE (YoY)",      nameTh: "Core PCE (เป้าหมาย Fed)",
    value: 2.6,      prevValue: 2.8,  change: -0.2, fedTarget: 2.0, vsTarget: +0.6,
    goldImpact: "bullish",
    goldImpactTh: "Bullish — Core PCE เหนือ 2% = แรงกดทอง inflation hedge",
    releaseDate: "Apr 2026", period: "YoY",
  },
  {
    id: "ppi_yoy",   name: "PPI (YoY)",           nameTh: "ดัชนีราคาผู้ผลิต (PPI)",
    value: 1.7,      prevValue: 2.1,  change: -0.4, fedTarget: 2.0, vsTarget: -0.3,
    goldImpact: "neutral",
    goldImpactTh: "Neutral — PPI ต่ำกว่า target สะท้อน demand อ่อน",
    releaseDate: "May 2026", period: "YoY",
  },
  {
    id: "cpi_mom",   name: "CPI (MoM)",           nameTh: "CPI รายเดือน",
    value: 0.3,      prevValue: 0.2,  change: +0.1, fedTarget: 0.17, vsTarget: +0.13,
    goldImpact: "neutral",
    goldImpactTh: "Neutral — MoM เพิ่มขึ้น แต่ยังในเกณฑ์ปกติ",
    releaseDate: "May 2026", period: "MoM",
  },
];

type YJ = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };

async function yFetch(sym: string): Promise<number> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
    );
    const j = await r.json() as YJ;
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
  } catch { return 0; }
}

let CACHE: { data: InflationTrackerPayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldPrice, yield10y] = await Promise.all([
      yFetch("GC=F"),
      yFetch("^TNX"),
    ]);

    const y10 = yield10y || 4.47;
    const gold = goldPrice || 3200;

    // Breakeven: nominal - real (estimated real = CPI-based ~1.97%)
    const estimatedRealYield = 1.97;
    const breakEvenInflation = parseFloat((y10 - estimatedRealYield).toFixed(2));
    const realYield = estimatedRealYield;

    // Enrich metrics with derived fields
    const metrics: InflationMetric[] = INFLATION_DATA.map(m => ({
      ...m,
      trend: (m.change > 0.1 ? "rising" : m.change < -0.1 ? "falling" : "stable") as InflationMetric["trend"],
      trendColor: m.change > 0.1 ? "#f87171" : m.change < -0.1 ? "#34d399" : "#9ca3af",
    }));

    // Average inflation reading vs target
    const mainReadings = [2.4, 2.8, 2.2, 2.6]; // CPI, Core CPI, PCE, Core PCE
    const avgInflation = mainReadings.reduce((s, v) => s + v, 0) / mainReadings.length;

    const inflationEnvironment: InflationTrackerPayload["inflationEnvironment"] =
      avgInflation > 4 ? "high"
      : avgInflation > 2.5 ? "above_target"
      : avgInflation > 1.8 ? "at_target"
      : avgInflation > 0.5 ? "below_target"
      : "deflationary";

    const envLabels: Record<InflationTrackerPayload["inflationEnvironment"], string> = {
      high: "เงินเฟ้อสูง (>4%)",
      above_target: "เหนือเป้า (2-4%) — ยังร้อน",
      at_target: "ใกล้เป้า (~2%) — Fed พอใจ",
      below_target: "ต่ำกว่าเป้า (<2%) — deflation risk",
      deflationary: "ภาวะเงินฝืด — ระวัง",
    };

    // Gold vs inflation effectiveness
    // If breakeven > 2.5% → gold is reasonably priced as hedge
    // If breakeven < 2% → inflation expectations low → gold "overpriced" vs inflation
    const goldVsInflation: InflationTrackerPayload["goldVsInflation"] =
      breakEvenInflation > 2.6 ? "undervalued"  // market expects high inflation, gold should be higher
      : breakEvenInflation < 1.8 ? "overvalued" // market expects low inflation, gold priced above
      : "fair";

    const goldBias: InflationTrackerPayload["goldBias"] =
      inflationEnvironment === "high" || inflationEnvironment === "above_target" ? "bullish"
      : inflationEnvironment === "deflationary" ? "bearish"
      : "neutral";

    const data: InflationTrackerPayload = {
      goldPrice: Math.round(gold),
      yield10y: parseFloat(y10.toFixed(2)),
      breakEvenInflation,
      realYield: parseFloat(realYield.toFixed(2)),
      goldVsInflation,
      inflationEnvironment,
      inflationEnvironmentTh: envLabels[inflationEnvironment],
      goldBias,
      goldBiasTh: goldBias === "bullish"
        ? "Bullish — เงินเฟ้อเหนือ target = demand ทอง hedge สูง"
        : goldBias === "bearish"
        ? "Bearish — ภาวะเงินฝืด ลด demand ทองในฐานะ inflation hedge"
        : "Neutral — เงินเฟ้อใกล้เป้า Fed",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      metrics,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
