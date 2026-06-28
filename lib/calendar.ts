import type { Bilingual } from "./types";

export type CalendarImpact = "High" | "Medium" | "Low";
export type GoldRelevance = "high" | "medium" | "low";

export interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  date: string; // ISO datetime string
  impact: CalendarImpact;
  forecast?: string;
  previous?: string;
  actual?: string;
  goldRelevance: GoldRelevance;
  minutesUntil: number; // negative = past
  isPast: boolean;
  aiAnalysis?: Bilingual;
}

export interface CalendarPayload {
  thisWeek: CalendarEvent[];
  nextWeek: CalendarEvent[];
  nextEvent: CalendarEvent | null; // nearest upcoming high-impact USD event
  source: string;
}

const HIGH_GOLD = ["CPI", "PCE", "FOMC", "FED", "INTEREST RATE", "NON-FARM", "NFP", "PAYROLL", "INFLATION", "UNEMPLOYMENT RATE"];
const MED_GOLD = ["PPI", "RETAIL SALES", "ISM", "PMI", "GDP", "JOBS", "JOBLESS", "CONSUMER CONFIDENCE", "DURABLE GOODS", "HOUSING"];

export function scoreGoldRelevance(title: string, country: string, impact: CalendarImpact): GoldRelevance {
  const t = title.toUpperCase();
  const isUSD = country === "USD";
  if (isUSD && HIGH_GOLD.some((k) => t.includes(k))) return "high";
  if (isUSD && (impact === "High" || MED_GOLD.some((k) => t.includes(k)))) return "medium";
  if (!isUSD && impact === "High") return "medium";
  return "low";
}

export function minutesUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 60_000);
}

interface FFRaw {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string | null;
  previous?: string | null;
  actual?: string | null;
}

export function mapFF(e: FFRaw): CalendarEvent {
  const impact: CalendarImpact =
    e.impact === "High" || e.impact === "Medium" || e.impact === "Low"
      ? (e.impact as CalendarImpact)
      : "Low";
  const mins = minutesUntil(e.date);
  const id = `${e.country}-${e.title}-${e.date}`.replace(/[\s:]/g, "_");
  return {
    id,
    title: e.title,
    country: e.country,
    date: e.date,
    impact,
    forecast: e.forecast ?? undefined,
    previous: e.previous ?? undefined,
    actual: e.actual ?? undefined,
    goldRelevance: scoreGoldRelevance(e.title, e.country, impact),
    minutesUntil: mins,
    isPast: mins < -60,
  };
}

// Returns Monday (local) of the given date at 00:00 UTC.
function monday(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setUTCDate(d.getUTCDate() + diff);
  m.setUTCHours(8, 30, 0, 0); // 08:30 UTC default time for events
  return m;
}

// Generates a realistic weekly USD calendar for the given Monday.
export function fallbackWeekEvents(weekStart: Date): CalendarEvent[] {
  const ms = weekStart.getTime();
  const day = (n: number, h: number, min = 30) =>
    new Date(ms + n * 86_400_000 + (h * 60 + min) * 60_000).toISOString();

  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const isFirstWeek = dayOfMonth <= 7;
  const isMidMonth = dayOfMonth >= 10 && dayOfMonth <= 17;

  const raw: FFRaw[] = [
    // Monday
    { title: "S&P Global Manufacturing PMI", country: "USD", date: day(0, 14, 45), impact: "Medium", forecast: "49.5", previous: "48.7" },
    { title: "ISM Manufacturing PMI", country: "USD", date: day(0, 15, 0), impact: "High", forecast: "49.8", previous: "48.9" },
    // Tuesday
    { title: "JOLTS Job Openings", country: "USD", date: day(1, 15, 0), impact: "Medium", forecast: "7.80M", previous: "7.92M" },
    { title: "Consumer Confidence", country: "USD", date: day(1, 15, 0), impact: "Medium", forecast: "98.5", previous: "97.0" },
    // Wednesday
    ...(isMidMonth
      ? [{ title: "CPI m/m", country: "USD", date: day(2, 13, 30), impact: "High" as const, forecast: "0.3%", previous: "0.2%" },
         { title: "CPI y/y", country: "USD", date: day(2, 13, 30), impact: "High" as const, forecast: "3.1%", previous: "3.0%" },
         { title: "Core CPI m/m", country: "USD", date: day(2, 13, 30), impact: "High" as const, forecast: "0.3%", previous: "0.3%" }]
      : [{ title: "ADP Non-Farm Employment Change", country: "USD", date: day(2, 13, 15), impact: "Medium" as const, forecast: "150K", previous: "152K" },
         { title: "ISM Services PMI", country: "USD", date: day(2, 15, 0), impact: "High" as const, forecast: "50.5", previous: "49.9" }]),
    // Thursday
    { title: "Initial Jobless Claims", country: "USD", date: day(3, 13, 30), impact: "Medium", forecast: "215K", previous: "210K" },
    { title: "Continuing Jobless Claims", country: "USD", date: day(3, 13, 30), impact: "Low", forecast: "1.78M", previous: "1.76M" },
    // Friday
    ...(isFirstWeek
      ? [{ title: "Non-Farm Payrolls", country: "USD", date: day(4, 13, 30), impact: "High" as const, forecast: "185K", previous: "200K" },
         { title: "Unemployment Rate", country: "USD", date: day(4, 13, 30), impact: "High" as const, forecast: "4.2%", previous: "4.1%" },
         { title: "Average Hourly Earnings m/m", country: "USD", date: day(4, 13, 30), impact: "High" as const, forecast: "0.3%", previous: "0.4%" }]
      : [{ title: "PPI m/m", country: "USD", date: day(4, 13, 30), impact: "Medium" as const, forecast: "0.2%", previous: "0.5%" },
         { title: "Michigan Consumer Sentiment", country: "USD", date: day(4, 15, 0), impact: "Medium" as const, forecast: "67.5", previous: "65.6" }]),
  ];

  return raw.map(mapFF);
}

export function buildFallback(weekOffset: 0 | 1 = 0): CalendarEvent[] {
  const now = new Date();
  const base = monday(now);
  if (weekOffset === 1) base.setUTCDate(base.getUTCDate() + 7);
  return fallbackWeekEvents(base);
}
