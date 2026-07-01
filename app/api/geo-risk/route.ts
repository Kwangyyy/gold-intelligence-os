import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface GeoRiskEvent {
  id: string;
  region: string;
  regionTh: string;
  event: string;
  eventTh: string;
  riskLevel: "extreme" | "high" | "medium" | "low";
  riskColor: string;
  goldImpact: "very_bullish" | "bullish" | "neutral" | "bearish";
  goldImpactTh: string;
  goldImpactColor: string;
  category: "war" | "sanctions" | "trade" | "political" | "financial" | "energy";
  isActive: boolean;
  lastUpdated: string;
}

export interface GeoRiskPayload {
  compositeRiskScore: number;   // 0-100
  riskLevel: "extreme" | "high" | "medium" | "low";
  riskLevelTh: string;
  riskColor: string;
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  events: GeoRiskEvent[];
  activeConflicts: number;
  activeSanctions: number;
  tradeDisputes: number;
  safeHavenDemand: "high" | "elevated" | "moderate" | "low";
  safeHavenTh: string;
  goldPrice: number;
  goldVix: number;       // VIX as proxy for global fear
  generatedAt: string;
}

async function fetchVixAndGold() {
  try {
    const [vixR, goldR] = await Promise.all([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=5d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
    ]);
    type YJ = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } } | null;
    const vixJ = await vixR.json() as YJ;
    const goldJ = await goldR.json() as YJ;
    return {
      vix:  vixJ?.chart?.result?.[0]?.meta?.regularMarketPrice  ?? 20,
      gold: goldJ?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3200,
    };
  } catch { return { vix: 20, gold: 3200 }; }
}

// Static geopolitical risk events (regularly updated in real app)
// These represent current ongoing situations (as of mid-2025)
const GEO_EVENTS: GeoRiskEvent[] = [
  {
    id: "russia-ukraine",
    region: "Europe / Eurasia", regionTh: "ยุโรป / ยูเรเซีย",
    event: "Russia-Ukraine War (ongoing)", eventTh: "สงครามรัสเซีย-ยูเครน (ดำเนินต่อ)",
    riskLevel: "extreme", riskColor: "#f87171",
    goldImpact: "very_bullish", goldImpactTh: "Bullish มาก — สงครามหนุนทอง safe haven",
    goldImpactColor: "#34d399",
    category: "war", isActive: true, lastUpdated: "2025-07",
  },
  {
    id: "middle-east",
    region: "Middle East", regionTh: "ตะวันออกกลาง",
    event: "Israel-Gaza conflict + regional tensions", eventTh: "ความขัดแย้งอิสราเอล-กาซา + ความตึงเครียดภูมิภาค",
    riskLevel: "high", riskColor: "#f97316",
    goldImpact: "bullish", goldImpactTh: "Bullish — ความไม่แน่นอน safe haven demand",
    goldImpactColor: "#86efac",
    category: "war", isActive: true, lastUpdated: "2025-07",
  },
  {
    id: "us-china-trade",
    region: "US-China", regionTh: "สหรัฐ-จีน",
    event: "US-China trade tensions & tariffs", eventTh: "ความตึงเครียดการค้า + ภาษีสหรัฐ-จีน",
    riskLevel: "high", riskColor: "#f97316",
    goldImpact: "bullish", goldImpactTh: "Bullish — ดอลลาร์อ่อน + ซื้อทองป้องกัน",
    goldImpactColor: "#86efac",
    category: "trade", isActive: true, lastUpdated: "2025-06",
  },
  {
    id: "taiwan-strait",
    region: "Asia Pacific", regionTh: "เอเชียแปซิฟิก",
    event: "Taiwan Strait tensions (China-Taiwan)", eventTh: "ความตึงเครียดช่องแคบไต้หวัน",
    riskLevel: "medium", riskColor: "#f5c451",
    goldImpact: "bullish", goldImpactTh: "Bullish เมื่อความตึงเครียดสูงขึ้น",
    goldImpactColor: "#86efac",
    category: "political", isActive: true, lastUpdated: "2025-05",
  },
  {
    id: "iran-sanctions",
    region: "Middle East", regionTh: "ตะวันออกกลาง",
    event: "Iran nuclear program / US sanctions", eventTh: "โปรแกรมนิวเคลียร์อิหร่าน / มาตรการคว่ำบาตรสหรัฐ",
    riskLevel: "medium", riskColor: "#f5c451",
    goldImpact: "bullish", goldImpactTh: "Bullish — ความเสี่ยงน้ำมัน + geopolitical premium",
    goldImpactColor: "#86efac",
    category: "sanctions", isActive: true, lastUpdated: "2025-06",
  },
  {
    id: "us-debt",
    region: "United States", regionTh: "สหรัฐอเมริกา",
    event: "US fiscal deficit & debt ceiling concerns", eventTh: "ขาดดุลงบสหรัฐ + ความกังวลเพดานหนี้",
    riskLevel: "medium", riskColor: "#f5c451",
    goldImpact: "bullish", goldImpactTh: "Bullish ระยะยาว — USD ด้อยค่า → ซื้อทองสำรอง",
    goldImpactColor: "#86efac",
    category: "financial", isActive: true, lastUpdated: "2025-07",
  },
  {
    id: "north-korea",
    region: "East Asia", regionTh: "เอเชียตะวันออก",
    event: "North Korea missile tests / nuclear posture", eventTh: "ทดสอบขีปนาวุธเกาหลีเหนือ",
    riskLevel: "medium", riskColor: "#f5c451",
    goldImpact: "neutral", goldImpactTh: "Neutral — ตลาดรับรู้แล้ว ผลกระทบระยะสั้น",
    goldImpactColor: "#9ca3af",
    category: "political", isActive: true, lastUpdated: "2025-04",
  },
  {
    id: "russia-sanctions",
    region: "Europe / Russia", regionTh: "ยุโรป / รัสเซีย",
    event: "Western sanctions on Russia (oil, finance)", eventTh: "มาตรการคว่ำบาตรรัสเซีย (น้ำมัน, การเงิน)",
    riskLevel: "high", riskColor: "#f97316",
    goldImpact: "bullish", goldImpactTh: "Bullish — รัสเซียและพันธมิตรสำรองทองแทน USD",
    goldImpactColor: "#86efac",
    category: "sanctions", isActive: true, lastUpdated: "2025-06",
  },
];

let CACHE: { data: GeoRiskPayload; ts: number } | null = null;
const TTL = 2 * 60 * 60 * 1000; // 2h (geo risk doesn't change hourly)

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const { vix, gold } = await fetchVixAndGold();

    // Composite risk score from events
    const riskWeights = { extreme: 30, high: 20, medium: 12, low: 5 };
    const rawScore = GEO_EVENTS.filter(e => e.isActive)
      .reduce((sum, e) => sum + riskWeights[e.riskLevel], 0);
    const compositeRiskScore = Math.min(100, Math.round(rawScore));

    // VIX adjustment: high VIX amplifies geo risk
    const vixBoost = vix > 25 ? 10 : vix > 20 ? 5 : 0;
    const finalScore = Math.min(100, compositeRiskScore + vixBoost);

    let riskLevel: GeoRiskPayload["riskLevel"];
    let riskLevelTh: string;
    let riskColor: string;

    if (finalScore >= 70) { riskLevel = "extreme"; riskLevelTh = "Extreme Risk"; riskColor = "#f87171"; }
    else if (finalScore >= 50) { riskLevel = "high"; riskLevelTh = "High Risk"; riskColor = "#f97316"; }
    else if (finalScore >= 30) { riskLevel = "medium"; riskLevelTh = "Medium Risk"; riskColor = "#f5c451"; }
    else { riskLevel = "low"; riskLevelTh = "Low Risk"; riskColor = "#34d399"; }

    const bullishEvents = GEO_EVENTS.filter(e => e.isActive && (e.goldImpact === "bullish" || e.goldImpact === "very_bullish")).length;
    const goldBias: GeoRiskPayload["goldBias"] = bullishEvents >= 3 ? "bullish" : bullishEvents >= 1 ? "neutral" : "bearish";

    const safeHavenDemand: GeoRiskPayload["safeHavenDemand"] =
      finalScore >= 70 ? "high" : finalScore >= 50 ? "elevated" : finalScore >= 30 ? "moderate" : "low";

    const data: GeoRiskPayload = {
      compositeRiskScore: finalScore,
      riskLevel, riskLevelTh, riskColor,
      goldBias,
      goldBiasTh: goldBias === "bullish" ? "Bullish — ความเสี่ยงภูมิรัฐศาสตร์หนุนทอง" : goldBias === "bearish" ? "Bearish — ตลาดสงบ กดดันทอง" : "Neutral — ผสมกัน",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      events: GEO_EVENTS.sort((a, b) => {
        const order = { extreme: 0, high: 1, medium: 2, low: 3 };
        return order[a.riskLevel] - order[b.riskLevel];
      }),
      activeConflicts: GEO_EVENTS.filter(e => e.isActive && e.category === "war").length,
      activeSanctions: GEO_EVENTS.filter(e => e.isActive && e.category === "sanctions").length,
      tradeDisputes:   GEO_EVENTS.filter(e => e.isActive && e.category === "trade").length,
      safeHavenDemand,
      safeHavenTh: { high: "สูงมาก — Extreme safe-haven demand", elevated: "สูง — Elevated demand", moderate: "ปานกลาง — Normal demand", low: "ต่ำ — Risk-on environment" }[safeHavenDemand],
      goldPrice: +gold.toFixed(0),
      goldVix: +vix.toFixed(1),
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
