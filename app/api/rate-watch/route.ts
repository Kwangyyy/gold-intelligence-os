import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface CBRateEntry {
  bank: string;
  bankTh: string;
  flag: string;
  currency: string;
  currentRate: number;    // current rate in %
  previousRate: number;   // rate at last meeting
  change: number;         // basis points change
  cycleStatus: "hiking" | "holding" | "cutting" | "emergency_cut";
  cycleStatusTh: string;
  cycleColor: string;
  nextMeeting: string;    // ISO date string
  nextMeetingLabel: string;
  lastActionDate: string;
  lastActionBps: number;  // + = hike, - = cut
  goldImplication: "bullish" | "neutral" | "bearish";
  goldImplicationTh: string;
}

export interface RateWatchPayload {
  goldPrice: number;
  yield10y: number;
  yield2y: number;
  realRate: number;       // 10Y - CPI proxy
  yieldCurve: "normal" | "inverted" | "flat";
  rateEnvironment: "dovish" | "neutral" | "hawkish";
  rateEnvironmentTh: string;
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  entries: CBRateEntry[];
  daysToNextFomc: number;
  nextFomcDate: string;
  historicalNote: string;
  generatedAt: string;
}

// Static CB data — updated as of mid-2026
const CB_RATES: CBRateEntry[] = [
  {
    bank: "Federal Reserve", bankTh: "ธนาคารกลางสหรัฐ (Fed)", flag: "🇺🇸", currency: "USD",
    currentRate: 4.375, previousRate: 4.625, change: -25,
    cycleStatus: "cutting", cycleStatusTh: "กำลังลดดอกเบี้ย", cycleColor: "#34d399",
    nextMeeting: "2026-07-29", nextMeetingLabel: "Jul 29-30, 2026",
    lastActionDate: "2026-03-19", lastActionBps: -25,
    goldImplication: "bullish",
    goldImplicationTh: "Bullish — Fed cutting cycle หนุน real yield ต่ำ",
  },
  {
    bank: "European Central Bank", bankTh: "ธนาคารกลางยุโรป (ECB)", flag: "🇪🇺", currency: "EUR",
    currentRate: 2.15, previousRate: 2.40, change: -25,
    cycleStatus: "cutting", cycleStatusTh: "กำลังลดดอกเบี้ย", cycleColor: "#34d399",
    nextMeeting: "2026-07-24", nextMeetingLabel: "Jul 24, 2026",
    lastActionDate: "2026-06-05", lastActionBps: -25,
    goldImplication: "bullish",
    goldImplicationTh: "Bullish — ECB ลดดอกเบี้ยต่อเนื่อง ช่วยทอง",
  },
  {
    bank: "Bank of Japan", bankTh: "ธนาคารกลางญี่ปุ่น (BOJ)", flag: "🇯🇵", currency: "JPY",
    currentRate: 0.50, previousRate: 0.25, change: +25,
    cycleStatus: "hiking", cycleStatusTh: "กำลังขึ้นดอกเบี้ย", cycleColor: "#f97316",
    nextMeeting: "2026-07-28", nextMeetingLabel: "Jul 28-29, 2026",
    lastActionDate: "2026-03-18", lastActionBps: +25,
    goldImplication: "neutral",
    goldImplicationTh: "Neutral — BOJ hiking อ่อนๆ แต่ rate ยังต่ำมาก",
  },
  {
    bank: "Bank of England", bankTh: "ธนาคารกลางอังกฤษ (BOE)", flag: "🇬🇧", currency: "GBP",
    currentRate: 4.00, previousRate: 4.25, change: -25,
    cycleStatus: "cutting", cycleStatusTh: "กำลังลดดอกเบี้ย", cycleColor: "#34d399",
    nextMeeting: "2026-08-06", nextMeetingLabel: "Aug 6-7, 2026",
    lastActionDate: "2026-05-08", lastActionBps: -25,
    goldImplication: "bullish",
    goldImplicationTh: "Bullish — BOE cutting cycle หนุน gold safe haven",
  },
  {
    bank: "Reserve Bank of Australia", bankTh: "ธนาคารกลางออสเตรเลีย (RBA)", flag: "🇦🇺", currency: "AUD",
    currentRate: 3.85, previousRate: 4.10, change: -25,
    cycleStatus: "cutting", cycleStatusTh: "กำลังลดดอกเบี้ย", cycleColor: "#34d399",
    nextMeeting: "2026-08-04", nextMeetingLabel: "Aug 4-5, 2026",
    lastActionDate: "2026-05-20", lastActionBps: -25,
    goldImplication: "bullish",
    goldImplicationTh: "Bullish — Global cutting cycle กว้างขึ้น ดีต่อทอง",
  },
  {
    bank: "People's Bank of China", bankTh: "ธนาคารกลางจีน (PBOC)", flag: "🇨🇳", currency: "CNY",
    currentRate: 3.00, previousRate: 3.10, change: -10,
    cycleStatus: "cutting", cycleStatusTh: "กำลังลดดอกเบี้ย", cycleColor: "#34d399",
    nextMeeting: "2026-08-20", nextMeetingLabel: "ปลาย ส.ค. 2026",
    lastActionDate: "2026-04-07", lastActionBps: -10,
    goldImplication: "bullish",
    goldImplicationTh: "Bullish — PBOC ลดดอกเบี้ย สนับสนุน demand ทองจีน",
  },
];

type YJ = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };

async function yFetch(sym: string): Promise<number> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
    );
    const j = await r.json() as YJ;
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
  } catch { return 0; }
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  const now    = Date.now();
  return Math.max(0, Math.round((target - now) / 86_400_000));
}

let CACHE: { data: RateWatchPayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldPrice, yield10y, yield2y] = await Promise.all([
      yFetch("GC=F"),
      yFetch("^TNX"),
      yFetch("^IRX"), // 3M as proxy since 2Y not available
    ]);

    const y10 = yield10y || 4.3;
    const y2  = yield2y  || 4.1;
    // CPI proxy: Fed target 2% + some premium
    const cipiProxy = 2.5;
    const realRate = parseFloat((y10 - cipiProxy).toFixed(2));

    const spread = y10 - y2;
    const yieldCurve: RateWatchPayload["yieldCurve"] =
      spread > 0.3 ? "normal" : spread < -0.1 ? "inverted" : "flat";

    // Count cutting vs hiking CBs
    const cuttingCount = CB_RATES.filter(e => e.cycleStatus === "cutting").length;
    const hikingCount  = CB_RATES.filter(e => e.cycleStatus === "hiking").length;
    const rateEnvironment: RateWatchPayload["rateEnvironment"] =
      cuttingCount >= 4 ? "dovish" : hikingCount >= 3 ? "hawkish" : "neutral";

    const goldBias: RateWatchPayload["goldBias"] =
      rateEnvironment === "dovish" || realRate < 0.5 ? "bullish"
      : rateEnvironment === "hawkish" && realRate > 2.5 ? "bearish"
      : "neutral";

    // Find next FOMC
    const fomc = CB_RATES.find(e => e.bank === "Federal Reserve");
    const nextFomcDate = fomc?.nextMeeting ?? "2026-07-29";

    const histNote = realRate < 0
      ? "Real yield ติดลบ — สถานการณ์แบบนี้ทองมักทำ all-time high"
      : realRate < 1
      ? "Real yield ต่ำ — เอื้อต่อการถือทอง (opportunity cost ต่ำ)"
      : realRate < 2
      ? "Real yield ปกติ — ทองแข่งขันได้กับ fixed income"
      : "Real yield สูง — fixed income ดึงดูดกว่าทอง";

    const data: RateWatchPayload = {
      goldPrice: Math.round(goldPrice || 3200),
      yield10y: parseFloat(y10.toFixed(2)),
      yield2y: parseFloat(y2.toFixed(2)),
      realRate,
      yieldCurve,
      rateEnvironment,
      rateEnvironmentTh: rateEnvironment === "dovish"
        ? "Dovish — ธนาคารกลางส่วนใหญ่ลดดอกเบี้ย"
        : rateEnvironment === "hawkish"
        ? "Hawkish — ธนาคารกลางส่วนใหญ่ขึ้นดอกเบี้ย"
        : "Neutral — ผสมกัน",
      goldBias,
      goldBiasTh: goldBias === "bullish"
        ? "Bullish — Global dovish cycle + real yield ต่ำ หนุนทอง"
        : goldBias === "bearish"
        ? "Bearish — Real yield สูง กดดันทอง"
        : "Neutral — Rate environment ไม่ชัดเจน",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      entries: CB_RATES,
      daysToNextFomc: daysUntil(nextFomcDate),
      nextFomcDate: fomc?.nextMeetingLabel ?? "Jul 29-30, 2026",
      historicalNote: histNote,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
