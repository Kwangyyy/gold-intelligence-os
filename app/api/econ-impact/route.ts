import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface EconEvent {
  date: string;
  time: string;
  currency: string;
  title: string;
  impact: "High" | "Medium" | "Low";
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  // derived
  goldImpactScore: number;  // 0-10 how much this typically moves gold
  goldBias: "bullish" | "bearish" | "mixed" | "neutral";
  explanation: string;
  explanationTh: string;
  hoursUntil: number | null;
  isToday: boolean;
  isThisWeek: boolean;
}

export interface EconImpactPayload {
  events: EconEvent[];
  highImpactCount: number;
  nextHighImpact: EconEvent | null;
  weeklyRiskScore: number;  // 0-10 aggregate risk level
  weeklyRiskLabel: string;
  weeklyRiskLabelTh: string;
  goldBiasFromEvents: "bullish" | "bearish" | "mixed" | "neutral";
  generatedAt: string;
}

// Historical gold impact ratings per event type
const GOLD_IMPACT_MAP: Record<string, { score: number; bias: "bullish" | "bearish" | "mixed" }> = {
  "Non-Farm":       { score: 9.5, bias: "mixed" },
  "NFP":            { score: 9.5, bias: "mixed" },
  "CPI":            { score: 9,   bias: "mixed" },
  "Inflation":      { score: 8.5, bias: "bullish" },
  "PCE":            { score: 8.5, bias: "mixed" },
  "FOMC":           { score: 9.5, bias: "mixed" },
  "Federal Reserve":{ score: 9,   bias: "mixed" },
  "Fed Chair":      { score: 8.5, bias: "mixed" },
  "Interest Rate":  { score: 8,   bias: "mixed" },
  "GDP":            { score: 7,   bias: "bearish" },
  "Retail Sales":   { score: 6,   bias: "bearish" },
  "Unemployment":   { score: 7.5, bias: "mixed" },
  "PMI":            { score: 5,   bias: "mixed" },
  "ISM":            { score: 5.5, bias: "mixed" },
  "PPI":            { score: 7,   bias: "bullish" },
  "Consumer Confidence": { score: 5, bias: "mixed" },
  "Durable Goods":  { score: 5,   bias: "mixed" },
  "Housing":        { score: 4,   bias: "mixed" },
  "Trade Balance":  { score: 4.5, bias: "mixed" },
  "Treasury":       { score: 7,   bias: "mixed" },
  "Powell":         { score: 8.5, bias: "mixed" },
};

function scoreEvent(title: string, impact: string): { score: number; bias: "bullish" | "bearish" | "mixed" | "neutral" } {
  for (const [keyword, val] of Object.entries(GOLD_IMPACT_MAP)) {
    if (title.toLowerCase().includes(keyword.toLowerCase())) {
      return { score: val.score, bias: val.bias };
    }
  }
  // Fallback by FF impact level
  return impact === "High"   ? { score: 5, bias: "mixed" }
       : impact === "Medium" ? { score: 3, bias: "neutral" }
       :                       { score: 1, bias: "neutral" };
}

function getExplanation(title: string, bias: string): { en: string; th: string } {
  const t = title.toLowerCase();
  if (t.includes("nfp") || t.includes("non-farm"))
    return { en: "NFP is the most market-moving report — surprises above/below consensus can cause $20-50 gold swings.", th: "NFP คือรายงานสำคัญที่สุด — ตัวเลขต่างจากคาดมักทำให้ทองเคลื่อน $20-50 ในไม่กี่นาที" };
  if (t.includes("fomc") || t.includes("federal reserve") || t.includes("interest rate"))
    return { en: "Fed rate decisions directly impact gold — dovish signals boost gold, hawkish signals pressure it.", th: "การตัดสินใจ Fed กระทบทองโดยตรง — Dovish ดีต่อทอง Hawkish กดดันทอง" };
  if (t.includes("cpi") || t.includes("inflation"))
    return { en: "High inflation data supports gold as an inflation hedge; below-forecast CPI can push gold lower.", th: "เงินเฟ้อสูงหนุนทองในฐานะ inflation hedge — CPI ต่ำกว่าคาดอาจกดดันทอง" };
  if (t.includes("pce"))
    return { en: "PCE is the Fed's preferred inflation gauge — data above forecast implies delayed rate cuts, bearish for gold.", th: "PCE คือตัวชี้วัดเงินเฟ้อที่ Fed ชอบ — สูงกว่าคาดอาจล่าช้าการลดดอกเบี้ย กดดันทอง" };
  if (t.includes("gdp"))
    return { en: "Strong GDP typically strengthens USD which pressures gold, but geopolitical context matters.", th: "GDP แข็งแกร่งมักเสริม USD กดดันทอง แต่ขึ้นอยู่กับ context ภูมิรัฐศาสตร์" };
  if (t.includes("powell"))
    return { en: "Fed Chair Powell speeches can shift market expectations significantly for rate paths.", th: "คำพูด Powell อาจเปลี่ยน market expectations เรื่อง rate path ได้อย่างมีนัยสำคัญ" };
  return { en: `${bias === "bullish" ? "This event historically benefits gold." : bias === "bearish" ? "This event historically pressures gold." : "Mixed historical impact on gold."}`, th: `${bias === "bullish" ? "เหตุการณ์นี้มักเป็นบวกต่อทองคำ" : bias === "bearish" ? "เหตุการณ์นี้มักกดดันทองคำ" : "ผลต่อทองคำมีทั้งบวกและลบ"}` };
}

let CACHE: { data: EconImpactPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const ffUrl = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
    const res = await fetch(ffUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) throw new Error(`FF calendar ${res.status}`);
    const raw: { date: string; time: string; currency: string; impact: string; title: string; forecast: string | null; previous: string | null; actual: string | null }[] = await res.json();

    const now = Date.now();
    const events: EconEvent[] = raw
      .filter(e => e.currency === "USD" || ["XAU", "EUR", "GBP", "CNY"].includes(e.currency))
      .map(e => {
        const { score, bias } = scoreEvent(e.title, e.impact);
        const { en, th } = getExplanation(e.title, bias);
        const eventTs = new Date(`${e.date}T${e.time?.replace(" ET", "") || "00:00"}:00-05:00`).getTime();
        const hoursUntil = Number.isFinite(eventTs) ? (eventTs - now) / 3.6e6 : null;
        const today = new Date().toDateString();
        const eventDay = new Date(e.date).toDateString();
        return {
          date: e.date, time: e.time || "", currency: e.currency,
          title: e.title,
          impact: e.impact as "High" | "Medium" | "Low",
          forecast: e.forecast, previous: e.previous, actual: e.actual,
          goldImpactScore: score, goldBias: bias,
          explanation: en, explanationTh: th,
          hoursUntil, isToday: eventDay === today, isThisWeek: true,
        };
      })
      .sort((a, b) => new Date(a.date + "T" + (a.time || "00:00")).getTime() - new Date(b.date + "T" + (b.time || "00:00")).getTime());

    const highImpact = events.filter(e => e.impact === "High");
    const nextHigh   = highImpact.find(e => e.hoursUntil === null || e.hoursUntil > 0) ?? highImpact[0] ?? null;

    // Weekly risk score = avg of top-3 gold impact scores
    const top3 = [...events].sort((a, b) => b.goldImpactScore - a.goldImpactScore).slice(0, 3);
    const weeklyRisk = top3.length ? top3.reduce((a, e) => a + e.goldImpactScore, 0) / top3.length : 3;

    const riskLabel   = weeklyRisk >= 8 ? "Very High" : weeklyRisk >= 6 ? "High" : weeklyRisk >= 4 ? "Medium" : "Low";
    const riskLabelTh = weeklyRisk >= 8 ? "สูงมาก" : weeklyRisk >= 6 ? "สูง" : weeklyRisk >= 4 ? "ปานกลาง" : "ต่ำ";

    // Overall bias from high-impact events
    const bullCount = events.filter(e => e.impact === "High" && e.goldBias === "bullish").length;
    const bearCount = events.filter(e => e.impact === "High" && e.goldBias === "bearish").length;
    const weekBias = bullCount > bearCount ? "bullish" : bearCount > bullCount ? "bearish" : bullCount + bearCount > 0 ? "mixed" : "neutral";

    const data: EconImpactPayload = {
      events,
      highImpactCount: highImpact.length,
      nextHighImpact: nextHigh,
      weeklyRiskScore: +weeklyRisk.toFixed(1),
      weeklyRiskLabel: riskLabel,
      weeklyRiskLabelTh: riskLabelTh,
      goldBiasFromEvents: weekBias,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
