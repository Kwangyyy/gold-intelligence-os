import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface HeatCell {
  date: string;       // YYYY-MM-DD
  dayOfWeek: number;  // 0=Sun, 1=Mon...6=Sat
  weekOfYear: number;
  month: number;
  returnPct: number;
  color: string;
  tooltip: string;
  price: number;
}

export interface MonthSummary {
  month: number;
  year: number;
  label: string;     // "Jun 2025"
  avgReturn: number;
  totalReturn: number;
  winDays: number;
  totalDays: number;
  color: string;
}

export interface PriceHeatmapPayload {
  cells: HeatCell[];
  monthSummaries: MonthSummary[];
  goldPrice: number;
  ytdReturn: number;
  bestDay: { date: string; ret: number };
  worstDay: { date: string; ret: number };
  winRate: number;     // % of positive days
  avgDailyRet: number;
  streak: number;      // current win/loss streak (positive=win, negative=loss)
  streakTh: string;
  generatedAt: string;
}

function retColor(ret: number): string {
  if (ret >  2.0) return "#14532d";
  if (ret >  1.0) return "#166534";
  if (ret >  0.3) return "#16a34a";
  if (ret >  0.0) return "#4ade80";
  if (ret === 0)  return "#374151";
  if (ret > -0.3) return "#fca5a5";
  if (ret > -1.0) return "#ef4444";
  if (ret > -2.0) return "#991b1b";
  return "#7f1d1d";
}

function isoWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const y = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

async function fetchGold() {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1y&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

let CACHE: { data: PriceHeatmapPayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const j = await fetchGold();
    type YJ = {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number };
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: (number | null)[]; open?: (number | null)[] }> };
        }>;
      };
    } | null;
    const obj = j as YJ;

    const timestamps = obj?.chart?.result?.[0]?.timestamp ?? [];
    const closes     = (obj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
    const spot       = obj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? closes.at(-1) ?? 3200;

    const cells: HeatCell[] = [];
    let bestDay   = { date: "", ret: -999 };
    let worstDay  = { date: "", ret: 999 };
    let winCount  = 0;
    let totalRet  = 0;
    let firstClose: number | null = null;

    for (let i = 1; i < closes.length && i < timestamps.length; i++) {
      const prev = closes[i - 1];
      const curr = closes[i];
      if (!prev || !curr) continue;
      const ret  = +((curr - prev) / prev * 100).toFixed(3);
      const ts   = timestamps[i];
      const date = new Date(ts * 1000);
      const dateStr = date.toISOString().slice(0, 10);

      cells.push({
        date: dateStr,
        dayOfWeek:  date.getDay(),
        weekOfYear: isoWeek(date),
        month:      date.getMonth() + 1,
        returnPct:  ret,
        color:      retColor(ret),
        tooltip:    `${dateStr}: ${ret > 0 ? "+" : ""}${ret}%`,
        price:      +curr.toFixed(0),
      });

      if (ret > bestDay.ret)   bestDay  = { date: dateStr, ret };
      if (ret < worstDay.ret)  worstDay = { date: dateStr, ret };
      if (ret > 0) winCount++;
      totalRet += ret;
      if (!firstClose) firstClose = prev;
    }

    // Month summaries
    const byMonth: Record<string, HeatCell[]> = {};
    cells.forEach(c => {
      const key = c.date.slice(0, 7); // YYYY-MM
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(c);
    });
    const monthSummaries: MonthSummary[] = Object.entries(byMonth).map(([key, cArr]) => {
      const [yr, mo] = key.split("-").map(Number);
      const rets     = cArr.map(c => c.returnPct);
      const avg      = rets.reduce((a, b) => a + b, 0) / rets.length;
      const total    = rets.reduce((a, b) => a + b, 0);
      const wins     = rets.filter(r => r > 0).length;
      return {
        month: mo, year: yr,
        label: `${MONTH_LABELS[mo - 1]} ${yr}`,
        avgReturn:   +avg.toFixed(3),
        totalReturn: +total.toFixed(2),
        winDays: wins, totalDays: rets.length,
        color: total > 3 ? "#34d399" : total > 0 ? "#86efac" : total > -3 ? "#f87171" : "#991b1b",
      };
    });

    const winRate  = cells.length > 0 ? +(winCount / cells.length * 100).toFixed(1) : 50;
    const avgDaily = cells.length > 0 ? +(totalRet / cells.length).toFixed(3) : 0;
    const ytd      = firstClose ? +((spot - firstClose) / firstClose * 100).toFixed(2) : 0;

    // Current streak
    let streak = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (streak === 0) {
        streak = cells[i].returnPct >= 0 ? 1 : -1;
      } else if (streak > 0 && cells[i].returnPct >= 0) {
        streak++;
      } else if (streak < 0 && cells[i].returnPct < 0) {
        streak--;
      } else {
        break;
      }
    }
    const streakTh = streak > 0
      ? `${streak} วันติดต่อขึ้น`
      : streak < 0
      ? `${Math.abs(streak)} วันติดต่อลง`
      : "เริ่มต้น";

    const data: PriceHeatmapPayload = {
      cells, monthSummaries,
      goldPrice: +spot.toFixed(0), ytdReturn: ytd,
      bestDay: { date: bestDay.date, ret: +bestDay.ret.toFixed(3) },
      worstDay: { date: worstDay.date, ret: +worstDay.ret.toFixed(3) },
      winRate, avgDailyRet: avgDaily, streak, streakTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
