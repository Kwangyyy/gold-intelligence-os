import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface MinerEntry {
  ticker: string;
  name: string;
  nameTh: string;
  flag: string;
  aisc: number;          // All-In Sustaining Cost $/oz
  aiscType: "major" | "mid" | "royalty";
  margin: number;        // goldPrice - aisc (set at runtime)
  marginPct: number;     // margin / goldPrice * 100
  marginLabel: "excellent" | "good" | "moderate" | "tight" | "underwater";
  marginColor: string;
  dataSource: string;    // "Q4 2024", "H2 2024" etc
  note: string;
}

export interface MiningCostPayload {
  goldPrice: number;
  industryAvgAisc: number;
  industryMargin: number;
  industryMarginPct: number;
  priceFloor: number;        // 90th percentile AISC = support level
  lowestCostProducer: string;
  lowestAisc: number;
  breakEvenCount: number;    // miners near breakeven (<10% margin)
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  miners: MinerEntry[];
  generatedAt: string;
}

// AISC data — sourced from company earnings, H2 2024 / FY 2024
const MINER_BASE: Omit<MinerEntry, "margin" | "marginPct" | "marginLabel" | "marginColor">[] = [
  {
    ticker: "NEM",  name: "Newmont Corp",       nameTh: "Newmont (ใหญ่สุดในโลก)", flag: "🇺🇸",
    aisc: 1611, aiscType: "major", dataSource: "FY 2024",
    note: "บริษัทขุดทองใหญ่สุดในโลก หลังซื้อ Newcrest",
  },
  {
    ticker: "GOLD", name: "Barrick Gold",        nameTh: "Barrick Gold",            flag: "🇨🇦",
    aisc: 1389, aiscType: "major", dataSource: "FY 2024",
    note: "อันดับ 2 โลก มีเหมืองใน Africa + Americas",
  },
  {
    ticker: "AEM",  name: "Agnico Eagle",        nameTh: "Agnico Eagle (ต้นทุนต่ำ)", flag: "🇨🇦",
    aisc: 1234, aiscType: "major", dataSource: "FY 2024",
    note: "ต้นทุนต่ำที่สุดในกลุ่ม major — margin สูงมาก",
  },
  {
    ticker: "KGC",  name: "Kinross Gold",        nameTh: "Kinross Gold",            flag: "🇨🇦",
    aisc: 1360, aiscType: "mid",   dataSource: "H2 2024",
    note: "Mid-tier miner มีเหมืองใน Americas + Africa",
  },
  {
    ticker: "AU",   name: "AngloGold Ashanti",   nameTh: "AngloGold Ashanti",       flag: "🇿🇦",
    aisc: 1514, aiscType: "major", dataSource: "H2 2024",
    note: "Major African producer, เพิ่งซื้อ Centamin",
  },
  {
    ticker: "FNV",  name: "Franco-Nevada",       nameTh: "Franco-Nevada (Royalty)", flag: "🇨🇦",
    aisc: 0, aiscType: "royalty", dataSource: "N/A",
    note: "Royalty model — ไม่มี AISC, รับ % จากผลผลิตเหมืองอื่น",
  },
  {
    ticker: "WPM",  name: "Wheaton Precious",    nameTh: "Wheaton Precious (Royalty)", flag: "🇨🇦",
    aisc: 0, aiscType: "royalty", dataSource: "N/A",
    note: "Streaming model — ซื้อทองล่วงหน้าจากเหมืองอื่น",
  },
  {
    ticker: "GDX",  name: "VanEck Gold Miners",  nameTh: "GDX (กลุ่ม Major Miners)", flag: "🇺🇸",
    aisc: 1410, aiscType: "major", dataSource: "Weighted avg FY2024",
    note: "ETF ครอบคลุม major gold miners — AISC เป็น weighted avg",
  },
  {
    ticker: "GDXJ", name: "Junior Gold Miners",  nameTh: "GDXJ (Mid/Junior Miners)", flag: "🇺🇸",
    aisc: 1580, aiscType: "mid",   dataSource: "Weighted avg FY2024",
    note: "Mid/Junior miners — ต้นทุนสูงกว่า major อาจมี leverage มากกว่า",
  },
];

function classifyMargin(marginPct: number): Pick<MinerEntry, "marginLabel" | "marginColor"> {
  if (marginPct > 60) return { marginLabel: "excellent", marginColor: "#34d399" };
  if (marginPct > 40) return { marginLabel: "good",      marginColor: "#86efac" };
  if (marginPct > 20) return { marginLabel: "moderate",  marginColor: "#f5c451" };
  if (marginPct > 5)  return { marginLabel: "tight",     marginColor: "#f97316" };
  return               { marginLabel: "underwater",      marginColor: "#f87171" };
}

type YJ = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };

async function fetchGold(): Promise<number> {
  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2d&interval=1d",
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
    );
    const j = await r.json() as YJ;
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3200;
  } catch { return 3200; }
}

let CACHE: { data: MiningCostPayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h (AISC is quarterly, only gold price changes)

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const goldPrice = await fetchGold();

    const activeMiners = MINER_BASE.filter(m => m.aiscType !== "royalty" && m.aisc > 0);
    const industryAvgAisc = Math.round(
      activeMiners.reduce((s, m) => s + m.aisc, 0) / activeMiners.length
    );

    // 90th percentile = price floor (high-cost miners need this to survive)
    const sorted = [...activeMiners].sort((a, b) => b.aisc - a.aisc);
    const p90Idx = Math.floor(sorted.length * 0.1);
    const priceFloor = sorted[p90Idx]?.aisc ?? industryAvgAisc;

    const industryMargin = Math.round(goldPrice - industryAvgAisc);
    const industryMarginPct = parseFloat(((industryMargin / goldPrice) * 100).toFixed(1));

    const lowestCostMiner = [...activeMiners].sort((a, b) => a.aisc - b.aisc)[0];
    const breakEvenCount = activeMiners.filter(m => {
      const pct = ((goldPrice - m.aisc) / goldPrice) * 100;
      return pct < 10;
    }).length;

    const miners: MinerEntry[] = MINER_BASE.map(m => {
      if (m.aiscType === "royalty" || m.aisc === 0) {
        return {
          ...m,
          margin: 0, marginPct: 0,
          marginLabel: "excellent" as const,
          marginColor: "#34d399",
        };
      }
      const margin    = Math.round(goldPrice - m.aisc);
      const marginPct = parseFloat(((margin / goldPrice) * 100).toFixed(1));
      return { ...m, margin, marginPct, ...classifyMargin(marginPct) };
    });

    // Gold bias: high margins = more supply coming = neutral to bearish long-term
    // but short-term high margins = miners will invest more = bullish fundamentals
    const goldBias: MiningCostPayload["goldBias"] =
      industryMarginPct > 60 ? "neutral"       // margins so high more supply will come
      : industryMarginPct > 30 ? "neutral"
      : industryMarginPct > 10 ? "bullish"     // tight margins = supply at risk
      : "bullish";                             // underwater = supply cuts = very bullish

    const data: MiningCostPayload = {
      goldPrice: Math.round(goldPrice),
      industryAvgAisc,
      industryMargin,
      industryMarginPct,
      priceFloor,
      lowestCostProducer: lowestCostMiner?.nameTh ?? "",
      lowestAisc: lowestCostMiner?.aisc ?? 0,
      breakEvenCount,
      goldBias,
      goldBiasTh: goldBias === "bullish"
        ? "Bullish — margin แคบ ส่งสัญญาณ supply จะลด"
        : "Neutral — margin สบาย ผู้ผลิตยังทำกำไรได้ดี",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : "#9ca3af",
      miners,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
