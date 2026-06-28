// What-if Scenario engine (Module 15). Pure, client-safe. Estimates gold's
// reaction to macro/technical events as a multiple of daily ATR, then the P/L
// impact on the user's hypothetical position. Heuristic, not a prediction.

import type { Bilingual } from "./types";

export type GoldDirection = "bullish" | "bearish";
export type DrawdownRisk = "low" | "medium" | "high" | "extreme";

export interface ScenarioDef {
  key: string; // i18n key
  goldDirection: GoldDirection; // typical reaction of gold
  atrMultiple: number; // expected move size in daily-ATR units
  action: Bilingual;
  alternative: Bilingual;
}

// Typical gold reactions (USD/Fed/safe-haven logic). Magnitudes are ATR multiples.
export const SCENARIOS: ScenarioDef[] = [
  {
    key: "sc_cpi_hot",
    goldDirection: "bearish",
    atrMultiple: 1.8,
    action: { th: "ลดความเสี่ยงฝั่งซื้อ รอราคานิ่งก่อนเข้า", en: "Trim longs; wait for price to settle before entries." },
    alternative: { th: "ถ้าทองยืนเหนือแนวรับสำคัญได้ อาจเป็นสัญญาณกลับตัว", en: "If gold holds key support, watch for a reversal." },
  },
  {
    key: "sc_cpi_cool",
    goldDirection: "bullish",
    atrMultiple: 1.8,
    action: { th: "มองหาจังหวะซื้อตามแนวโน้ม ตั้ง SL เสมอ", en: "Look for trend-following longs; always set a stop." },
    alternative: { th: "ถ้าราคาไม่ผ่านแนวต้าน อาจเป็นแค่เด้งสั้น", en: "If resistance holds, it may be only a short bounce." },
  },
  {
    key: "sc_fed_hawkish",
    goldDirection: "bearish",
    atrMultiple: 1.5,
    action: { th: "ระวังฝั่งซื้อ ดอลลาร์/บอนด์ยีลด์มักแข็งค่า", en: "Be cautious on longs; USD/yields tend to firm." },
    alternative: { th: "หากตลาดรับรู้ข่าวไปแล้ว อาจ sell the fact", en: "If already priced in, a 'sell-the-fact' bounce is possible." },
  },
  {
    key: "sc_fed_dovish",
    goldDirection: "bullish",
    atrMultiple: 1.5,
    action: { th: "ทองมักได้แรงหนุนจากดอลลาร์อ่อน", en: "Gold usually benefits from a softer dollar." },
    alternative: { th: "ระวังย่อหากราคาขึ้นมาเร็วเกินไป", en: "Expect pullbacks if the move is too fast." },
  },
  {
    key: "sc_dxy_up",
    goldDirection: "bearish",
    atrMultiple: 1.2,
    action: { th: "ดอลลาร์แข็งกดดันทอง พิจารณาลดสถานะซื้อ", en: "A stronger dollar pressures gold; consider reducing longs." },
    alternative: { th: "ถ้า DXY ชนแนวต้านแล้วอ่อนตัว ทองอาจฟื้น", en: "If DXY stalls at resistance, gold may recover." },
  },
  {
    key: "sc_yield_spike",
    goldDirection: "bearish",
    atrMultiple: 1.3,
    action: { th: "ยีลด์พุ่งกดดันสินทรัพย์ไม่มีดอกเบี้ยอย่างทอง", en: "Rising yields weigh on non-yielding gold." },
    alternative: { th: "หากยีลด์กลับตัวลง ทองมักดีดแรง", en: "If yields reverse down, gold often rebounds sharply." },
  },
  {
    key: "sc_geopolitics",
    goldDirection: "bullish",
    atrMultiple: 2.0,
    action: { th: "แรงซื้อสินทรัพย์ปลอดภัยหนุนทอง แต่ผันผวนสูง", en: "Safe-haven demand lifts gold, but volatility spikes." },
    alternative: { th: "ความผันผวนสูงมาก ใช้ขนาดล็อตเล็กลง", en: "Use smaller size — volatility can whipsaw both ways." },
  },
  {
    key: "sc_break_resistance",
    goldDirection: "bullish",
    atrMultiple: 1.0,
    action: { th: "เบรกแนวต้าน มองหาการเข้าซื้อตามจังหวะย่อ (retest)", en: "On a breakout, look to buy the retest." },
    alternative: { th: "ระวัง false breakout หากปริมาณไม่หนุน", en: "Beware a false breakout if volume doesn't confirm." },
  },
  {
    key: "sc_break_support",
    goldDirection: "bearish",
    atrMultiple: 1.0,
    action: { th: "หลุดแนวรับ พิจารณาฝั่งขายตามจังหวะเด้ง (retest)", en: "On a breakdown, consider selling the retest." },
    alternative: { th: "ระวัง bear trap หากราคากลับขึ้นเหนือแนวรับเดิม", en: "Beware a bear trap if price reclaims the level." },
  },
];

export interface ScenarioResult {
  key: string;
  goldDirection: GoldDirection;
  moveDollars: number; // signed price move ($), + up / - down
  movePct: number; // signed %
  targetPrice: number;
  pnl: number; // $ impact on the user's position
  adverse: boolean;
  drawdownRisk: DrawdownRisk;
  action: Bilingual;
  alternative: Bilingual;
}

export interface Position {
  lots: number;
  direction: "buy" | "sell";
}

const USD_PER_DOLLAR_MOVE_PER_LOT = 100; // XAUUSD: 1 lot = 100 oz

export function computeScenario(def: ScenarioDef, price: number, atr: number, pos: Position): ScenarioResult {
  const signedMove = (def.goldDirection === "bullish" ? 1 : -1) * def.atrMultiple * atr;
  const targetPrice = +(price + signedMove).toFixed(2);
  const movePct = price > 0 ? +((signedMove / price) * 100).toFixed(2) : 0;

  // P/L: long gains when price rises; short gains when it falls.
  const dirSign = pos.direction === "buy" ? 1 : -1;
  const pnl = +(pos.lots * USD_PER_DOLLAR_MOVE_PER_LOT * signedMove * dirSign).toFixed(2);
  const adverse = pnl < 0;

  const absPct = Math.abs(movePct);
  let drawdownRisk: DrawdownRisk;
  if (!adverse) drawdownRisk = "low";
  else if (absPct > 2) drawdownRisk = "extreme";
  else if (absPct > 1.2) drawdownRisk = "high";
  else if (absPct > 0.6) drawdownRisk = "medium";
  else drawdownRisk = "low";

  return {
    key: def.key,
    goldDirection: def.goldDirection,
    moveDollars: +signedMove.toFixed(2),
    movePct,
    targetPrice,
    pnl,
    adverse,
    drawdownRisk,
    action: def.action,
    alternative: def.alternative,
  };
}

export function computeAllScenarios(price: number, atr: number, pos: Position): ScenarioResult[] {
  return SCENARIOS.map((d) => computeScenario(d, price, atr, pos));
}
