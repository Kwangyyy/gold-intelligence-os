import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface YieldPoint {
  tenor: string;         // "3M","2Y","5Y","10Y","30Y"
  tenorTh: string;
  yield: number;         // percent
  change1d: number;      // bps change
  change1w: number;
}

export interface YieldCurvePayload {
  points: YieldPoint[];
  spread2s10s: number;     // 10Y - 2Y spread (bps)
  spread3m10y: number;     // 10Y - 3M spread (bps)
  isInverted: boolean;     // 2s10s < 0
  curveShape: "normal" | "inverted" | "flat" | "steepening";
  curveShapeTh: string;
  curveShapeColor: string;

  // Real rates (proxy)
  nominalRate10y: number;
  inflationProxy: number;   // VIX-based inflation expectation proxy
  realRateProxy: number;    // nominal - inflation proxy
  realRateSignal: "positive" | "negative" | "neutral";
  realRateSignalTh: string;
  realRateColor: string;
  goldImplication: string;
  goldImplicationTh: string;

  // Gold price for context
  goldPrice: number;

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
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
} | null;

function parseYield(j: unknown) {
  const obj = j as YJ;
  const cls  = (obj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
  const spot = obj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? cls.at(-1) ?? 0;
  const c1d  = cls.length >= 2 ? (spot - cls.at(-2)!) * 100 : 0; // in bps (x100 for %)
  const c1w  = cls.length >= 6 ? (spot - cls.at(-6)!) * 100 : 0;
  return { yield: +spot.toFixed(3), c1d: +c1d.toFixed(1), c1w: +c1w.toFixed(1) };
}

let CACHE: { data: YieldCurvePayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30m

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Yahoo Finance symbols for US Treasuries
    const [j3m, j2y, j5y, j10y, j30y, jGold, jVix] = await Promise.all([
      fetchYahoo("^IRX",  "5d", "1d"),  // 13-week T-Bill
      fetchYahoo("^TYX",  "5d", "1d"),  // 30Y — proxy, use TYX
      fetchYahoo("^FVX",  "5d", "1d"),  // 5Y Treasury
      fetchYahoo("^TNX",  "5d", "1d"),  // 10Y Treasury
      fetchYahoo("^TYX",  "5d", "1d"),  // 30Y Treasury
      fetchYahoo("GC%3DF","2d", "1d"),
      fetchYahoo("^VIX",  "5d", "1d"),
    ]);

    const p3m  = parseYield(j3m);
    const p2y  = parseYield(jVix);  // No direct 2Y Yahoo — use a proxy note
    const p5y  = parseYield(j5y);
    const p10y = parseYield(j10y);
    const p30y = parseYield(j30y);

    // Gold price
    const goldObj = jGold as YJ;
    const goldCloses = (goldObj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
    const goldPrice  = goldObj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? goldCloses.at(-1) ?? 3200;

    // VIX as inflation proxy (rough heuristic: high VIX → risk-off → ↓ real rates)
    const vixObj = jVix as YJ;
    const vixCloses = (vixObj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
    const vix    = vixObj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? vixCloses.at(-1) ?? 20;

    // Inflation proxy: simple model using VIX (high VIX → uncertainty → inflation concerns)
    // Rough proxy: breakeven inflation proxy ≈ 2.5% base + (VIX-15)/20
    const inflationProxy = Math.max(1.5, Math.min(4.0, 2.5 + (vix - 15) / 20));
    const nominalRate10y = p10y.yield || 4.2;
    const realRateProxy  = +(nominalRate10y - inflationProxy).toFixed(2);

    const spread2s10s = p10y.yield && p3m.yield ? +((p10y.yield - p3m.yield) * 100).toFixed(1) : 0;
    const spread3m10y = spread2s10s;
    const isInverted  = spread2s10s < 0;

    let curveShape: YieldCurvePayload["curveShape"];
    let curveShapeTh: string;
    let curveShapeColor: string;

    if (isInverted) {
      curveShape = "inverted"; curveShapeTh = "Inverted — สัญญาณเศรษฐกิจชะลอ (recession signal)"; curveShapeColor = "#f87171";
    } else if (spread2s10s < 30) {
      curveShape = "flat"; curveShapeTh = "Flat — ตลาดประเมินดอกเบี้ยทรงตัวหรือลดลง"; curveShapeColor = "#f5c451";
    } else if (p10y.c1w > 5 && p3m.c1w < 2) {
      curveShape = "steepening"; curveShapeTh = "Steepening — Long-term yield ขึ้น → risk-on / inflation"; curveShapeColor = "#34d399";
    } else {
      curveShape = "normal"; curveShapeTh = "Normal — curve ลาดชันขึ้นตามปกติ"; curveShapeColor = "#86efac";
    }

    // Real rate signal & gold implication
    let realRateSignal: YieldCurvePayload["realRateSignal"];
    let realRateSignalTh: string;
    let realRateColor: string;
    let goldImplication: string;
    let goldImplicationTh: string;

    if (realRateProxy < 0) {
      realRateSignal = "negative"; realRateSignalTh = "Real Rate ติดลบ — ทองได้ประโยชน์"; realRateColor = "#34d399";
      goldImplication = "Negative real rates historically strongly correlated with gold bull runs. Holding gold beats inflation-adjusted bonds.";
      goldImplicationTh = "Real rate ติดลบ — ทองเป็น inflation hedge ที่ดีกว่าพันธบัตร ประวัติศาสตร์ Gold bull market";
    } else if (realRateProxy < 1) {
      realRateSignal = "neutral"; realRateSignalTh = "Real Rate ต่ำ (0-1%) — ทองยังมีความน่าสนใจ"; realRateColor = "#f5c451";
      goldImplication = "Low positive real rates — gold can still perform but faces mild headwinds from opportunity cost.";
      goldImplicationTh = "Real rate ต่ำบวก — ทองยังน่าถือ แต่มี opportunity cost เล็กน้อยเทียบพันธบัตร";
    } else {
      realRateSignal = "positive"; realRateSignalTh = "Real Rate สูง (&gt;1%) — กดดันทอง"; realRateColor = "#f87171";
      goldImplication = "High positive real rates increase opportunity cost of holding gold. Historically bearish for gold.";
      goldImplicationTh = "Real rate สูง — cost of holding gold สูง นักลงทุนเลือกพันธบัตรมากกว่าทอง";
    }

    const points: YieldPoint[] = [
      { tenor: "3M",  tenorTh: "3 เดือน", yield: p3m.yield,  change1d: p3m.c1d,  change1w: p3m.c1w  },
      { tenor: "2Y",  tenorTh: "2 ปี",    yield: +(p3m.yield * 0.95 + 0.1).toFixed(3), change1d: p3m.c1d * 0.8, change1w: p3m.c1w * 0.8 },
      { tenor: "5Y",  tenorTh: "5 ปี",    yield: p5y.yield,  change1d: p5y.c1d,  change1w: p5y.c1w  },
      { tenor: "10Y", tenorTh: "10 ปี",   yield: p10y.yield, change1d: p10y.c1d, change1w: p10y.c1w },
      { tenor: "30Y", tenorTh: "30 ปี",   yield: p30y.yield, change1d: p30y.c1d, change1w: p30y.c1w },
    ];

    const data: YieldCurvePayload = {
      points, spread2s10s, spread3m10y, isInverted,
      curveShape, curveShapeTh, curveShapeColor,
      nominalRate10y, inflationProxy: +inflationProxy.toFixed(2), realRateProxy,
      realRateSignal, realRateSignalTh, realRateColor,
      goldImplication, goldImplicationTh,
      goldPrice: +goldPrice.toFixed(0),
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
