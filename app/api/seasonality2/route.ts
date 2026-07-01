import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface MonthStat {
  month: number;       // 1-12
  monthName: string;
  avgReturn: number;   // % avg monthly return
  winRate: number;     // % positive months
  avgRange: number;    // avg monthly H-L in $
  bestYear: number;
  worstYear: number;
  bestReturn: number;
  worstReturn: number;
  sampleCount: number;
}

export interface WeekOfYearStat {
  week: number;         // 1-52
  avgReturn: number;
  winRate: number;
  avgRange: number;
  sampleCount: number;
}

export interface YearStat {
  year: number;
  open: number;
  close: number;
  high: number;
  low: number;
  annualReturn: number; // %
  range: number;
}

export interface SeasonalityPayload {
  price: number;
  currentMonth: number;
  currentWeek: number;
  monthStats: MonthStat[];
  weekStats: WeekOfYearStat[];
  yearStats: YearStat[];
  bestMonth: MonthStat;
  worstMonth: MonthStat;
  currentMonthStat: MonthStat;
  generatedAt: string;
}

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

let CACHE: { data: SeasonalityPayload; ts: number } | null = null;
const TTL = 6 * 60 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch 10 years of monthly data
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=10y&interval=1mo&includePrePost=false";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const q = result.indicators?.quote?.[0] ?? {};
    const timestamps: number[] = result.timestamp ?? [];
    const rawH: (number|null)[] = q.high  ?? [];
    const rawL: (number|null)[] = q.low   ?? [];
    const rawC: (number|null)[] = q.close ?? [];
    const rawO: (number|null)[] = q.open  ?? [];

    const price = result.meta?.regularMarketPrice ?? rawC.filter(Boolean).at(-1) ?? 3000;

    // Build monthly bars
    interface MonthBar { ts: number; o: number; h: number; l: number; c: number }
    const bars: MonthBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = rawO[i], h = rawH[i], l = rawL[i], c = rawC[i];
      if (o == null || h == null || l == null || c == null || o === 0) continue;
      bars.push({ ts: timestamps[i], o, h, l, c });
    }

    // Monthly seasonality
    const monthBuckets = new Map<number, { returns: number[]; ranges: number[]; years: number[]; best: number; worst: number }>();
    bars.forEach(b => {
      const d = new Date(b.ts * 1000);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      const ret = ((b.c - b.o) / b.o) * 100;
      const rng = b.h - b.l;
      if (!monthBuckets.has(m)) monthBuckets.set(m, { returns: [], ranges: [], years: [], best: -999, worst: 999 });
      const bucket = monthBuckets.get(m)!;
      bucket.returns.push(ret);
      bucket.ranges.push(rng);
      bucket.years.push(y);
      if (ret > bucket.best) { bucket.best = ret; }
      if (ret < bucket.worst) { bucket.worst = ret; }
    });

    const monthStats: MonthStat[] = [];
    for (let m = 1; m <= 12; m++) {
      const b = monthBuckets.get(m);
      if (!b || !b.returns.length) {
        monthStats.push({ month: m, monthName: MONTH_NAMES[m], avgReturn: 0, winRate: 50, avgRange: 0, bestYear: 0, worstYear: 0, bestReturn: 0, worstReturn: 0, sampleCount: 0 });
        continue;
      }
      const avgRet = b.returns.reduce((a, v) => a + v, 0) / b.returns.length;
      const wins   = b.returns.filter(r => r > 0).length;
      const avgRng = b.ranges.reduce((a, v) => a + v, 0) / b.ranges.length;
      const bestIdx  = b.returns.indexOf(Math.max(...b.returns));
      const worstIdx = b.returns.indexOf(Math.min(...b.returns));
      monthStats.push({
        month: m, monthName: MONTH_NAMES[m],
        avgReturn:   +avgRet.toFixed(3),
        winRate:     +(wins / b.returns.length * 100).toFixed(1),
        avgRange:    +avgRng.toFixed(2),
        bestYear:    b.years[bestIdx],
        worstYear:   b.years[worstIdx],
        bestReturn:  +b.returns[bestIdx].toFixed(2),
        worstReturn: +b.returns[worstIdx].toFixed(2),
        sampleCount: b.returns.length,
      });
    }

    // Week-of-year seasonality (using ISO week from monthly data — approximate)
    // For weekly precision, fetch weekly data
    const weekUrl = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=5y&interval=1wk&includePrePost=false";
    const weekRes = await fetch(weekUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    const weekBuckets = new Map<number, { returns: number[]; ranges: number[] }>();
    if (weekRes.ok) {
      const wJson = await weekRes.json();
      const wResult = wJson?.chart?.result?.[0];
      if (wResult) {
        const wq = wResult.indicators?.quote?.[0] ?? {};
        const wTs: number[] = wResult.timestamp ?? [];
        const wO: (number|null)[] = wq.open  ?? [];
        const wH: (number|null)[] = wq.high  ?? [];
        const wL: (number|null)[] = wq.low   ?? [];
        const wC: (number|null)[] = wq.close ?? [];
        for (let i = 0; i < wTs.length; i++) {
          const o = wO[i], h = wH[i], l = wL[i], c = wC[i];
          if (o == null || h == null || l == null || c == null || o === 0) continue;
          const d = new Date(wTs[i] * 1000);
          const wk = getISOWeek(d);
          const ret = ((c - o) / o) * 100;
          const rng = h - l;
          if (!weekBuckets.has(wk)) weekBuckets.set(wk, { returns: [], ranges: [] });
          weekBuckets.get(wk)!.returns.push(ret);
          weekBuckets.get(wk)!.ranges.push(rng);
        }
      }
    }

    const weekStats: WeekOfYearStat[] = [];
    for (let w = 1; w <= 52; w++) {
      const b = weekBuckets.get(w);
      if (!b || !b.returns.length) {
        weekStats.push({ week: w, avgReturn: 0, winRate: 50, avgRange: 0, sampleCount: 0 });
        continue;
      }
      weekStats.push({
        week: w,
        avgReturn:   +(b.returns.reduce((a, v) => a + v, 0) / b.returns.length).toFixed(3),
        winRate:     +(b.returns.filter(r => r > 0).length / b.returns.length * 100).toFixed(1),
        avgRange:    +(b.ranges.reduce((a, v) => a + v, 0) / b.ranges.length).toFixed(2),
        sampleCount: b.returns.length,
      });
    }

    // Year stats
    const yearMap = new Map<number, { opens: number[]; closes: number[]; highs: number[]; lows: number[] }>();
    bars.forEach(b => {
      const y = new Date(b.ts * 1000).getUTCFullYear();
      if (!yearMap.has(y)) yearMap.set(y, { opens: [], closes: [], highs: [], lows: [] });
      const ym = yearMap.get(y)!;
      ym.opens.push(b.o); ym.closes.push(b.c); ym.highs.push(b.h); ym.lows.push(b.l);
    });
    const yearStats: YearStat[] = [];
    yearMap.forEach((ym, y) => {
      const open  = ym.opens[0];
      const close = ym.closes[ym.closes.length - 1];
      const high  = Math.max(...ym.highs);
      const low   = Math.min(...ym.lows);
      yearStats.push({ year: y, open: +open.toFixed(0), close: +close.toFixed(0), high: +high.toFixed(0), low: +low.toFixed(0), annualReturn: +((close - open) / open * 100).toFixed(2), range: +(high - low).toFixed(0) });
    });
    yearStats.sort((a, b) => a.year - b.year);

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentWeek  = getISOWeek(now);

    const bestMonth  = [...monthStats].filter(m => m.sampleCount > 0).sort((a, b) => b.avgReturn - a.avgReturn)[0];
    const worstMonth = [...monthStats].filter(m => m.sampleCount > 0).sort((a, b) => a.avgReturn - b.avgReturn)[0];

    const data: SeasonalityPayload = {
      price: +price.toFixed(2), currentMonth, currentWeek,
      monthStats, weekStats, yearStats,
      bestMonth, worstMonth,
      currentMonthStat: monthStats[currentMonth - 1],
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
