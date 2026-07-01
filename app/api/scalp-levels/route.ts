import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ScalpLevel {
  price: number;
  type: "resistance" | "support" | "pivot" | "vwap" | "session_high" | "session_low";
  typeTh: string;
  strength: "strong" | "moderate" | "weak";
  strengthTh: string;
  color: string;
  distancePct: number;   // % from current price
  direction: "above" | "below" | "current";
  tag: string;           // e.g. "R1", "S2"
}

export interface ScalpZone {
  from: number;
  to: number;
  label: string;
  labelTh: string;
  bias: "buy" | "sell" | "neutral";
  color: string;
}

export interface ScalpPayload {
  currentPrice: number;
  atr1h: number;           // 1-hour ATR for SL sizing
  levels: ScalpLevel[];
  zones: ScalpZone[];
  nearestSupport: number;
  nearestResistance: number;
  suggestedSL: number;     // 1×ATR below current
  suggestedTP1: number;    // nearest resistance
  suggestedTP2: number;    // 2nd resistance
  biasIntraday: "bullish" | "bearish" | "neutral";
  biasTh: string;
  sessionNote: string;
  sessionNoteTh: string;
  generatedAt: string;
}

async function fetchOHLC(range: string, interval: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=${range}&interval=${interval}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  if (!result) return null;
  const q = result.indicators?.quote?.[0];
  return {
    open:   (q?.open   ?? []) as (number | null)[],
    high:   (q?.high   ?? []) as (number | null)[],
    low:    (q?.low    ?? []) as (number | null)[],
    close:  (q?.close  ?? []) as (number | null)[],
    timestamps: (result.timestamp ?? []) as number[],
    meta: result.meta,
  };
}

function wilderATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    trs.push(tr);
  }
  let atr = trs.slice(0, period).reduce((a, v) => a + v, 0) / period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return atr;
}

let CACHE: { data: ScalpPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [daily, hourly] = await Promise.all([
      fetchOHLC("5d",  "1d"),
      fetchOHLC("3d",  "1h"),
    ]);

    if (!daily || !hourly) throw new Error("Data unavailable");

    const dClose = daily.close.filter((c): c is number => c != null);
    const dHigh  = daily.high.filter((h): h is number => h != null);
    const dLow   = daily.low.filter((l): l is number => l != null);
    const dOpen  = daily.open.filter((o): o is number => o != null);

    const hClose = hourly.close.filter((c): c is number => c != null);
    const hHigh  = hourly.high.filter((h): h is number => h != null);
    const hLow   = hourly.low.filter((l): l is number => l != null);

    const currentPrice = daily.meta?.regularMarketPrice ?? dClose.at(-1) ?? 0;

    // Yesterday's OHLC for pivot calculation
    const prevHigh  = dHigh.at(-2)  ?? currentPrice + 20;
    const prevLow   = dLow.at(-2)   ?? currentPrice - 20;
    const prevClose = dClose.at(-2) ?? currentPrice;

    // Classic pivots from yesterday
    const PP = (prevHigh + prevLow + prevClose) / 3;
    const R1 = 2 * PP - prevLow;
    const R2 = PP + (prevHigh - prevLow);
    const R3 = R2 + (prevHigh - prevLow);
    const S1 = 2 * PP - prevHigh;
    const S2 = PP - (prevHigh - prevLow);
    const S3 = S2 - (prevHigh - prevLow);

    // Today's session H/L from hourly data (last 8 bars ≈ current session)
    const sessionBars = hHigh.slice(-8);
    const sessionLowBars = hLow.slice(-8);
    const sessionHigh = sessionBars.length ? Math.max(...sessionBars) : currentPrice + 15;
    const sessionLow  = sessionLowBars.length ? Math.min(...sessionLowBars) : currentPrice - 15;

    // VWAP approximation from today's hourly bars
    const todayClose = hClose.slice(-8);
    const vwap = todayClose.length ? todayClose.reduce((a, v) => a + v, 0) / todayClose.length : currentPrice;

    // ATR (1h)
    const atr1h = wilderATR(hHigh.slice(-30), hLow.slice(-30), hClose.slice(-30), 14);

    // Build level list
    const rawLevels: { price: number; type: ScalpLevel["type"]; tag: string; strength: ScalpLevel["strength"] }[] = [
      { price: R3,          type: "resistance", tag: "R3", strength: "weak"     },
      { price: R2,          type: "resistance", tag: "R2", strength: "moderate" },
      { price: R1,          type: "resistance", tag: "R1", strength: "strong"   },
      { price: PP,          type: "pivot",      tag: "PP", strength: "strong"   },
      { price: S1,          type: "support",    tag: "S1", strength: "strong"   },
      { price: S2,          type: "support",    tag: "S2", strength: "moderate" },
      { price: S3,          type: "support",    tag: "S3", strength: "weak"     },
      { price: sessionHigh, type: "session_high", tag: "SH", strength: "moderate" },
      { price: sessionLow,  type: "session_low",  tag: "SL", strength: "moderate" },
      { price: vwap,        type: "vwap",       tag: "VWAP", strength: "strong" },
    ];

    const typeConfig: Record<ScalpLevel["type"], { typeTh: string; color: string }> = {
      resistance:   { typeTh: "แนวต้าน",        color: "#f87171" },
      support:      { typeTh: "แนวรับ",          color: "#34d399" },
      pivot:        { typeTh: "Pivot Point",      color: "#f5c451" },
      vwap:         { typeTh: "VWAP วันนี้",     color: "#c084fc" },
      session_high: { typeTh: "High session วันนี้", color: "#fb923c" },
      session_low:  { typeTh: "Low session วันนี้",  color: "#4ade80" },
    };

    const strengthConfig: Record<string, string> = { strong: "แข็งแกร่ง", moderate: "ปานกลาง", weak: "อ่อน" };

    const levels: ScalpLevel[] = rawLevels
      .map(l => {
        const distancePct = ((l.price - currentPrice) / currentPrice) * 100;
        const tc = typeConfig[l.type];
        return {
          price: +l.price.toFixed(0),
          type: l.type, typeTh: tc.typeTh,
          strength: l.strength, strengthTh: strengthConfig[l.strength],
          color: tc.color,
          distancePct: +distancePct.toFixed(2),
          direction: (distancePct > 0.05 ? "above" : distancePct < -0.05 ? "below" : "current") as ScalpLevel["direction"],
          tag: l.tag,
        };
      })
      .filter(l => Math.abs(l.distancePct) < 3)   // only show within ±3%
      .sort((a, b) => b.price - a.price);          // highest first

    // Scalp zones
    const zones: ScalpZone[] = [
      { from: S1, to: PP, label: "Buy Zone",    labelTh: "โซนซื้อ (S1–PP)",    bias: "buy",  color: "#34d399" },
      { from: PP, to: R1, label: "Neutral Zone", labelTh: "โซนกลาง (PP–R1)",  bias: "neutral", color: "#f5c451" },
      { from: R1, to: R2, label: "Sell Zone",   labelTh: "โซนขาย (R1–R2)",    bias: "sell", color: "#f87171" },
    ];

    const abovePP = currentPrice > PP;
    const biasIntraday: ScalpPayload["biasIntraday"] = currentPrice > PP ? "bullish" : currentPrice < PP ? "bearish" : "neutral";
    const biasTh = biasIntraday === "bullish" ? "Bullish — ราคาอยู่เหนือ PP" : biasIntraday === "bearish" ? "Bearish — ราคาอยู่ต่ำกว่า PP" : "Neutral — ราคาใกล้ PP";

    const nearestSupport    = levels.filter(l => l.direction === "below" && (l.type === "support" || l.type === "pivot")).at(0)?.price ?? +S1.toFixed(0);
    const nearestResistance = levels.filter(l => l.direction === "above" && (l.type === "resistance" || l.type === "pivot")).at(-1)?.price ?? +R1.toFixed(0);
    const res1 = levels.filter(l => l.direction === "above").at(-1)?.price ?? +R1.toFixed(0);
    const res2 = levels.filter(l => l.direction === "above").at(-2)?.price ?? +R2.toFixed(0);

    const utcH = new Date().getUTCHours();
    const sessionName = utcH >= 0 && utcH < 8 ? "Asian" : utcH >= 8 && utcH < 13 ? "London" : utcH >= 13 && utcH < 22 ? "New York" : "Off-hours";
    const sessionNote = `Current session: ${sessionName}. ${sessionName === "London" || sessionName === "New York" ? "High-liquidity session — levels more reliable." : "Lower liquidity — wider spreads possible."}`;
    const sessionNoteTh = `Session ปัจจุบัน: ${sessionName}. ${sessionName === "London" || sessionName === "New York" ? "สภาพคล่องสูง — Level น่าเชื่อถือมากกว่า" : "สภาพคล่องต่ำ — Spread อาจกว้างขึ้น"}`;

    const data: ScalpPayload = {
      currentPrice: +currentPrice.toFixed(0),
      atr1h: +atr1h.toFixed(1),
      levels, zones,
      nearestSupport, nearestResistance,
      suggestedSL:  +(currentPrice - atr1h).toFixed(0),
      suggestedTP1: res1,
      suggestedTP2: res2,
      biasIntraday, biasTh,
      sessionNote, sessionNoteTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
