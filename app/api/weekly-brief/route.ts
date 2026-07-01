import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface WeeklyBriefSection {
  title: string;
  titleTh: string;
  content: string;
  contentTh: string;
  icon: string;
}

export interface WeeklyBriefPayload {
  weekLabel: string;        // e.g. "Week 27, 2025"
  weekLabelTh: string;
  goldPrice: number;
  goldWeekReturn: number;
  goldMonthReturn: number;
  sections: WeeklyBriefSection[];
  tradingBias: "bullish" | "bearish" | "neutral";
  tradingBiasTh: string;
  biasColor: string;
  keyLevels: { label: string; labelTh: string; price: number; color: string }[];
  watchlist: string[];
  watchlistTh: string[];
  generatedAt: string;
}

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

async function safeJson(symbol: string, range: string, interval: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

let CACHE: { data: WeeklyBriefPayload; ts: number } | null = null;
const TTL = 3 * 60 * 60 * 1000; // 3h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldJ, dxyJ, spxJ, tltJ] = await Promise.all([
      safeJson("GC%3DF",  "60d", "1d"),
      safeJson("DX-Y.NYB","30d", "1d"),
      safeJson("%5EGSPC", "30d", "1d"),
      safeJson("TLT",     "30d", "1d"),
    ]);

    function getCloses(j: unknown): number[] {
      const obj = j as { chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } } | null;
      return (obj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
    }

    const goldCloses = getCloses(goldJ);
    const dxyCloses  = getCloses(dxyJ);
    const spxCloses  = getCloses(spxJ);
    const tltCloses  = getCloses(tltJ);

    const goldPrice   = (goldJ as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } } | null)?.chart?.result?.[0]?.meta?.regularMarketPrice ?? goldCloses.at(-1) ?? 3200;
    const goldW  = goldCloses.length >= 6  ? ((goldCloses.at(-1)! - goldCloses.at(-6)!)  / goldCloses.at(-6)!  * 100) : 0;
    const goldM  = goldCloses.length >= 22 ? ((goldCloses.at(-1)! - goldCloses.at(-22)!) / goldCloses.at(-22)! * 100) : 0;
    const dxy    = dxyCloses.at(-1) ?? 104;
    const dxyW   = dxyCloses.length >= 6  ? ((dxy - dxyCloses.at(-6)!)  / dxyCloses.at(-6)!  * 100) : 0;
    const spxW   = spxCloses.length >= 6  ? ((spxCloses.at(-1)! - spxCloses.at(-6)!)  / spxCloses.at(-6)!  * 100) : 0;
    const tltW   = tltCloses.length >= 6  ? ((tltCloses.at(-1)! - tltCloses.at(-6)!)  / tltCloses.at(-6)!  * 100) : 0;

    const now   = new Date();
    const week  = getISOWeek(now);
    const year  = now.getFullYear();
    const weekLabel   = `Week ${week}, ${year}`;
    const weekLabelTh = `สัปดาห์ที่ ${week} ปี ${year}`;

    const tradingBias: WeeklyBriefPayload["tradingBias"] = goldW > 1 ? "bullish" : goldW < -1 ? "bearish" : "neutral";
    const tradingBiasTh = tradingBias === "bullish" ? "Bullish — ทองปิดสัปดาห์เป็นบวก" : tradingBias === "bearish" ? "Bearish — ทองปิดสัปดาห์เป็นลบ" : "Neutral — ทองเคลื่อนที่ราบ";
    const biasColor = tradingBias === "bullish" ? "#34d399" : tradingBias === "bearish" ? "#f87171" : "#f5c451";

    // Simple pivot-style key levels from the week's range
    const high5d = goldCloses.length >= 5 ? Math.max(...goldCloses.slice(-5)) : goldPrice * 1.01;
    const low5d  = goldCloses.length >= 5 ? Math.min(...goldCloses.slice(-5)) : goldPrice * 0.99;

    const keyLevels = [
      { label: "Weekly High",    labelTh: "High สัปดาห์นี้", price: +high5d.toFixed(0), color: "#f87171" },
      { label: "Current",        labelTh: "ราคาปัจจุบัน",    price: +goldPrice.toFixed(0), color: "#f5c451" },
      { label: "Weekly Low",     labelTh: "Low สัปดาห์นี้",  price: +low5d.toFixed(0),  color: "#34d399" },
      { label: "Weekly Midpoint",labelTh: "จุดกึ่งกลาง",     price: +((high5d + low5d) / 2).toFixed(0), color: "#c084fc" },
    ].sort((a, b) => b.price - a.price);

    const sections: WeeklyBriefSection[] = [
      {
        title: "Gold Performance", titleTh: "ผลการดำเนินงานของทอง",
        icon: "🪙",
        content: `Gold (XAUUSD) moved ${goldW > 0 ? "+" : ""}${goldW.toFixed(2)}% this week, trading at $${goldPrice.toFixed(0)}. Monthly performance: ${goldM > 0 ? "+" : ""}${goldM.toFixed(2)}%. Weekly range: $${low5d.toFixed(0)} – $${high5d.toFixed(0)}.`,
        contentTh: `ทอง (XAUUSD) เคลื่อนที่ ${goldW > 0 ? "+" : ""}${goldW.toFixed(2)}% สัปดาห์นี้ ราคา $${goldPrice.toFixed(0)} ผลตอบแทน 1 เดือน: ${goldM > 0 ? "+" : ""}${goldM.toFixed(2)}% กรอบสัปดาห์: $${low5d.toFixed(0)} – $${high5d.toFixed(0)}`,
      },
      {
        title: "USD & DXY Impact", titleTh: "ผลกระทบจาก USD / DXY",
        icon: "💵",
        content: `DXY ${dxyW > 0 ? "strengthened" : "weakened"} ${Math.abs(dxyW).toFixed(2)}% this week (now ${dxy.toFixed(2)}). ${dxyW < -0.5 ? "USD weakness provided a tailwind for gold." : dxyW > 0.5 ? "USD strength created headwinds for gold." : "USD moved sideways — neutral impact on gold."}`,
        contentTh: `DXY ${dxyW > 0 ? "แข็งค่า" : "อ่อนค่า"} ${Math.abs(dxyW).toFixed(2)}% (ปัจจุบัน ${dxy.toFixed(2)}) ${dxyW < -0.5 ? "USD อ่อน — เป็นแรงหนุนให้ทองขึ้น" : dxyW > 0.5 ? "USD แข็ง — กดดันทองอยู่" : "USD ทรงตัว — ผลกระทบเป็นกลาง"}`,
      },
      {
        title: "Equity & Risk Sentiment", titleTh: "หุ้นและ Risk Sentiment",
        icon: "📈",
        content: `S&P 500 ${spxW > 0 ? "gained" : "fell"} ${Math.abs(spxW).toFixed(2)}% this week. Bond market (TLT) ${tltW > 0 ? "rallied" : "sold off"} ${Math.abs(tltW).toFixed(2)}%. ${spxW > 1 && tltW < 0 ? "Risk-on environment — gold may lag." : spxW < -1 ? "Risk-off — flight to safety supports gold." : "Mixed signals from equities and bonds."}`,
        contentTh: `S&P 500 ${spxW > 0 ? "ขึ้น" : "ลง"} ${Math.abs(spxW).toFixed(2)}% สัปดาห์นี้ พันธบัตร (TLT) ${tltW > 0 ? "ขึ้น" : "ลง"} ${Math.abs(tltW).toFixed(2)}% ${spxW > 1 && tltW < 0 ? "Risk-on — ทองอาจ underperform หุ้น" : spxW < -1 ? "Risk-off — ทองได้แรงสนับสนุน safe-haven" : "สัญญาณหุ้นและพันธบัตรผสมกัน"}`,
      },
      {
        title: "Next Week Outlook", titleTh: "มุมมองสัปดาห์หน้า",
        icon: "🔭",
        content: `${tradingBias === "bullish" ? "Bias remains constructive. Watch for pullbacks toward weekly low as buying opportunities." : tradingBias === "bearish" ? "Bearish pressure. Monitor key support levels; break below could extend losses." : "Neutral range-bound action. Trade the range between weekly high and low."} Key watch: DXY direction, US economic data, geopolitical headlines.`,
        contentTh: `${tradingBias === "bullish" ? "Bias ยังเป็นบวก รอ pullback มาทดสอบ Low สัปดาห์เป็นจุดซื้อ" : tradingBias === "bearish" ? "แรงกดดัน Bearish อยู่ จับตา Support หลัก หากแตกลงอาจลงต่อ" : "ทองอยู่ในกรอบ Neutral เทรดระหว่าง High-Low สัปดาห์"} จับตา: ทิศทาง DXY, ข้อมูลเศรษฐกิจสหรัฐ, ข่าวภูมิรัฐศาสตร์`,
      },
    ];

    const watchlist = [
      "US Non-Farm Payrolls (if this week)",
      "Federal Reserve speakers / FOMC minutes",
      "USD/JPY direction (proxy for risk appetite)",
      "Crude Oil (CL=F) — commodity correlation",
      "US CPI data (if scheduled)",
    ];
    const watchlistTh = [
      "Non-Farm Payrolls สหรัฐ (ถ้าอยู่ในสัปดาห์นี้)",
      "คำพูดกรรมการ Fed / รายงาน FOMC",
      "USD/JPY — proxy ความเสี่ยงตลาด",
      "น้ำมันดิบ (CL=F) — correlation สินค้าโภคภัณฑ์",
      "ตัวเลข CPI สหรัฐ (ถ้ามีกำหนดออก)",
    ];

    const data: WeeklyBriefPayload = {
      weekLabel, weekLabelTh, goldPrice: +goldPrice.toFixed(0),
      goldWeekReturn: +goldW.toFixed(2), goldMonthReturn: +goldM.toFixed(2),
      sections, tradingBias, tradingBiasTh, biasColor,
      keyLevels, watchlist, watchlistTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
