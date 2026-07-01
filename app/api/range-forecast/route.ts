import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ForecastHorizon {
  label: string;          // "1 Day", "1 Week", "1 Month"
  labelTh: string;
  days: number;
  low68: number;          // 1 std dev (68% probability)
  high68: number;
  low95: number;          // 2 std dev (95% probability)
  high95: number;
  expectedMove: number;   // ±% at 1σ
  bias: number;           // drift component (+ or -)
}

export interface HistoricalVolBar {
  date: string;
  rv20: number;           // 20-day realized vol (annualized %)
}

export interface RangeForecastPayload {
  currentPrice: number;
  dailyVol: number;         // 1-day std dev in $
  annualizedVol: number;    // annualized vol %
  realizedVol20d: number;   // 20-day realized vol %
  horizons: ForecastHorizon[];
  volHistory: HistoricalVolBar[];
  volRegime: "low" | "normal" | "high" | "extreme";
  volRegimeTh: string;
  volImplicationTh: string;
  generatedAt: string;
}

let CACHE: { data: RangeForecastPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=120d&interval=1d";
    const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) throw new Error(`Yahoo ${r.status}`);
    const j   = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res) throw new Error("No result");

    const timestamps: number[] = res.timestamp ?? [];
    const rawClose: (number | null)[] = res.indicators?.quote?.[0]?.close ?? [];
    const closes: number[] = [];
    const dates: string[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (rawClose[i] != null) {
        closes.push(rawClose[i]!);
        dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
      }
    }

    const currentPrice = res.meta?.regularMarketPrice ?? closes.at(-1) ?? 0;

    // Log returns
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      logReturns.push(Math.log(closes[i] / closes[i - 1]));
    }

    // Recent 20-day std dev (daily)
    const recent20 = logReturns.slice(-20);
    const mean20   = recent20.reduce((a, v) => a + v, 0) / recent20.length;
    const dailyStd = Math.sqrt(recent20.reduce((a, v) => a + (v - mean20) ** 2, 0) / (recent20.length - 1));
    const annualizedVol = dailyStd * Math.sqrt(252) * 100;
    const dailyVol$ = currentPrice * dailyStd;
    const drift20d  = mean20; // daily log drift

    // Realized vol history (rolling 20-day window)
    const volHistory: HistoricalVolBar[] = [];
    for (let i = 20; i < logReturns.length; i++) {
      const slice = logReturns.slice(i - 20, i);
      const m     = slice.reduce((a, v) => a + v, 0) / slice.length;
      const std   = Math.sqrt(slice.reduce((a, v) => a + (v - m) ** 2, 0) / (slice.length - 1));
      volHistory.push({
        date: dates[i + 1] ?? dates.at(-1)!,
        rv20: +(std * Math.sqrt(252) * 100).toFixed(1),
      });
    }
    const last40VolHist = volHistory.slice(-40);

    // Vol regime
    const rv = annualizedVol;
    const volRegime: RangeForecastPayload["volRegime"] =
      rv < 10 ? "low" : rv < 18 ? "normal" : rv < 28 ? "high" : "extreme";
    const volRegimeTh =
      volRegime === "low" ? "ความผันผวนต่ำ (<10%)" :
      volRegime === "normal" ? "ความผันผวนปกติ (10-18%)" :
      volRegime === "high" ? "ความผันผวนสูง (18-28%)" : "ความผันผวนสูงมาก (>28%)";
    const volImplicationTh =
      volRegime === "low" ? "ตลาดสงบ — Breakout อาจเกิดขึ้นหลัง consolidation ยาวนาน" :
      volRegime === "normal" ? "ความผันผวนปกติ — ช่วงราคาน่าเชื่อถือ" :
      volRegime === "high" ? "ความผันผวนสูง — ขยาย SL และลด position size" :
      "ความผันผวนสูงมาก — พิจารณางดเทรดหรือ hedge";

    // Statistical range forecasts
    function makeHorizon(labelEn: string, labelTh: string, tradingDays: number): ForecastHorizon {
      const sqrtT     = Math.sqrt(tradingDays);
      const totalDrift = drift20d * tradingDays;
      const sigma1    = dailyStd * sqrtT;
      const sigma2    = 2 * dailyStd * sqrtT;
      const expected  = Math.exp(totalDrift + sigma1 ** 2 / 2) - 1; // lognormal drift
      return {
        label: labelEn, labelTh, days: tradingDays,
        low68:  +(currentPrice * Math.exp(totalDrift - sigma1)).toFixed(0),
        high68: +(currentPrice * Math.exp(totalDrift + sigma1)).toFixed(0),
        low95:  +(currentPrice * Math.exp(totalDrift - sigma2)).toFixed(0),
        high95: +(currentPrice * Math.exp(totalDrift + sigma2)).toFixed(0),
        expectedMove: +(sigma1 * 100).toFixed(2),
        bias: +(expected * 100).toFixed(2),
      };
    }

    const horizons: ForecastHorizon[] = [
      makeHorizon("1 Day",   "1 วัน",      1),
      makeHorizon("1 Week",  "1 สัปดาห์",  5),
      makeHorizon("2 Weeks", "2 สัปดาห์", 10),
      makeHorizon("1 Month", "1 เดือน",   21),
    ];

    const data: RangeForecastPayload = {
      currentPrice: +currentPrice.toFixed(0),
      dailyVol: +dailyVol$.toFixed(0),
      annualizedVol: +annualizedVol.toFixed(1),
      realizedVol20d: +annualizedVol.toFixed(1),
      horizons, volHistory: last40VolHist,
      volRegime, volRegimeTh, volImplicationTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
