import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface RatioBar {
  date: string;
  ratio: number;
  goldPrice: number;
  oilPrice: number;
}

export interface GoldOilPayload {
  goldPrice: number;
  oilPrice: number;
  currentRatio: number;       // oz gold per barrel oil (gold/oil)
  histAvg: number;            // historical average (~18-22 bbl/oz range)
  histHigh: number;           // COVID high
  histLow: number;            // energy crisis low
  zone: "extreme_high" | "high" | "normal" | "low" | "extreme_low";
  zoneTh: string;
  zoneColor: string;
  goldSignal: "oil_cheap" | "oil_fair" | "oil_expensive";
  goldSignalTh: string;
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  ret1d: { gold: number; oil: number };
  ret1w: { gold: number; oil: number };
  ret1m: { gold: number; oil: number };
  bars: RatioBar[];           // 1Y weekly ratio history
  generatedAt: string;
}

type YChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; previousClose?: number };
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
        quote?: Array<{ close?: (number | null)[] }>;
      };
    }>;
  };
};

async function fetchSeries(sym: string): Promise<{ price: number; prevClose: number; history: Array<{ ts: number; close: number }> }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1wk`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    const j = await r.json() as YChart;
    const res = j?.chart?.result?.[0];
    if (!res) return { price: 0, prevClose: 0, history: [] };
    const meta   = res.meta ?? {};
    const ts     = res.timestamp ?? [];
    const closes = res.indicators?.adjclose?.[0]?.adjclose ?? res.indicators?.quote?.[0]?.close ?? [];
    const history: Array<{ ts: number; close: number }> = [];
    ts.forEach((t, i) => {
      const c = closes[i];
      if (c !== null && c !== undefined && !isNaN(c)) history.push({ ts: t, close: c });
    });
    return {
      price:     meta.regularMarketPrice ?? (history[history.length - 1]?.close ?? 0),
      prevClose: meta.previousClose ?? (history[history.length - 2]?.close ?? 0),
      history,
    };
  } catch { return { price: 0, prevClose: 0, history: [] }; }
}

// Historical reference values for GOX (Gold/Oil) ratio
const HIST_AVG  = 22;   // 20-year average: gold price / oil price
const HIST_HIGH = 80;   // COVID crash (Apr 2020)
const HIST_LOW  = 9;    // 2005 (pre-GFC commodity supercycle)

let CACHE: { data: GoldOilPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldD, oilD] = await Promise.all([
      fetchSeries("GC=F"),
      fetchSeries("CL=F"),
    ]);

    const gold = goldD.price || 3200;
    const oil  = oilD.price  || 70;
    const currentRatio = parseFloat((gold / oil).toFixed(2));

    // Classification zones
    let zone: GoldOilPayload["zone"];
    let zoneTh: string;
    let zoneColor: string;
    if (currentRatio > 55)      { zone = "extreme_high"; zoneTh = "สูงมาก (>55x)";    zoneColor = "#f87171"; }
    else if (currentRatio > 35) { zone = "high";         zoneTh = "สูง (35-55x)";     zoneColor = "#f97316"; }
    else if (currentRatio > 18) { zone = "normal";       zoneTh = "ปกติ (18-35x)";   zoneColor = "#9ca3af"; }
    else if (currentRatio > 12) { zone = "low";          zoneTh = "ต่ำ (12-18x)";    zoneColor = "#86efac"; }
    else                        { zone = "extreme_low";  zoneTh = "ต่ำมาก (<12x)";   zoneColor = "#34d399"; }

    // Signal: high ratio = oil cheap vs gold
    const goldSignal: GoldOilPayload["goldSignal"] =
      currentRatio > 35 ? "oil_cheap"
      : currentRatio < 15 ? "oil_expensive"
      : "oil_fair";

    const signalLabels: Record<GoldOilPayload["goldSignal"], string> = {
      oil_cheap:     "น้ำมันถูกเทียบทอง — gold แพงกว่าพื้นฐาน energy",
      oil_fair:      "ทองและน้ำมันสมดุล",
      oil_expensive: "น้ำมันแพงเทียบทอง — อาจเกิด demand destruction",
    };

    // High ratio = oil historically cheap = oil likely to catch up = energy inflation coming = gold bullish
    const goldBias: GoldOilPayload["goldBias"] =
      currentRatio > 40 ? "bullish"   // extreme = energy inflation risk = gold hedge
      : currentRatio < 15 ? "bearish" // oil expensive = stagflation risk might flip
      : "neutral";

    // Returns
    const ret = (prev: number, curr: number) => prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(2)) : 0;

    // Weekly history for chart — build ratio bars
    const minLen = Math.min(goldD.history.length, oilD.history.length);
    const bars: RatioBar[] = [];
    for (let i = Math.max(0, minLen - 52); i < minLen; i++) {
      const gi = goldD.history[goldD.history.length - minLen + i];
      const oi = oilD.history[oilD.history.length - minLen + i];
      if (!gi || !oi || !oi.close) continue;
      bars.push({
        date:      new Date(gi.ts * 1000).toISOString().slice(0, 10),
        ratio:     parseFloat((gi.close / oi.close).toFixed(2)),
        goldPrice: Math.round(gi.close),
        oilPrice:  parseFloat(oi.close.toFixed(2)),
      });
    }

    // 1D, 1W, 1M returns using weekly bars
    const goldH = goldD.history;
    const oilH  = oilD.history;
    const gN = goldH.length;
    const oN = oilH.length;

    const data: GoldOilPayload = {
      goldPrice: Math.round(gold),
      oilPrice:  parseFloat(oil.toFixed(2)),
      currentRatio,
      histAvg: HIST_AVG,
      histHigh: HIST_HIGH,
      histLow: HIST_LOW,
      zone, zoneTh, zoneColor,
      goldSignal,
      goldSignalTh: signalLabels[goldSignal],
      goldBias,
      goldBiasTh: goldBias === "bullish"
        ? "Bullish — ratio สูงมาก บ่งชี้ energy inflation risk หนุนทอง"
        : goldBias === "bearish"
        ? "Bearish — ratio ต่ำ น้ำมันแพง อาจกดดัน demand ทอง"
        : "Neutral — ratio อยู่ในเกณฑ์ปกติ",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      ret1d: {
        gold: ret(goldD.prevClose, gold),
        oil:  ret(oilD.prevClose, oil),
      },
      ret1w: {
        gold: ret(goldH[Math.max(0, gN - 2)]?.close ?? gold, gold),
        oil:  ret(oilH[Math.max(0, oN - 2)]?.close ?? oil,  oil),
      },
      ret1m: {
        gold: ret(goldH[Math.max(0, gN - 5)]?.close ?? gold, gold),
        oil:  ret(oilH[Math.max(0, oN - 5)]?.close ?? oil,  oil),
      },
      bars,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
