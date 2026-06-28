// Gold Seasonality engine — fetches 10 years of GC=F daily OHLC and derives
// monthly, weekday, and annual pattern statistics. Server-side only.

export interface MonthStat {
  month: number;       // 1-12
  nameEn: string;
  nameTh: string;
  avgReturn: number;   // mean monthly % return across all sampled years
  medReturn: number;   // median
  winRate: number;     // % of years month closed positive
  count: number;       // number of years with data
  best:  { year: number; ret: number };
  worst: { year: number; ret: number };
  returns: { year: number; ret: number }[]; // all data points
}

export interface DayStat {
  day: number;         // 0=Mon … 4=Fri
  nameEn: string;
  nameTh: string;
  avgReturn: number;   // mean daily % change
  winRate: number;     // % of days that closed positive
  count: number;
}

export interface YearStat {
  year: number;
  ret: number;         // annual % return
  startPrice: number;
  endPrice: number;
}

export interface SeasonalityResult {
  months: MonthStat[];
  days: DayStat[];
  years: YearStat[];
  currentMonth: number;
  currentYear: number;
  dataFrom: string;
  dataTo: string;
  totalBars: number;
  price: number;
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const DAYS_EN   = ["Mon","Tue","Wed","Thu","Fri"];
const DAYS_TH   = ["จ.","อ.","พ.","พฤ.","ศ."];

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

// ── Fetch raw daily bars ──────────────────────────────────────────────────────

async function fetchDaily(): Promise<{ ts: number; open: number; close: number }[]> {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=12y&interval=1d&includePrePost=false";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("no data");

  const timestamps: number[]  = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens: number[]  = quote.open  ?? [];
  const closes: number[] = quote.close ?? [];

  const bars: { ts: number; open: number; close: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = opens[i]; const c = closes[i];
    if (o == null || c == null || isNaN(o) || isNaN(c)) continue;
    bars.push({ ts: timestamps[i] * 1000, open: o, close: c });
  }
  return bars.sort((a, b) => a.ts - b.ts);
}

// ── Main builder ──────────────────────────────────────────────────────────────

export async function buildSeasonality(): Promise<SeasonalityResult> {
  const bars = await fetchDaily();
  if (bars.length < 200) throw new Error("insufficient data");

  const now   = new Date();
  const price = bars[bars.length - 1].close;

  // ── Monthly statistics ────────────────────────────────────────────────────

  // Group bars by YYYY-MM
  const byYM = new Map<string, { ts: number; open: number; close: number }[]>();
  for (const b of bars) {
    const d   = new Date(b.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byYM.has(key)) byYM.set(key, []);
    byYM.get(key)!.push(b);
  }

  // For each month-year, compute % return (last close / first close − 1)
  const monthDataMap = new Map<number, { year: number; ret: number }[]>(); // month 1-12
  for (const [key, barsInMonth] of byYM) {
    const [yearStr, monthStr] = key.split("-");
    const month = parseInt(monthStr, 10);
    const year  = parseInt(yearStr, 10);
    if (year === now.getFullYear() && month === now.getMonth() + 1) continue; // skip current (incomplete)
    const first = barsInMonth[0].close;
    const last  = barsInMonth[barsInMonth.length - 1].close;
    const ret   = ((last - first) / first) * 100;
    if (!monthDataMap.has(month)) monthDataMap.set(month, []);
    monthDataMap.get(month)!.push({ year, ret });
  }

  const months: MonthStat[] = [];
  for (let m = 1; m <= 12; m++) {
    const data = monthDataMap.get(m) ?? [];
    const rets = data.map(d => d.ret);
    const avg  = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
    const wins = rets.filter(r => r > 0).length;
    const best  = data.reduce((a, b) => (b.ret > a.ret ? b : a), data[0] ?? { year: 0, ret: 0 });
    const worst = data.reduce((a, b) => (b.ret < a.ret ? b : a), data[0] ?? { year: 0, ret: 0 });
    months.push({
      month: m,
      nameEn: MONTHS_EN[m - 1],
      nameTh: MONTHS_TH[m - 1],
      avgReturn: +avg.toFixed(3),
      medReturn: +median(rets).toFixed(3),
      winRate:   rets.length ? +((wins / rets.length) * 100).toFixed(1) : 0,
      count: rets.length,
      best:  { year: best.year,  ret: +best.ret.toFixed(2)  },
      worst: { year: worst.year, ret: +worst.ret.toFixed(2) },
      returns: data.map(d => ({ year: d.year, ret: +d.ret.toFixed(2) })),
    });
  }

  // ── Day-of-week statistics ─────────────────────────────────────────────────

  const dayDataMap = new Map<number, number[]>(); // 1=Mon…5=Fri (JS getDay 1-5)
  for (let i = 1; i < bars.length; i++) {
    const d   = new Date(bars[i].ts);
    const dow = d.getDay(); // 0=Sun,6=Sat
    if (dow === 0 || dow === 6) continue;
    const prev = bars[i - 1];
    const ret  = ((bars[i].close - prev.close) / prev.close) * 100;
    if (!dayDataMap.has(dow)) dayDataMap.set(dow, []);
    dayDataMap.get(dow)!.push(ret);
  }

  const days: DayStat[] = [1, 2, 3, 4, 5].map((dow, i) => {
    const rets = dayDataMap.get(dow) ?? [];
    const avg  = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
    const wins = rets.filter(r => r > 0).length;
    return {
      day: i,
      nameEn: DAYS_EN[i],
      nameTh: DAYS_TH[i],
      avgReturn: +avg.toFixed(4),
      winRate:   rets.length ? +((wins / rets.length) * 100).toFixed(1) : 0,
      count: rets.length,
    };
  });

  // ── Annual statistics ──────────────────────────────────────────────────────

  const byYear = new Map<number, { open: number; close: number }>();
  for (const [key, barsInMonth] of byYM) {
    const year = parseInt(key.split("-")[0], 10);
    const cur  = byYear.get(year);
    if (!cur) {
      byYear.set(year, { open: barsInMonth[0].close, close: barsInMonth[barsInMonth.length - 1].close });
    } else {
      cur.close = barsInMonth[barsInMonth.length - 1].close;
    }
  }

  const years: YearStat[] = Array.from(byYear.entries())
    .filter(([y]) => y < now.getFullYear()) // exclude current year (incomplete)
    .sort(([a], [b]) => a - b)
    .map(([year, { open, close }]) => ({
      year,
      ret: +( ((close - open) / open) * 100 ).toFixed(2),
      startPrice: +open.toFixed(2),
      endPrice:   +close.toFixed(2),
    }));

  return {
    months,
    days,
    years,
    currentMonth: now.getMonth() + 1,
    currentYear:  now.getFullYear(),
    dataFrom: new Date(bars[0].ts).toISOString().slice(0, 10),
    dataTo:   new Date(bars[bars.length - 1].ts).toISOString().slice(0, 10),
    totalBars: bars.length,
    price: +price.toFixed(2),
    timestamp: now.toISOString(),
  };
}
