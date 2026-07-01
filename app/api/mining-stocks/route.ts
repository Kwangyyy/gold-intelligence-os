import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface MiningStock {
  symbol: string;
  name: string;
  nameTh: string;
  category: "etf" | "major" | "mid" | "royalty";
  price: number;
  change1d: number;
  change1w: number;
  change1m: number;
  goldRatio: number;         // stock price / gold price (normalized at 100)
  betaToGold: number;        // how much the stock moves per 1% gold move
  marketCapBillion: number;  // approximate market cap
  production: string;        // annual gold production
  productionTh: string;
  signal: "buy" | "hold" | "reduce";
  signalTh: string;
  signalColor: string;
}

export interface MiningStocksPayload {
  goldPrice: number;
  goldChange1d: number;
  goldChange1w: number;
  stocks: MiningStock[];
  topPerformer: string;     // symbol
  bottomPerformer: string;  // symbol
  sectorBias: "bullish" | "bearish" | "neutral";
  sectorBiasTh: string;
  sectorBiasColor: string;
  gdxVsGold: number;        // GDX performance relative to gold this week
  gdxjVsGold: number;       // GDXJ vs gold this week
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

type YahooJson = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
} | null;

function parseYahoo(j: unknown) {
  const obj = j as YahooJson;
  const closes = (obj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
  const price   = obj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? closes.at(-1) ?? 0;
  const c1d = closes.length >= 2  ? ((price - closes.at(-2)!)  / closes.at(-2)!  * 100) : 0;
  const c1w = closes.length >= 6  ? ((price - closes.at(-6)!)  / closes.at(-6)!  * 100) : 0;
  const c1m = closes.length >= 22 ? ((price - closes.at(-22)!) / closes.at(-22)! * 100) : 0;
  return { price, c1d, c1w, c1m };
}

const STATIC: Omit<MiningStock, "price"|"change1d"|"change1w"|"change1m"|"goldRatio"|"signal"|"signalTh"|"signalColor">[] = [
  { symbol: "GDX",   name: "VanEck Gold Miners ETF",         nameTh: "ETF หุ้นทองใหญ่",          category: "etf",     betaToGold: 1.8,  marketCapBillion: 12.5,  production: "Basket ETF", productionTh: "ตะกร้าหุ้นทอง" },
  { symbol: "GDXJ",  name: "VanEck Junior Gold Miners ETF",  nameTh: "ETF หุ้นทองขนาดกลาง",     category: "etf",     betaToGold: 2.2,  marketCapBillion: 4.8,   production: "Basket ETF", productionTh: "ตะกร้าหุ้นทองขนาดกลาง" },
  { symbol: "NEM",   name: "Newmont Corp",                   nameTh: "นิวมอนต์ — ใหญ่สุดในโลก", category: "major",   betaToGold: 1.5,  marketCapBillion: 52.0,  production: "6.3M oz/yr", productionTh: "6.3 ล้านออนซ์/ปี" },
  { symbol: "GOLD",  name: "Barrick Gold",                   nameTh: "แบร์ริก โกลด์",            category: "major",   betaToGold: 1.6,  marketCapBillion: 31.0,  production: "4.1M oz/yr", productionTh: "4.1 ล้านออนซ์/ปี" },
  { symbol: "AEM",   name: "Agnico Eagle Mines",             nameTh: "แอกนิโก อีเกิล",           category: "major",   betaToGold: 1.7,  marketCapBillion: 38.0,  production: "3.4M oz/yr", productionTh: "3.4 ล้านออนซ์/ปี" },
  { symbol: "FNV",   name: "Franco-Nevada (Royalty)",        nameTh: "ฟรานโก เนวาดา (Royalty)",  category: "royalty", betaToGold: 1.3,  marketCapBillion: 22.0,  production: "Royalty/Streaming", productionTh: "ค่าลิขสิทธิ์/สตรีมมิ่ง" },
  { symbol: "WPM",   name: "Wheaton Precious Metals",        nameTh: "วีตัน เพรเชียส เมทัลส์",  category: "royalty", betaToGold: 1.4,  marketCapBillion: 18.5,  production: "Streaming co.", productionTh: "บริษัทสตรีมมิ่ง" },
  { symbol: "KGC",   name: "Kinross Gold",                   nameTh: "คินรอส โกลด์",             category: "mid",     betaToGold: 1.9,  marketCapBillion: 9.2,   production: "2.1M oz/yr", productionTh: "2.1 ล้านออนซ์/ปี" },
  { symbol: "AU",    name: "AngloGold Ashanti",              nameTh: "แองโกล โกลด์ แอชแอนตี",   category: "mid",     betaToGold: 2.0,  marketCapBillion: 10.8,  production: "2.6M oz/yr", productionTh: "2.6 ล้านออนซ์/ปี" },
];

function deriveSignal(c1w: number, goldBias: boolean): { signal: MiningStock["signal"]; signalTh: string; signalColor: string } {
  if (c1w > 3 && goldBias)  return { signal: "buy",    signalTh: "ซื้อ / Momentum สูง",   signalColor: "#34d399" };
  if (c1w < -3)             return { signal: "reduce",  signalTh: "ลดสถานะ / อ่อนแอ",    signalColor: "#f87171" };
  return                           { signal: "hold",    signalTh: "ถือ / รอสัญญาณ",       signalColor: "#f5c451" };
}

let CACHE: { data: MiningStocksPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30m

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const symbols = ["GC%3DF", "GDX", "GDXJ", "NEM", "GOLD", "AEM", "FNV", "WPM", "KGC", "AU"];
    const results = await Promise.all(symbols.map(s => fetchYahoo(s, "30d", "1d")));

    const parsed = results.map(r => parseYahoo(r));
    const gold   = parsed[0];
    const gdxP   = parsed[1];
    const gdxjP  = parsed[2];

    const goldBias = gold.c1w > 0;

    const stocks: MiningStock[] = STATIC.map((s, i) => {
      const p = parsed[i + 1]; // offset: index 0 = gold, 1=GDX, 2=GDXJ, ...
      const goldRatio = gold.price > 0 ? (p.price / gold.price * 100) : 0;
      const sig = deriveSignal(p.c1w, goldBias);
      return {
        ...s,
        price:      +p.price.toFixed(2),
        change1d:   +p.c1d.toFixed(2),
        change1w:   +p.c1w.toFixed(2),
        change1m:   +p.c1m.toFixed(2),
        goldRatio:  +goldRatio.toFixed(3),
        ...sig,
      };
    });

    // relative perf
    const returns1w = stocks.map(s => s.change1w);
    const topIdx    = returns1w.indexOf(Math.max(...returns1w));
    const botIdx    = returns1w.indexOf(Math.min(...returns1w));

    const avgW   = returns1w.reduce((a, b) => a + b, 0) / returns1w.length;
    const sectorBias: MiningStocksPayload["sectorBias"] = avgW > 2 ? "bullish" : avgW < -2 ? "bearish" : "neutral";

    const data: MiningStocksPayload = {
      goldPrice:      +gold.price.toFixed(0),
      goldChange1d:   +gold.c1d.toFixed(2),
      goldChange1w:   +gold.c1w.toFixed(2),
      stocks,
      topPerformer:   stocks[topIdx]?.symbol ?? "GDX",
      bottomPerformer:stocks[botIdx]?.symbol ?? "GDXJ",
      sectorBias,
      sectorBiasTh:   sectorBias === "bullish" ? "Bullish — หุ้นทองส่วนใหญ่ขึ้น" : sectorBias === "bearish" ? "Bearish — หุ้นทองส่วนใหญ่ลง" : "Neutral — Mixed Performance",
      sectorBiasColor: sectorBias === "bullish" ? "#34d399" : sectorBias === "bearish" ? "#f87171" : "#f5c451",
      gdxVsGold:  +(gdxP.c1w - gold.c1w).toFixed(2),
      gdxjVsGold: +(gdxjP.c1w - gold.c1w).toFixed(2),
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
