// Pure analytics for the Market Overview Dashboard.
// Real price fields come from the feed; everything here is derived or stubbed.
// Kept side-effect free so it can run server-side in the route handler and be
// unit-tested later.

import type {
  AiRecommendation,
  MarketCondition,
  NewsRisk,
  RecommendationLabel,
  RiskLevel,
  SessionInfo,
  TradingSession,
  VolatilityStatus,
} from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// ATR — true range over daily candles. Falls back to the latest day range.
// ---------------------------------------------------------------------------
export function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number {
  const n = Math.min(highs.length, lows.length, closes.length);
  if (n === 0) return 0;
  const trs: number[] = [];
  for (let i = 0; i < n; i++) {
    const prevClose = i > 0 ? closes[i - 1] : closes[i];
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - prevClose),
      Math.abs(lows[i] - prevClose)
    );
    trs.push(tr);
  }
  const window = trs.slice(-period);
  const sum = window.reduce((a, b) => a + b, 0);
  return window.length ? sum / window.length : 0;
}

// ---------------------------------------------------------------------------
// Volatility status — today's range relative to ATR.
// ---------------------------------------------------------------------------
export function deriveVolatility(dailyRange: number, atr: number): VolatilityStatus {
  if (atr <= 0) return "normal";
  const ratio = dailyRange / atr;
  if (ratio < 0.5) return "low";
  if (ratio < 1.0) return "normal";
  if (ratio < 1.6) return "elevated";
  return "extreme";
}

// ---------------------------------------------------------------------------
// Market condition — direction + volatility + liquidity.
// ---------------------------------------------------------------------------
export function deriveMarketCondition(
  changePercent: number,
  volatility: VolatilityStatus,
  sessionClosed: boolean
): MarketCondition {
  if (sessionClosed) return "low_liquidity";
  if (volatility === "extreme") return "high_volatility";
  if (changePercent >= 1.0) return "strong_bullish";
  if (changePercent >= 0.3) return "bullish";
  if (changePercent <= -1.0) return "strong_bearish";
  if (changePercent <= -0.3) return "bearish";
  return "sideway";
}

// ---------------------------------------------------------------------------
// Market score 0-100 — directional conviction.
// 50 = neutral. Combines daily change and the price's position in today's range.
// ---------------------------------------------------------------------------
export function computeMarketScore(
  changePercent: number,
  price: number,
  high: number,
  low: number
): number {
  let score = 50 + changePercent * 12;
  const range = high - low;
  if (range > 0) {
    const posInRange = (price - low) / range; // 0 (at low) .. 1 (at high)
    score += (posInRange - 0.5) * 24;
  }
  return Math.round(clamp(score, 0, 100));
}

// ---------------------------------------------------------------------------
// Session + open countdowns (all UTC-based).
// ---------------------------------------------------------------------------
function minutesUntilUtc(now: Date, hourUtc: number): number {
  const target = new Date(now);
  target.setUTCHours(hourUtc, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

export function getSession(now: Date = new Date()): SessionInfo {
  const h = now.getUTCHours();
  const day = now.getUTCDay(); // 0 Sun .. 6 Sat

  // Forex weekend: Saturday all day, and Sunday before 21:00 UTC (Sydney open).
  const weekendClosed = day === 6 || (day === 0 && h < 21);

  const londonOpen = !weekendClosed && h >= 7 && h < 16;
  const newYorkOpen = !weekendClosed && h >= 12 && h < 21;

  let current: TradingSession = "closed";
  if (!weekendClosed) {
    if (londonOpen && newYorkOpen) current = "london_newyork_overlap";
    else if (londonOpen) current = "london";
    else if (newYorkOpen) current = "newyork";
    else if (h >= 23 || h < 8) current = "tokyo";
    else if (h >= 21 || h < 6) current = "sydney";
    else current = "sydney";
  }

  return {
    current,
    minutesToLondonOpen: londonOpen ? 0 : minutesUntilUtc(now, 7),
    minutesToNewYorkOpen: newYorkOpen ? 0 : minutesUntilUtc(now, 12),
    londonOpen,
    newYorkOpen,
  };
}

// ---------------------------------------------------------------------------
// Stubbed AI recommendation — rule-based, but emits the full PRD §12 structure.
// Swap the body for an LLM call later; the return shape is the contract.
// ---------------------------------------------------------------------------
const PRD_DISCLAIMER = {
  th: "ข้อมูลนี้เป็นการวิเคราะห์เพื่อประกอบการตัดสินใจ ไม่ใช่การรับประกันผลกำไร การลงทุนมีความเสี่ยง โปรดศึกษาข้อมูลก่อนตัดสินใจ",
  en: "This is analysis to support your decision, not a guarantee of profit. Trading involves risk — do your own research before deciding.",
};

export function stubRecommendation(params: {
  changePercent: number;
  price: number;
  high: number;
  low: number;
  volatility: VolatilityStatus;
  marketScore: number;
  newsRisk: NewsRisk;
}): AiRecommendation {
  const { changePercent, price, high, low, volatility, marketScore, newsRisk } = params;

  let label: RecommendationLabel;
  let riskLevel: RiskLevel;
  let confidence: number;

  if (newsRisk.warning) {
    label = "high_news_risk";
    riskLevel = "extreme";
    confidence = 35;
  } else if (volatility === "extreme") {
    label = "wait";
    riskLevel = "high";
    confidence = 40;
  } else if (changePercent >= 1.0) {
    label = "buy";
    riskLevel = volatility === "elevated" ? "high" : "medium";
    confidence = 68;
  } else if (changePercent >= 0.3) {
    label = "buy_on_pullback";
    riskLevel = "medium";
    confidence = 64;
  } else if (changePercent <= -1.0) {
    label = "sell";
    riskLevel = volatility === "elevated" ? "high" : "medium";
    confidence = 66;
  } else if (changePercent <= -0.3) {
    label = "sell_on_rally";
    riskLevel = "medium";
    confidence = 62;
  } else {
    label = "wait";
    riskLevel = "low";
    confidence = 55;
  }

  // Nudge confidence by how decisive the market score is, then de-rate for news.
  confidence = Math.round(clamp(confidence + (Math.abs(marketScore - 50) / 50) * 10, 20, 90));
  if (newsRisk.level === "high") confidence = Math.max(20, confidence - 8);

  const bullishLabels: RecommendationLabel[] = ["buy", "buy_on_pullback", "strong_buy"];
  const bearishLabels: RecommendationLabel[] = ["sell", "sell_on_rally", "strong_sell"];
  const bullishBias = bullishLabels.includes(label);
  const bearishBias = bearishLabels.includes(label);

  const mainReasons = [
    {
      th: `ราคาทองเปลี่ยนแปลง ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}% จากราคาปิดก่อนหน้า`,
      en: `Gold is ${changePercent >= 0 ? "up" : "down"} ${changePercent.toFixed(2)}% versus the previous close`,
    },
    {
      th: `คะแนนตลาดอยู่ที่ ${marketScore}/100 (${marketScore >= 55 ? "ฝั่งซื้อได้เปรียบ" : marketScore <= 45 ? "ฝั่งขายได้เปรียบ" : "ค่อนข้างสมดุล"})`,
      en: `Market score is ${marketScore}/100 (${marketScore >= 55 ? "buyers in control" : marketScore <= 45 ? "sellers in control" : "fairly balanced"})`,
    },
    {
      th: `สถานะความผันผวน: ${volatilityTh(volatility)}`,
      en: `Volatility status: ${volatility}`,
    },
  ];

  const oppositeRisk = newsRisk.nextEvent
    ? {
        th: `ข่าว ${newsRisk.nextEvent.name.th} กำลังจะออก อาจทำให้ราคาผันผวนแรงและสวนทางกับมุมมองได้`,
        en: `Upcoming ${newsRisk.nextEvent.name.en} could trigger sharp moves against this view.`,
      }
    : {
        th: "หากแรงซื้อ/ขายเปลี่ยนทิศกะทันหัน มุมมองนี้อาจใช้ไม่ได้",
        en: "A sudden shift in order flow could invalidate this view.",
      };

  const invalidationLevel = bullishBias ? low : bearishBias ? high : null;
  const invalidation = invalidationLevel
    ? {
        th: `มุมมองนี้จะไม่สมบูรณ์หากราคาปิดต่ำ/สูงกว่า ${fmt(invalidationLevel)}`,
        en: `View is invalidated if price closes beyond ${fmt(invalidationLevel)}`,
      }
    : {
        th: "รอให้ราคาเลือกทาง โดยใช้กรอบ High/Low ของวันเป็นจุดสังเกต",
        en: "Wait for a breakout of today's high/low to confirm direction.",
      };

  const suggestedAction = suggestedActionFor(label);

  return {
    label,
    confidence,
    riskLevel,
    mainReasons,
    oppositeRisk,
    invalidation,
    suggestedAction,
    disclaimer: PRD_DISCLAIMER,
  };
}

function volatilityTh(v: VolatilityStatus): string {
  switch (v) {
    case "low":
      return "ต่ำ";
    case "normal":
      return "ปกติ";
    case "elevated":
      return "สูงขึ้น";
    case "extreme":
      return "สูงมาก";
  }
}

function suggestedActionFor(label: RecommendationLabel) {
  switch (label) {
    case "buy":
    case "strong_buy":
      return { th: "พิจารณาเข้าซื้อตามแผน ตั้ง SL เสมอ ไม่ไล่ราคา", en: "Consider longs per plan; always set a stop, don't chase." };
    case "buy_on_pullback":
      return { th: "รอราคาย่อแล้วค่อยเข้าซื้อ ไม่ไล่ราคา", en: "Wait for a pullback to go long; don't chase price." };
    case "sell":
    case "strong_sell":
      return { th: "พิจารณาเข้าขายตามแผน ตั้ง SL เสมอ", en: "Consider shorts per plan; always set a stop." };
    case "sell_on_rally":
      return { th: "รอราคาเด้งขึ้นแล้วค่อยพิจารณาขาย", en: "Wait for a rally to consider shorts." };
    case "high_news_risk":
      return { th: "หลีกเลี่ยงการเปิดออเดอร์ใหม่ก่อนข่าวออก ลดความเสี่ยง", en: "Avoid new entries before the news; reduce risk." };
    case "no_trade":
      return { th: "ยังไม่มีสัญญาณที่ชัดเจน ควรรอ", en: "No clear edge — stand aside." };
    case "wait":
    default:
      return { th: "ตลาดยังไม่ชัดเจน รอจังหวะที่ดีกว่า", en: "Market unclear — wait for a better setup." };
  }
}

// Simulated spread (mock). Real value would come from the broker feed.
export function estimateSpread(price: number, volatility: VolatilityStatus): number {
  const base = 0.18; // ~18 cents typical for XAUUSD
  const mult = volatility === "extreme" ? 2.6 : volatility === "elevated" ? 1.6 : 1;
  // tiny deterministic-ish jitter from the price's cents
  const jitter = ((Math.round(price * 100) % 7) - 3) * 0.01;
  return Math.max(0.08, +(base * mult + jitter).toFixed(2));
}
