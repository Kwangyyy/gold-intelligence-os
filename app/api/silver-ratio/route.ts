import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface RatioBar {
  date: string;
  ratio: number;
}

export interface SilverRatioPayload {
  goldPrice: number;
  silverPrice: number;
  currentRatio: number;
  change1w: number;
  change1m: number;
  change3m: number;

  // Historical context
  historicalHigh: number;   // approx 120+ (COVID peak Apr 2020)
  historicalLow: number;    // approx 14-15 (2011 silver spike)
  longTermAvg: number;      // ~70 (modern era avg)
  currentVsAvg: number;     // % deviation from long-term avg

  // Interpretation
  zone: "silver_cheap" | "silver_expensive" | "fair_value" | "extreme_cheap" | "extreme_expensive";
  zoneTh: string;
  zoneColor: string;
  implication: string;
  implicationTh: string;

  // Signal
  signal: "favor_silver" | "favor_gold" | "neutral";
  signalTh: string;
  signalColor: string;

  // Bars for chart
  bars: RatioBar[];

  // Comparisons
  ratioAt1Y: number | null;
  ratioAt6M: number | null;
  ratioAt3M: number | null;

  generatedAt: string;
}

async function fetchYahoo(symbol: string, range: string, interval: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

type YJ = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
} | null;

function parseYahoo(j: unknown) {
  const obj = j as YJ;
  const closes    = (obj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
  const timestamps = obj?.chart?.result?.[0]?.timestamp ?? [];
  const spot = obj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? closes.at(-1) ?? 0;
  return { closes, timestamps, spot };
}

let CACHE: { data: SilverRatioPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30m

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldJ, silverJ] = await Promise.all([
      fetchYahoo("GC%3DF",  "1y", "1wk"),
      fetchYahoo("SI%3DF",  "1y", "1wk"),  // Silver futures
    ]);

    const gold   = parseYahoo(goldJ);
    const silver = parseYahoo(silverJ);

    const goldPrice   = gold.spot   || 3200;
    const silverPrice = silver.spot || 32;

    // Build weekly ratio series
    const minLen = Math.min(gold.closes.length, silver.closes.length);
    const bars: RatioBar[] = [];
    for (let i = 0; i < minLen; i++) {
      if (silver.closes[i] > 0) {
        const ts = gold.timestamps[gold.timestamps.length - minLen + i];
        bars.push({
          date:  ts ? new Date(ts * 1000).toISOString().slice(0, 10) : `wk${i}`,
          ratio: +(gold.closes[gold.closes.length - minLen + i] / silver.closes[i]).toFixed(2),
        });
      }
    }

    const currentRatio = silverPrice > 0 ? +(goldPrice / silverPrice).toFixed(2) : 80;

    const r1w = bars.length >= 2  ? bars.at(-2)?.ratio ?? null : null;
    const r1m = bars.length >= 5  ? bars.at(-5)?.ratio ?? null : null;
    const r3m = bars.length >= 13 ? bars.at(-13)?.ratio ?? null : null;
    const r6m = bars.length >= 26 ? bars.at(-26)?.ratio ?? null : null;
    const r1y = bars.length >= 52 ? bars.at(-52)?.ratio ?? null : null;

    const change1w = r1w ? +(currentRatio - r1w).toFixed(2) : 0;
    const change1m = r1m ? +(currentRatio - r1m).toFixed(2) : 0;
    const change3m = r3m ? +(currentRatio - r3m).toFixed(2) : 0;

    const LONG_TERM_AVG   = 70;
    const HIST_HIGH       = 123; // COVID peak
    const HIST_LOW        = 14;  // 2011 peak silver

    const devFromAvg = +((currentRatio - LONG_TERM_AVG) / LONG_TERM_AVG * 100).toFixed(1);

    // Zone classification
    let zone: SilverRatioPayload["zone"];
    let zoneTh: string;
    let zoneColor: string;
    let implication: string;
    let implicationTh: string;
    let signal: SilverRatioPayload["signal"];
    let signalTh: string;
    let signalColor: string;

    if (currentRatio > 100) {
      zone = "extreme_cheap"; zoneTh = "Silver ถูกมาก (ผิดปกติ)"; zoneColor = "#34d399";
      implication = "Historically extreme — silver deeply undervalued vs gold. Major silver reversion setups possible.";
      implicationTh = "อัตราส่วนสูงผิดปกติ — Silver ถูกมากเทียบทอง มักเกิด mean reversion สู่ <80";
      signal = "favor_silver"; signalTh = "Silver น่าซื้อเทียบทอง"; signalColor = "#34d399";
    } else if (currentRatio > 85) {
      zone = "silver_cheap"; zoneTh = "Silver ถูก (เหนือค่าเฉลี่ย 20%)"; zoneColor = "#86efac";
      implication = "Ratio above average — silver relatively cheap. Historically good zone to favor silver over gold.";
      implicationTh = "Ratio สูงกว่าค่าเฉลี่ย — Silver ถูกกว่าทองค่อนข้างมาก";
      signal = "favor_silver"; signalTh = "Silver น่าซื้อเทียบทอง"; signalColor = "#86efac";
    } else if (currentRatio > 60) {
      zone = "fair_value"; zoneTh = "Fair Value Zone (ค่าเฉลี่ยระยะยาว)"; zoneColor = "#f5c451";
      implication = "Ratio near long-term average (~70). No clear directional edge between gold and silver.";
      implicationTh = "Ratio อยู่ใกล้ค่าเฉลี่ยระยะยาว ไม่มีความได้เปรียบชัดเจนระหว่างสองสินค้า";
      signal = "neutral"; signalTh = "Neutral — ทั้งคู่ใกล้เคียงกัน"; signalColor = "#f5c451";
    } else if (currentRatio > 45) {
      zone = "silver_expensive"; zoneTh = "Silver แพง (ใต้ค่าเฉลี่ย 30%)"; zoneColor = "#f97316";
      implication = "Ratio below average — silver expensive relative to gold. Historically gold outperforms from here.";
      implicationTh = "Ratio ต่ำกว่าค่าเฉลี่ย — Silver แพงกว่าทองค่อนข้างมาก Gold มักทำได้ดีกว่า";
      signal = "favor_gold"; signalTh = "Gold น่าซื้อเทียบ Silver"; signalColor = "#f97316";
    } else {
      zone = "extreme_expensive"; zoneTh = "Silver แพงมาก (ผิดปกติ)"; zoneColor = "#f87171";
      implication = "Historically extreme silver premium — ratio very low. Classic signal gold may outperform.";
      implicationTh = "Ratio ต่ำผิดปกติ (Silver spike) — ทองมักทำได้ดีกว่าในระยะกลาง";
      signal = "favor_gold"; signalTh = "Gold น่าซื้อเทียบ Silver"; signalColor = "#f87171";
    }

    const data: SilverRatioPayload = {
      goldPrice: +goldPrice.toFixed(0),
      silverPrice: +silverPrice.toFixed(2),
      currentRatio, change1w, change1m, change3m,
      historicalHigh: HIST_HIGH, historicalLow: HIST_LOW, longTermAvg: LONG_TERM_AVG,
      currentVsAvg: devFromAvg,
      zone, zoneTh, zoneColor, implication, implicationTh,
      signal, signalTh, signalColor,
      bars: bars.slice(-52), // last 52 weeks max
      ratioAt1Y: r1y, ratioAt6M: r6m, ratioAt3M: r3m,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
