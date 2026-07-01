import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface DayVolStat {
  date: string;        // YYYY-MM-DD
  dayOfWeek: number;  // 0=Sun…6=Sat
  open: number;
  high: number;
  low: number;
  close: number;
  range: number;        // H - L
  rangePct: number;     // (H-L)/L * 100
  atr: number;          // rolling 14d ATR on that day
  realizedVol: number;  // 10d rolling realized vol (annualized %)
  isPositive: boolean;
}

export interface IntradayBar {
  time: string;        // HH:MM UTC
  open: number;
  high: number;
  low: number;
  close: number;
  range: number;
}

export interface VolatilityPayload {
  price: number;
  atr14: number;
  atrPct: number;
  realizedVol30: number;   // 30d realized vol annualized %
  weeklyAvgRange: number;
  monthlyAvgRange: number;
  highestRange: DayVolStat;
  lowestRange: DayVolStat;
  dayOfWeekAvg: { day: string; avgRange: number; avgRangePct: number; count: number }[];
  history: DayVolStat[];   // last 90 trading days
  intraday: IntradayBar[]; // today's 1h bars
  generatedAt: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let CACHE: { data: VolatilityPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch 90-day daily data
    const dailyUrl = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=90d&interval=1d&includePrePost=false";
    // Fetch today's 1h intraday bars
    const intradayUrl = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1d&interval=1h&includePrePost=false";

    const [dailyRes, intradayRes] = await Promise.all([
      fetch(dailyUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
      fetch(intradayUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
    ]);

    if (!dailyRes.ok) throw new Error(`Yahoo daily ${dailyRes.status}`);
    const dailyJson = await dailyRes.json();
    const dailyResult = dailyJson?.chart?.result?.[0];
    if (!dailyResult) throw new Error("No daily data");

    const dq = dailyResult.indicators?.quote?.[0] ?? {};
    const dTs: number[] = dailyResult.timestamp ?? [];
    const dH: (number|null)[] = dq.high  ?? [];
    const dL: (number|null)[] = dq.low   ?? [];
    const dC: (number|null)[] = dq.close ?? [];
    const dO: (number|null)[] = dq.open  ?? [];

    const price = dailyResult.meta?.regularMarketPrice ?? dC.filter(Boolean).at(-1) ?? 3000;

    // Filter out nulls and build raw bars
    const raw: { ts: number; o: number; h: number; l: number; c: number }[] = [];
    for (let i = 0; i < dTs.length; i++) {
      const o = dO[i], h = dH[i], l = dL[i], c = dC[i];
      if (o == null || h == null || l == null || c == null) continue;
      raw.push({ ts: dTs[i], o, h, l, c });
    }

    // ATR14 (Wilder smoothing on TR)
    function calcAtr14(bars: typeof raw): number[] {
      if (bars.length < 2) return bars.map(() => 0);
      const tr: number[] = [bars[0].h - bars[0].l];
      for (let i = 1; i < bars.length; i++) {
        const prev = bars[i - 1].c;
        tr.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - prev), Math.abs(bars[i].l - prev)));
      }
      const atrs: number[] = [];
      let sum = tr.slice(0, 14).reduce((a, v) => a + v, 0);
      atrs.push(sum); // placeholder for first 13 bars
      for (let i = 0; i < 13; i++) atrs.push(sum / 14); // fill early
      for (let i = 14; i < tr.length; i++) {
        sum = sum - sum / 14 + tr[i];
        atrs.push(sum / 14);
      }
      return atrs.slice(0, bars.length);
    }

    // 10d rolling realized vol (log returns std dev × sqrt(252) × 100)
    function rollingRealizedVol(closes: number[], window = 10): number[] {
      const logRets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
      const result: number[] = [0]; // first bar no ret
      for (let i = 0; i < logRets.length; i++) {
        const slice = logRets.slice(Math.max(0, i - window + 1), i + 1);
        if (slice.length < 2) { result.push(0); continue; }
        const mean = slice.reduce((a, v) => a + v, 0) / slice.length;
        const variance = slice.reduce((a, v) => a + (v - mean) ** 2, 0) / (slice.length - 1);
        result.push(Math.sqrt(variance) * Math.sqrt(252) * 100);
      }
      return result;
    }

    const atrs = calcAtr14(raw);
    const closes = raw.map(r => r.c);
    const realizedVols = rollingRealizedVol(closes, 10);

    const history: DayVolStat[] = raw.map((r, i) => {
      const d = new Date(r.ts * 1000);
      const range = r.h - r.l;
      return {
        date: d.toISOString().slice(0, 10),
        dayOfWeek: d.getUTCDay(),
        open: +r.o.toFixed(2), high: +r.h.toFixed(2), low: +r.l.toFixed(2), close: +r.c.toFixed(2),
        range: +range.toFixed(2),
        rangePct: +(range / r.l * 100).toFixed(3),
        atr: +atrs[i].toFixed(2),
        realizedVol: +realizedVols[i].toFixed(2),
        isPositive: r.c >= r.o,
      };
    });

    // Day-of-week aggregation
    const dowBuckets = new Map<number, number[]>();
    history.forEach(d => {
      if (!dowBuckets.has(d.dayOfWeek)) dowBuckets.set(d.dayOfWeek, []);
      dowBuckets.get(d.dayOfWeek)!.push(d.range);
    });
    const dayOfWeekAvg = [1, 2, 3, 4, 5].map(dow => {
      const ranges = dowBuckets.get(dow) ?? [];
      const avg = ranges.length ? ranges.reduce((a, v) => a + v, 0) / ranges.length : 0;
      const avgRangePct = avg / (price || 3000) * 100;
      return { day: DAY_NAMES[dow], avgRange: +avg.toFixed(2), avgRangePct: +avgRangePct.toFixed(3), count: ranges.length };
    });

    // Stats
    const sorted = [...history].sort((a, b) => b.range - a.range);
    const last30 = history.slice(-30);
    const last7  = history.slice(-7);
    const atr14  = atrs.at(-1) ?? 0;

    // 30d realized vol
    const last30closes = closes.slice(-31);
    const rv30 = rollingRealizedVol(last30closes, 30).at(-1) ?? 0;

    // Intraday bars
    let intraday: IntradayBar[] = [];
    if (intradayRes.ok) {
      const iJson = await intradayRes.json();
      const iResult = iJson?.chart?.result?.[0];
      if (iResult) {
        const iq = iResult.indicators?.quote?.[0] ?? {};
        const iTs: number[] = iResult.timestamp ?? [];
        const iO: (number|null)[] = iq.open  ?? [];
        const iH: (number|null)[] = iq.high  ?? [];
        const iL: (number|null)[] = iq.low   ?? [];
        const iC: (number|null)[] = iq.close ?? [];
        for (let i = 0; i < iTs.length; i++) {
          const o = iO[i], h = iH[i], l = iL[i], c = iC[i];
          if (o == null || h == null || l == null || c == null) continue;
          const d = new Date(iTs[i] * 1000);
          const hh = d.getUTCHours().toString().padStart(2, "0");
          const mm = d.getUTCMinutes().toString().padStart(2, "0");
          intraday.push({ time: `${hh}:${mm}`, open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2), range: +(h - l).toFixed(2) });
        }
      }
    }

    const data: VolatilityPayload = {
      price: +price.toFixed(2),
      atr14: +atr14.toFixed(2),
      atrPct: +(atr14 / price * 100).toFixed(3),
      realizedVol30: +rv30.toFixed(2),
      weeklyAvgRange:  +(last7.reduce((a, d) => a + d.range, 0) / last7.length).toFixed(2),
      monthlyAvgRange: +(last30.reduce((a, d) => a + d.range, 0) / last30.length).toFixed(2),
      highestRange: sorted[0],
      lowestRange:  sorted[sorted.length - 1],
      dayOfWeekAvg,
      history: history.slice(-90),
      intraday,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
