import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface MonthStat {
  month: number;           // 1-12
  monthLabel: string;      // "Jan"
  monthLabelTh: string;    // "ม.ค."
  avgReturn: number;       // historical avg return % for this month (20-year)
  winRate: number;         // % of years this month closed positive
  currentYearReturn: number | null; // actual return this year (null if future)
  isCurrent: boolean;
  isPositiveSeason: boolean; // avg > 0
  barColor: string;
}

export interface SeasonalEvent {
  month: number;
  event: string;
  eventTh: string;
  impact: "bullish" | "bearish" | "mixed";
  impactColor: string;
}

export interface GoldCalendarPayload {
  currentYear: number;
  currentMonth: number;
  ytdReturn: number;         // gold YTD return this year
  bestMonth: number;         // month with highest avg
  worstMonth: number;        // month with lowest avg
  avgBestLabel: string;
  avgBestLabelTh: string;
  months: MonthStat[];
  seasonalEvents: SeasonalEvent[];
  currentSeasonBias: "bullish" | "bearish" | "neutral";
  currentSeasonBiasTh: string;
  generatedAt: string;
}

// Historical gold average monthly returns (approximation from 2000-2023 data)
// Source: academic studies / WGC data approximation
const HIST_AVG: number[] = [
  1.8,   // Jan — Q1 dip-to-rally (jewellery demand reset)
  2.1,   // Feb — Valentine / India wedding season
  -0.3,  // Mar — end-Q1 risk-on pullback
  0.5,   // Apr — muted
  -0.8,  // May — "sell in May" effect
  0.9,   // Jun — H1 close positioning
  0.6,   // Jul — summer lull
  1.7,   // Aug — summer safe haven + Asia demand
  1.5,   // Sep — Dhanteras / Navratri Indian gold season
  -0.4,  // Oct — typically weak (Q3 close, equity rally)
  0.2,   // Nov — Diwali demand, year-end positioning
  1.1,   // Dec — year-end safe haven + early Q1 preview
];

// Historical win rates (% years positive)
const WIN_RATES: number[] = [62, 67, 45, 52, 40, 55, 53, 65, 62, 44, 50, 58];

const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

const SEASONAL_EVENTS: SeasonalEvent[] = [
  { month: 1,  event: "India wedding season wrap-up",          eventTh: "ช่วงงานแต่งงานอินเดียปิดฤดู",      impact: "bullish",  impactColor: "#34d399" },
  { month: 2,  event: "Valentine's / Lunar New Year demand",   eventTh: "วาเลนไทน์ / ตรุษจีน — ซื้อทอง",    impact: "bullish",  impactColor: "#34d399" },
  { month: 4,  event: "Q1 earnings → risk-on rotation",        eventTh: "ผลประกอบการ Q1 → เงินไหลออกทอง",    impact: "mixed",    impactColor: "#f5c451" },
  { month: 5,  event: "Sell in May effect",                    eventTh: "'Sell in May' สินค้าโภคภัณฑ์อ่อนลง", impact: "bearish",  impactColor: "#f87171" },
  { month: 8,  event: "Summer safe-haven + India pre-season",  eventTh: "ช่วงซื้อทองก่อนเทศกาลอินเดีย",      impact: "bullish",  impactColor: "#34d399" },
  { month: 9,  event: "Navratri / Dhanteras gold demand",      eventTh: "Dhanteras — ช้อปทองอินเดียสูงสุด",  impact: "bullish",  impactColor: "#34d399" },
  { month: 10, event: "Diwali — peak India demand",            eventTh: "Diwali — อินเดียซื้อทองสูงสุด",     impact: "bullish",  impactColor: "#34d399" },
  { month: 12, event: "Year-end tax loss harvesting",          eventTh: "ปิดปีงบ — บางส่วนขายทองลดภาษี",     impact: "mixed",    impactColor: "#f5c451" },
];

async function fetchYahooAnnual(symbol: string, year: number) {
  const start = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
  const end   = Math.floor(new Date(`${year}-12-31`).getTime() / 1000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=1mo`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

type YahooMonthly = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[]; open?: (number | null)[] }> };
    }>;
  };
} | null;

let CACHE: { data: GoldCalendarPayload; ts: number } | null = null;
const TTL = 4 * 60 * 60 * 1000; // 4h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const now          = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    const j = await fetchYahooAnnual("GC%3DF", currentYear);
    const obj = j as YahooMonthly;
    const closes  = (obj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
    const opens   = (obj?.chart?.result?.[0]?.indicators?.quote?.[0]?.open  ?? []).filter((c): c is number => c != null);
    const spotPrice = obj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? closes.at(-1) ?? 0;

    // Map monthly closes (Yahoo returns 1 close per month for interval=1mo)
    const monthlyReturns: (number | null)[] = Array(12).fill(null);
    closes.forEach((close, i) => {
      if (i < opens.length && opens[i] != null) {
        const ret = (close - opens[i]) / opens[i] * 100;
        if (i < 12) monthlyReturns[i] = +ret.toFixed(2);
      }
    });

    // YTD: from first available open to current spot
    const ytdReturn = opens[0] && spotPrice ? +((spotPrice - opens[0]) / opens[0] * 100).toFixed(2) : 0;

    const months: MonthStat[] = HIST_AVG.map((avg, idx) => {
      const m = idx + 1;
      const color = avg >= 1.5 ? "#34d399" : avg >= 0.5 ? "#86efac" : avg >= 0 ? "#f5c451" : "#f87171";
      return {
        month:              m,
        monthLabel:         MONTHS_EN[idx],
        monthLabelTh:       MONTHS_TH[idx],
        avgReturn:          avg,
        winRate:            WIN_RATES[idx],
        currentYearReturn:  m < currentMonth ? (monthlyReturns[idx] ?? null) : m === currentMonth ? (monthlyReturns[idx] ?? null) : null,
        isCurrent:          m === currentMonth,
        isPositiveSeason:   avg > 0,
        barColor:           color,
      };
    });

    const bestIdx  = HIST_AVG.indexOf(Math.max(...HIST_AVG));
    const worstIdx = HIST_AVG.indexOf(Math.min(...HIST_AVG));

    const curAvg = HIST_AVG[currentMonth - 1];
    const currentSeasonBias = curAvg > 0.5 ? "bullish" : curAvg < -0.3 ? "bearish" : "neutral";

    const data: GoldCalendarPayload = {
      currentYear, currentMonth, ytdReturn,
      bestMonth:  bestIdx + 1,
      worstMonth: worstIdx + 1,
      avgBestLabel:   MONTHS_EN[bestIdx],
      avgBestLabelTh: MONTHS_TH[bestIdx],
      months,
      seasonalEvents: SEASONAL_EVENTS,
      currentSeasonBias,
      currentSeasonBiasTh: currentSeasonBias === "bullish"
        ? `${MONTHS_TH[currentMonth - 1]} — ฤดูกาลดีสำหรับทอง (avg ${curAvg > 0 ? "+" : ""}${curAvg}%)`
        : currentSeasonBias === "bearish"
        ? `${MONTHS_TH[currentMonth - 1]} — ฤดูกาลอ่อนแอ (avg ${curAvg}%)`
        : `${MONTHS_TH[currentMonth - 1]} — ฤดูกาลปานกลาง (avg ${curAvg > 0 ? "+" : ""}${curAvg}%)`,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
