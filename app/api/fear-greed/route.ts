import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface FearGreedComponent {
  name: string;
  nameTh: string;
  value: number;    // 0-100
  signal: "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";
  weight: number;   // contribution weight
  description: string;
  descriptionTh: string;
}

export interface FearGreedPayload {
  score: number;     // 0-100
  label: string;
  labelTh: string;
  color: string;
  components: FearGreedComponent[];
  goldImplication: string;
  goldImplicationTh: string;
  historicalContext: { period: string; score: number; label: string }[];
  generatedAt: string;
}

function classify(score: number): { label: string; labelTh: string; color: string; signal: FearGreedComponent["signal"] } {
  if (score <= 20) return { label: "Extreme Fear",  labelTh: "กลัวสุดขีด",  color: "#f87171", signal: "extreme_fear"  };
  if (score <= 40) return { label: "Fear",          labelTh: "กลัว",         color: "#f97316", signal: "fear"          };
  if (score <= 60) return { label: "Neutral",       labelTh: "เป็นกลาง",    color: "#f5c451", signal: "neutral"       };
  if (score <= 80) return { label: "Greed",         labelTh: "โลภ",          color: "#6ee7b7", signal: "greed"         };
  return               { label: "Extreme Greed", labelTh: "โลภสุดขีด",  color: "#34d399", signal: "extreme_greed" };
}

async function fetchPrice(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
}

async function fetchReturns5d(symbol: string): Promise<{ returns: number[]; current: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=30d&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  if (!result) return null;
  const closes: (number|null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const valid = closes.filter((c): c is number => c != null);
  if (valid.length < 6) return null;
  const returns = valid.slice(1).map((c, i) => (c - valid[i]) / valid[i] * 100);
  return { returns: returns.slice(-5), current: valid.at(-1) ?? 0 };
}

let CACHE: { data: FearGreedPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch relevant data
    const [vixP, spxData, goldData, tltData, dxyData] = await Promise.all([
      fetchPrice("%5EVIX"),
      fetchReturns5d("%5EGSPC"),
      fetchReturns5d("GC%3DF"),
      fetchReturns5d("TLT"),
      fetchReturns5d("DX-Y.NYB"),
    ]);

    const components: FearGreedComponent[] = [];

    // 1. VIX (Market Volatility)
    if (vixP != null) {
      const vixScore = Math.max(0, Math.min(100, 100 - (vixP - 10) / 40 * 100));
      const c = classify(vixScore);
      components.push({
        name: "Market Volatility (VIX)", nameTh: "ความผันผวน (VIX)",
        value: +vixScore.toFixed(1), signal: c.signal, weight: 0.25,
        description: `VIX = ${vixP.toFixed(1)}. ${vixP < 15 ? "Low fear, complacency." : vixP > 30 ? "High fear in market." : "Moderate uncertainty."}`,
        descriptionTh: `VIX = ${vixP.toFixed(1)}. ${vixP < 15 ? "ความกลัวต่ำ — ตลาดมั่นใจเกินไป" : vixP > 30 ? "ความกลัวสูง — นักลงทุนหนีความเสี่ยง" : "ความไม่แน่นอนปานกลาง"}`,
      });
    }

    // 2. S&P 500 momentum (5-day)
    if (spxData) {
      const sum5d = spxData.returns.reduce((a, v) => a + v, 0);
      const spxScore = Math.max(0, Math.min(100, 50 + sum5d * 5));
      const c = classify(spxScore);
      components.push({
        name: "Stock Momentum (S&P 500)", nameTh: "Momentum หุ้น (S&P 500)",
        value: +spxScore.toFixed(1), signal: c.signal, weight: 0.20,
        description: `S&P 500 5-day return: ${sum5d > 0 ? "+" : ""}${sum5d.toFixed(2)}%. ${sum5d > 2 ? "Strong bullish momentum." : sum5d < -2 ? "Bearish momentum, fear rising." : "Neutral."}`,
        descriptionTh: `S&P 500 5 วัน: ${sum5d > 0 ? "+" : ""}${sum5d.toFixed(2)}%. ${sum5d > 2 ? "momentum ขาขึ้นแข็ง" : sum5d < -2 ? "momentum ขาลง ความกลัวสูงขึ้น" : "เป็นกลาง"}`,
      });
    }

    // 3. Gold relative to stocks (safe-haven demand)
    if (goldData && spxData) {
      const goldSum = goldData.returns.reduce((a, v) => a + v, 0);
      const spxSum  = spxData.returns.reduce((a, v) => a + v, 0);
      const relScore = goldSum - spxSum; // positive = gold outperforming = fear
      const goldFearScore = Math.max(0, Math.min(100, 50 - relScore * 8));
      const c = classify(goldFearScore);
      components.push({
        name: "Safe-Haven Demand (Gold vs Stocks)", nameTh: "Demand Safe-Haven (ทองเทียบหุ้น)",
        value: +goldFearScore.toFixed(1), signal: c.signal, weight: 0.20,
        description: `Gold 5d: ${goldSum > 0 ? "+" : ""}${goldSum.toFixed(2)}% vs S&P ${spxSum > 0 ? "+" : ""}${spxSum.toFixed(2)}%. ${goldSum > spxSum + 1 ? "Gold outperforming = fear signal." : "Stocks leading = risk-on."}`,
        descriptionTh: `ทอง 5 วัน: ${goldSum > 0 ? "+" : ""}${goldSum.toFixed(2)}% เทียบ S&P ${spxSum > 0 ? "+" : ""}${spxSum.toFixed(2)}%. ${goldSum > spxSum + 1 ? "ทองนำ = fear signal" : "หุ้นนำ = risk-on"}`,
      });
    }

    // 4. Bond demand (TLT)
    if (tltData) {
      const tltSum = tltData.returns.reduce((a, v) => a + v, 0);
      const tltScore = Math.max(0, Math.min(100, 50 - tltSum * 10));
      const c = classify(tltScore);
      components.push({
        name: "Bond Demand (TLT)", nameTh: "Demand พันธบัตร (TLT)",
        value: +tltScore.toFixed(1), signal: c.signal, weight: 0.20,
        description: `TLT 5d: ${tltSum > 0 ? "+" : ""}${tltSum.toFixed(2)}%. ${tltSum > 1 ? "Flight to bonds = fear." : tltSum < -1 ? "Selling bonds = risk-on." : "Neutral bond demand."}`,
        descriptionTh: `TLT 5 วัน: ${tltSum > 0 ? "+" : ""}${tltSum.toFixed(2)}%. ${tltSum > 1 ? "นักลงทุนหนีเข้าพันธบัตร = fear" : tltSum < -1 ? "ขายพันธบัตร = risk-on" : "เป็นกลาง"}`,
      });
    }

    // 5. USD strength (inverse: strong USD = more fear)
    if (dxyData) {
      const dxySum = dxyData.returns.reduce((a, v) => a + v, 0);
      const dxyScore = Math.max(0, Math.min(100, 50 - dxySum * 15));
      const c = classify(dxyScore);
      components.push({
        name: "USD Strength (DXY)", nameTh: "ความแข็งแกร่ง USD (DXY)",
        value: +dxyScore.toFixed(1), signal: c.signal, weight: 0.15,
        description: `DXY 5d: ${dxySum > 0 ? "+" : ""}${dxySum.toFixed(2)}%. ${dxySum > 0.5 ? "Rising USD = risk-off." : dxySum < -0.5 ? "Falling USD = risk-on." : "Stable."}`,
        descriptionTh: `DXY 5 วัน: ${dxySum > 0 ? "+" : ""}${dxySum.toFixed(2)}%. ${dxySum > 0.5 ? "USD แข็ง = risk-off" : dxySum < -0.5 ? "USD อ่อน = risk-on" : "เสถียร"}`,
      });
    }

    if (!components.length) throw new Error("No component data available");

    // Weighted average
    const totalWeight = components.reduce((a, c) => a + c.weight, 0);
    const score = components.reduce((a, c) => a + c.value * c.weight, 0) / totalWeight;
    const { label, labelTh, color } = classify(score);

    let goldImpl = "", goldImplTh = "";
    if (score <= 25)      { goldImpl = "Extreme fear = strong gold bullish signal. Historically best gold buying zone."; goldImplTh = "Fear สูงสุด = สัญญาณ bullish ทอง แข็งแกร่งที่สุด Zone ซื้อทองที่ดีที่สุดในประวัติศาสตร์"; }
    else if (score <= 45) { goldImpl = "Fear zone = gold tends to outperform. Consider bullish bias."; goldImplTh = "Zone Fear = ทองมักทำผลดี พิจารณา bias bullish"; }
    else if (score <= 55) { goldImpl = "Neutral — no clear fear/greed signal for gold."; goldImplTh = "เป็นกลาง — ไม่มีสัญญาณ fear/greed ชัดเจนสำหรับทอง"; }
    else if (score <= 75) { goldImpl = "Greed zone — equities preferred, gold may underperform short-term."; goldImplTh = "Zone Greed — นักลงทุนชอบหุ้น ทองอาจ underperform ระยะสั้น"; }
    else                  { goldImpl = "Extreme greed = potential contrarian sell signal. Gold historically weak here."; goldImplTh = "Greed สุดขีด = สัญญาณ contrarian ขายที่น่าพิจารณา ทองมักอ่อนแอ"; }

    const data: FearGreedPayload = {
      score: +score.toFixed(1),
      label, labelTh, color,
      components,
      goldImplication: goldImpl,
      goldImplicationTh: goldImplTh,
      historicalContext: [
        { period: "COVID Crash (Mar 2020)", score: 2,  label: "Extreme Fear" },
        { period: "Gold ATH (Aug 2020)",    score: 35, label: "Fear" },
        { period: "Crypto Mania (Nov 2021)",score: 84, label: "Extreme Greed" },
        { period: "Rate Hike Fears (Jun 2022)", score: 5, label: "Extreme Fear" },
        { period: "Gold ATH 2024-25",       score: 42, label: "Fear" },
      ],
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
