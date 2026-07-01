import { NextResponse } from "next/server";
import { calcRSI } from "@/lib/backtest";

export const dynamic = "force-dynamic";

export type RegimeType = "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "HIGH_VOLATILITY" | "LOW_VOLATILITY";

export interface RegimeBar {
  date: string;
  close: number;
  regime: RegimeType;
  adx: number;
  atrPct: number;
}

export interface MarketRegimePayload {
  regime: RegimeType;
  regimeTh: string;
  regimeEn: string;
  description: string;
  descriptionEn: string;
  confidence: number;       // 0-100
  adx: number;
  atrPct: number;
  rsi: number;
  priceVsEma20: number;     // %
  priceVsEma50: number;     // %
  priceVsEma200: number;    // %
  ema20VsEma50: number;     // %
  price: number;
  ema20: number;
  ema50: number;
  ema200: number;
  atr: number;
  regimeHistory: RegimeBar[];
  strategyTips: string[];
  strategyTipsEn: string[];
  avoidTips: string[];
  avoidTipsEn: string[];
  generatedAt: string;
}

const REGIME_LABELS: Record<RegimeType, { th: string; en: string }> = {
  TRENDING_UP:    { th: "Trending ขาขึ้น",  en: "Trending Up"    },
  TRENDING_DOWN:  { th: "Trending ขาลง",    en: "Trending Down"  },
  RANGING:        { th: "Sideways / Range",  en: "Ranging"        },
  HIGH_VOLATILITY:{ th: "Volatility สูง",   en: "High Volatility"},
  LOW_VOLATILITY: { th: "Volatility ต่ำ",   en: "Low Volatility" },
};

const REGIME_DESC: Record<RegimeType, { th: string; en: string }> = {
  TRENDING_UP:    { th: "ตลาดกำลังเคลื่อนตัวขาขึ้นอย่างชัดเจน ADX แสดงความแข็งแกร่งของ Trend ราคาอยู่เหนือ EMA หลัก", en: "Market is in a clear uptrend. ADX confirms trend strength. Price is above key EMAs." },
  TRENDING_DOWN:  { th: "ตลาดกำลังเคลื่อนตัวขาลงอย่างชัดเจน ADX แสดงความแข็งแกร่งของ Trend ราคาอยู่ต่ำกว่า EMA หลัก", en: "Market is in a clear downtrend. ADX confirms trend strength. Price is below key EMAs." },
  RANGING:        { th: "ตลาดกำลังเคลื่อนไหวในกรอบ Sideways ขาด Momentum ชัดเจน ADX อ่อนแอ", en: "Market is consolidating in a range. No clear directional momentum. Weak ADX." },
  HIGH_VOLATILITY:{ th: "ตลาดมีความผันผวนสูงผิดปกติ อาจเกิดจากข่าวสำคัญหรือ Breakout ที่รุนแรง", en: "Market is in high volatility mode. Likely driven by major news or a strong breakout." },
  LOW_VOLATILITY: { th: "ตลาดสงบนิ่ง ความผันผวนต่ำ มักนำหน้าการ Breakout หรือ Accumulation", en: "Market is in a low-volatility calm phase. Often precedes a breakout or accumulation." },
};

const STRATEGY_TIPS: Record<RegimeType, { th: string[]; en: string[] }> = {
  TRENDING_UP:    {
    th: ["Buy on pullback ไปยัง EMA20 หรือ EMA50", "ตั้ง SL ไว้ต่ำกว่า Swing Low ล่าสุด", "เพิ่ม position ตามทิศทาง Trend ระยะกลาง", "ใช้ Trailing Stop เพื่อรักษากำไรระหว่างเทรน"],
    en: ["Buy on pullbacks to EMA20 or EMA50", "Place SL below recent swing low", "Scale in with the mid-term trend", "Use trailing stop to protect profits"],
  },
  TRENDING_DOWN:  {
    th: ["Sell on bounce ขึ้นไปแตะ EMA20 หรือ EMA50", "ตั้ง SL ไว้เหนือ Swing High ล่าสุด", "เพิ่ม position ตามทิศทาง Trend ขาลง", "หลีกเลี่ยงการ Buy ฝืน Trend"],
    en: ["Sell on bounces to EMA20 or EMA50", "Place SL above recent swing high", "Scale in with the mid-term downtrend", "Avoid counter-trend longs"],
  },
  RANGING:        {
    th: ["Buy ใกล้แนวรับ Sell ใกล้แนวต้านของกรอบ Range", "ตั้ง TP ก่อนถึงขอบอีกฝั่งของ Range", "ระวัง False Breakout ให้รอ Candle ยืนยัน", "ลด Position size เนื่องจาก Risk/Reward ต่ำกว่าช่วง Trend"],
    en: ["Buy near support, sell near resistance of the range", "Set TP before the other edge of the range", "Watch for false breakouts — wait for candle confirmation", "Reduce position size as R:R is lower in ranges"],
  },
  HIGH_VOLATILITY:{
    th: ["ลด lot size ให้สัมพันธ์กับ ATR ที่กว้างขึ้น", "เพิ่มระยะ SL เพื่อหลีกเลี่ยง Whipsaw", "รอสัญญาณที่ชัดเจนก่อนเข้าเทรด", "ระวังข่าวและ Event ที่ทำให้เกิด Gap"],
    en: ["Reduce lot size to account for wider ATR", "Widen SL to avoid whipsaws", "Wait for clear confirmation before entering", "Watch for news events that cause gaps"],
  },
  LOW_VOLATILITY: {
    th: ["เตรียมพร้อมรับ Breakout ที่อาจเกิดขึ้น", "วาง Order ไว้เหนือ/ต่ำกว่า Range สำหรับ Breakout", "ระวังการเข้าเทรดกลาง Range เพราะ Spread อาจกิน Profit", "ใช้ Pending Order แทน Market Order"],
    en: ["Prepare for a potential breakout", "Place orders above/below the range for breakout entry", "Avoid trading mid-range — spread may eat profit", "Use pending orders instead of market orders"],
  },
};

const AVOID_TIPS: Record<RegimeType, { th: string[]; en: string[] }> = {
  TRENDING_UP:    { th: ["ห้ามเปิด Sell ฝืน Trend หลัก", "อย่า Over-leverage ในช่วงที่ Trend แข็งแกร่ง"], en: ["Avoid shorting against the main trend", "Don't over-leverage in strong trends"] },
  TRENDING_DOWN:  { th: ["ห้ามเปิด Buy ฝืน Trend หลัก", "อย่าเข้า Buy เพียงเพราะ RSI Oversold"], en: ["Avoid longing against the main trend", "Don't buy just because RSI is oversold"] },
  RANGING:        { th: ["อย่าเปิด Position เมื่อราคาอยู่กลาง Range", "ห้ามเพิ่ม Position หาก Breakout ยังไม่ยืนยัน"], en: ["Don't enter mid-range", "Don't add positions before breakout confirmation"] },
  HIGH_VOLATILITY:{ th: ["ห้าม Trade ด้วย lot size ปกติในช่วง Volatile สูง", "อย่า Trade ช่วงข่าวสำคัญโดยไม่มี SL"], en: ["Don't trade normal lot size in high volatility", "Never trade major news without SL"] },
  LOW_VOLATILITY: { th: ["อย่าตั้ง TP ไกลเกินไปในช่วง Volume น้อย", "ห้ามไม่มี SL ในช่วง Low Vol เพราะ Breakout อาจรุนแรง"], en: ["Don't set distant TPs in low-volume periods", "Never trade without SL — breakouts can be violent"] },
};

function ema(data: number[], period: number): number {
  if (data.length < period) return data.at(-1) ?? 0;
  let val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) val = data[i] * k + val * (1 - k);
  return val;
}

function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period * 2) return 20;
  const n = closes.length;
  const dmPlus: number[] = [], dmMinus: number[] = [], tr: number[] = [];

  for (let i = 1; i < n; i++) {
    const upMove  = highs[i]  - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const pc = closes[i - 1];
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - pc), Math.abs(lows[i] - pc)));
  }

  // Sum-based Wilder smoothing for TR / DM (keeps price scale)
  function wilderSum(arr: number[], p: number): number[] {
    const out: number[] = [arr.slice(0, p).reduce((a, b) => a + b, 0)];
    for (let i = p; i < arr.length; i++) out.push(out.at(-1)! - out.at(-1)! / p + arr[i]);
    return out;
  }
  // Average-based Wilder MA for DX → ADX (keeps 0-100 range)
  function wilderAvg(arr: number[], p: number): number[] {
    const out: number[] = [arr.slice(0, p).reduce((a, b) => a + b, 0) / p];
    for (let i = p; i < arr.length; i++) out.push((out.at(-1)! * (p - 1) + arr[i]) / p);
    return out;
  }

  const atr14 = wilderSum(tr, period);
  const dp14  = wilderSum(dmPlus, period);
  const dm14  = wilderSum(dmMinus, period);

  const dx: number[] = [];
  for (let i = 0; i < atr14.length; i++) {
    const diP = atr14[i] > 0 ? (dp14[i] / atr14[i]) * 100 : 0;
    const diM = atr14[i] > 0 ? (dm14[i] / atr14[i]) * 100 : 0;
    const sum = diP + diM;
    dx.push(sum > 0 ? (Math.abs(diP - diM) / sum) * 100 : 0);
  }

  const adxRaw = wilderAvg(dx, period);
  return Math.max(0, Math.min(100, adxRaw.at(-1) ?? 20));
}

function classifyRegime(
  adx: number, atrPct: number, priceVsEma20: number, priceVsEma50: number, priceVsEma200: number
): RegimeType {
  const trending = adx > 23;
  const ranging  = adx < 18;
  const highVol  = atrPct > 1.0;
  const lowVol   = atrPct < 0.25;

  if (highVol && !trending) return "HIGH_VOLATILITY";
  if (lowVol && ranging)    return "LOW_VOLATILITY";
  if (trending) {
    const bullSigns = (priceVsEma20 > 0 ? 1 : 0) + (priceVsEma50 > 0 ? 1 : 0) + (priceVsEma200 > 0 ? 1 : 0);
    return bullSigns >= 2 ? "TRENDING_UP" : "TRENDING_DOWN";
  }
  return "RANGING";
}

let CACHE: { data: MarketRegimePayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1y&interval=1d&includePrePost=false";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error("No Yahoo data");

    const q = result.indicators?.quote?.[0] ?? {};
    const rawCloses: (number | null)[] = q.close  ?? [];
    const rawHighs:  (number | null)[] = q.high   ?? [];
    const rawLows:   (number | null)[] = q.low    ?? [];
    const timestamps: number[]         = result.timestamp ?? [];

    const closes: number[] = rawCloses.filter((v): v is number => v != null);
    const highs:  number[] = rawHighs.filter((v):  v is number => v != null);
    const lows:   number[] = rawLows.filter((v):   v is number => v != null);

    const price = result.meta?.regularMarketPrice ?? closes.at(-1) ?? 0;

    const e20  = ema(closes, 20);
    const e50  = ema(closes, 50);
    const e200 = ema(closes, 200);

    const atrValues = highs.slice(-15).map((h, i) => {
      const l = lows.slice(-15)[i];
      const pc = closes.slice(-16)[i] ?? l;
      return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    });
    const atr = atrValues.length ? atrValues.reduce((a, b) => a + b) / atrValues.length : 15;
    const atrPct = (atr / price) * 100;

    const adx = calcADX(highs, lows, closes, 14);
    const rsiArr = calcRSI(closes, 14);
    const rsi = rsiArr.at(-1) ?? 50;

    const pvE20  = ((price - e20)  / e20)  * 100;
    const pvE50  = ((price - e50)  / e50)  * 100;
    const pvE200 = ((price - e200) / e200) * 100;
    const e20vE50 = ((e20 - e50) / e50) * 100;

    const regime = classifyRegime(adx, atrPct, pvE20, pvE50, pvE200);

    // Confidence: how decisively the data supports this regime
    let confidence = 65;
    if (regime === "TRENDING_UP" || regime === "TRENDING_DOWN") {
      confidence = Math.min(95, 55 + (adx - 20) * 2);
    } else if (regime === "RANGING") {
      confidence = Math.min(90, 55 + (25 - adx) * 2);
    } else if (regime === "HIGH_VOLATILITY") {
      confidence = Math.min(95, 55 + (atrPct - 0.8) * 30);
    } else {
      confidence = Math.min(90, 55 + (0.35 - atrPct) * 100);
    }
    confidence = Math.max(50, Math.round(confidence));

    // Build regime history for last 60 bars
    const histLen = Math.min(60, closes.length - 210);
    const regimeHistory: RegimeBar[] = [];
    const STEP = 3;
    for (let i = Math.max(210, closes.length - histLen * STEP); i < closes.length - 1; i += STEP) {
      const sliceC = closes.slice(0, i + 1);
      const sliceH = highs.slice(0, i + 1);
      const sliceL = lows.slice(0, i + 1);
      const hE20  = ema(sliceC, 20);
      const hE50  = ema(sliceC, 50);
      const hE200 = ema(sliceC, 200);
      const hAtrVals = sliceH.slice(-15).map((h, j) => {
        const l = sliceL.slice(-15)[j];
        const pc = sliceC.slice(-16)[j] ?? l;
        return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      });
      const hAtr = hAtrVals.length ? hAtrVals.reduce((a, b) => a + b) / hAtrVals.length : 15;
      const hAtrPct = (hAtr / sliceC.at(-1)!) * 100;
      const hAdx = calcADX(sliceH, sliceL, sliceC, 14);
      const hC = sliceC.at(-1)!;
      const hReg = classifyRegime(hAdx, hAtrPct, ((hC - hE20) / hE20) * 100, ((hC - hE50) / hE50) * 100, ((hC - hE200) / hE200) * 100);
      const ts = timestamps[Math.min(i, timestamps.length - 1)];
      const dateStr = ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "";
      regimeHistory.push({ date: dateStr, close: hC, regime: hReg, adx: +hAdx.toFixed(1), atrPct: +hAtrPct.toFixed(2) });
    }

    const data: MarketRegimePayload = {
      regime,
      regimeTh: REGIME_LABELS[regime].th,
      regimeEn: REGIME_LABELS[regime].en,
      description: REGIME_DESC[regime].th,
      descriptionEn: REGIME_DESC[regime].en,
      confidence,
      adx: +adx.toFixed(1),
      atrPct: +atrPct.toFixed(2),
      rsi: +rsi.toFixed(1),
      priceVsEma20:  +pvE20.toFixed(2),
      priceVsEma50:  +pvE50.toFixed(2),
      priceVsEma200: +pvE200.toFixed(2),
      ema20VsEma50:  +e20vE50.toFixed(2),
      price: +price.toFixed(2),
      ema20:  +e20.toFixed(2),
      ema50:  +e50.toFixed(2),
      ema200: +e200.toFixed(2),
      atr:    +atr.toFixed(2),
      regimeHistory,
      strategyTips:   STRATEGY_TIPS[regime].th,
      strategyTipsEn: STRATEGY_TIPS[regime].en,
      avoidTips:   AVOID_TIPS[regime].th,
      avoidTipsEn: AVOID_TIPS[regime].en,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
