import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface PivotLevel {
  label: string;
  price: number;
  type: "pivot" | "support" | "resistance";
  strength: "strong" | "normal";
  isCurrentZone: boolean;
}

export interface PivotSet {
  method: "classical" | "fibonacci" | "camarilla" | "woodie";
  methodLabel: string;
  pivot: number;
  levels: PivotLevel[];
}

export interface PivotPayload {
  price: number;
  daily: {
    high: number;
    low: number;
    close: number;
    open: number;
    date: string;
  };
  weekly: {
    high: number;
    low: number;
    close: number;
    date: string;
  };
  dailyPivots: PivotSet[];
  weeklyPivots: PivotSet[];
  nearestSupport: PivotLevel | null;
  nearestResistance: PivotLevel | null;
  generatedAt: string;
}

function classical(h: number, l: number, c: number, currentPrice: number): PivotSet {
  const P  = (h + l + c) / 3;
  const R1 = 2 * P - l;
  const S1 = 2 * P - h;
  const R2 = P + (h - l);
  const S2 = P - (h - l);
  const R3 = h + 2 * (P - l);
  const S3 = l - 2 * (h - P);
  const levels = [
    { label: "R3", price: R3, type: "resistance" as const, strength: "normal" as const },
    { label: "R2", price: R2, type: "resistance" as const, strength: "strong" as const },
    { label: "R1", price: R1, type: "resistance" as const, strength: "normal" as const },
    { label: "P",  price: P,  type: "pivot" as const,     strength: "strong" as const },
    { label: "S1", price: S1, type: "support" as const,   strength: "normal" as const },
    { label: "S2", price: S2, type: "support" as const,   strength: "strong" as const },
    { label: "S3", price: S3, type: "support" as const,   strength: "normal" as const },
  ].map(lv => ({ ...lv, price: +lv.price.toFixed(2), isCurrentZone: Math.abs(currentPrice - lv.price) / currentPrice < 0.003 }));
  return { method: "classical", methodLabel: "Classical (PP)", pivot: +P.toFixed(2), levels };
}

function fibonacci(h: number, l: number, c: number, currentPrice: number): PivotSet {
  const P     = (h + l + c) / 3;
  const range = h - l;
  const R1 = P + 0.382 * range;
  const R2 = P + 0.618 * range;
  const R3 = P + 1.000 * range;
  const S1 = P - 0.382 * range;
  const S2 = P - 0.618 * range;
  const S3 = P - 1.000 * range;
  const levels = [
    { label: "R3 (100%)", price: R3, type: "resistance" as const, strength: "strong" as const },
    { label: "R2 (61.8%)",price: R2, type: "resistance" as const, strength: "strong" as const },
    { label: "R1 (38.2%)",price: R1, type: "resistance" as const, strength: "normal" as const },
    { label: "PP",         price: P,  type: "pivot" as const,     strength: "strong" as const },
    { label: "S1 (38.2%)",price: S1, type: "support" as const,   strength: "normal" as const },
    { label: "S2 (61.8%)",price: S2, type: "support" as const,   strength: "strong" as const },
    { label: "S3 (100%)", price: S3, type: "support" as const,   strength: "strong" as const },
  ].map(lv => ({ ...lv, price: +lv.price.toFixed(2), isCurrentZone: Math.abs(currentPrice - lv.price) / currentPrice < 0.003 }));
  return { method: "fibonacci", methodLabel: "Fibonacci Pivots", pivot: +P.toFixed(2), levels };
}

function camarilla(h: number, l: number, c: number, currentPrice: number): PivotSet {
  const P  = (h + l + c) / 3;
  const range = h - l;
  const R4 = c + range * 1.1 / 2;
  const R3 = c + range * 1.1 / 4;
  const R2 = c + range * 1.1 / 6;
  const R1 = c + range * 1.1 / 12;
  const S1 = c - range * 1.1 / 12;
  const S2 = c - range * 1.1 / 6;
  const S3 = c - range * 1.1 / 4;
  const S4 = c - range * 1.1 / 2;
  const levels = [
    { label: "R4", price: R4, type: "resistance" as const, strength: "strong" as const },
    { label: "R3", price: R3, type: "resistance" as const, strength: "strong" as const },
    { label: "R2", price: R2, type: "resistance" as const, strength: "normal" as const },
    { label: "R1", price: R1, type: "resistance" as const, strength: "normal" as const },
    { label: "PP", price: P,  type: "pivot" as const,     strength: "normal" as const },
    { label: "S1", price: S1, type: "support" as const,   strength: "normal" as const },
    { label: "S2", price: S2, type: "support" as const,   strength: "normal" as const },
    { label: "S3", price: S3, type: "support" as const,   strength: "strong" as const },
    { label: "S4", price: S4, type: "support" as const,   strength: "strong" as const },
  ].map(lv => ({ ...lv, price: +lv.price.toFixed(2), isCurrentZone: Math.abs(currentPrice - lv.price) / currentPrice < 0.003 }));
  return { method: "camarilla", methodLabel: "Camarilla Pivots", pivot: +P.toFixed(2), levels };
}

function woodie(h: number, l: number, c: number, o: number, currentPrice: number): PivotSet {
  const P  = (h + l + 2 * c) / 4;
  const R1 = 2 * P - l;
  const S1 = 2 * P - h;
  const R2 = P + (h - l);
  const S2 = P - (h - l);
  const levels = [
    { label: "R2", price: R2, type: "resistance" as const, strength: "strong" as const },
    { label: "R1", price: R1, type: "resistance" as const, strength: "normal" as const },
    { label: "PP", price: P,  type: "pivot" as const,     strength: "strong" as const },
    { label: "S1", price: S1, type: "support" as const,   strength: "normal" as const },
    { label: "S2", price: S2, type: "support" as const,   strength: "strong" as const },
  ].map(lv => ({ ...lv, price: +lv.price.toFixed(2), isCurrentZone: Math.abs(currentPrice - lv.price) / currentPrice < 0.003 }));
  return { method: "woodie", methodLabel: "Woodie's Pivots", pivot: +P.toFixed(2), levels };
}

let CACHE: { data: PivotPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Daily OHLC (last 2 days)
    const dailyUrl  = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=5d&interval=1d&includePrePost=false";
    // Weekly OHLC (last 2 weeks)
    const weeklyUrl = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=8wk&interval=1wk&includePrePost=false";
    const [dr, wr] = await Promise.all([
      fetch(dailyUrl,  { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
      fetch(weeklyUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
    ]);
    if (!dr.ok) throw new Error(`Yahoo daily ${dr.status}`);
    const dj = await dr.json();
    const dResult = dj?.chart?.result?.[0];
    if (!dResult) throw new Error("No daily data");

    const dq  = dResult.indicators?.quote?.[0] ?? {};
    const dTs = dResult.timestamp ?? [];
    const dH: (number|null)[] = dq.high  ?? [];
    const dL: (number|null)[] = dq.low   ?? [];
    const dC: (number|null)[] = dq.close ?? [];
    const dO: (number|null)[] = dq.open  ?? [];

    const price = dResult.meta?.regularMarketPrice ?? dC.filter(Boolean).at(-1) ?? 3000;

    // Previous day (index -2 if today in progress, else -1)
    const prevIdx = dH.length - 2;
    const prevH = dH[prevIdx] ?? dH.at(-1) ?? 3010;
    const prevL = dL[prevIdx] ?? dL.at(-1) ?? 2990;
    const prevC = dC[prevIdx] ?? dC.at(-1) ?? 3000;
    const prevO = dO[prevIdx] ?? dO.at(-1) ?? 3000;
    const prevDate = new Date(dTs[prevIdx] * 1000).toISOString().slice(0, 10);

    // Weekly data
    let wH = prevH * 1.05, wL = prevL * 0.95, wC = prevC, wDate = prevDate;
    if (wr.ok) {
      const wj = await wr.json();
      const wResult = wj?.chart?.result?.[0];
      if (wResult) {
        const wq  = wResult.indicators?.quote?.[0] ?? {};
        const wTs = wResult.timestamp ?? [];
        const wHArr: (number|null)[] = wq.high  ?? [];
        const wLArr: (number|null)[] = wq.low   ?? [];
        const wCArr: (number|null)[] = wq.close ?? [];
        const wi = wHArr.length - 2;
        if (wi >= 0 && wHArr[wi] != null) {
          wH = wHArr[wi]!; wL = wLArr[wi]!; wC = wCArr[wi]!;
          wDate = new Date(wTs[wi] * 1000).toISOString().slice(0, 10);
        }
      }
    }

    const dailyPivots  = [classical(prevH, prevL, prevC, price), fibonacci(prevH, prevL, prevC, price), camarilla(prevH, prevL, prevC, price), woodie(prevH, prevL, prevC, prevO, price)];
    const weeklyPivots = [classical(wH, wL, wC, price), fibonacci(wH, wL, wC, price)];

    const allLevels = dailyPivots.flatMap(ps => ps.levels);
    const below = allLevels.filter(l => l.price < price).sort((a, b) => b.price - a.price);
    const above = allLevels.filter(l => l.price > price).sort((a, b) => a.price - b.price);

    const data: PivotPayload = {
      price: +price.toFixed(2),
      daily:  { high: +prevH.toFixed(2), low: +prevL.toFixed(2), close: +prevC.toFixed(2), open: +prevO.toFixed(2), date: prevDate },
      weekly: { high: +wH.toFixed(2),    low: +wL.toFixed(2),    close: +wC.toFixed(2),    date: wDate },
      dailyPivots,
      weeklyPivots,
      nearestSupport:    below[0] ?? null,
      nearestResistance: above[0] ?? null,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
