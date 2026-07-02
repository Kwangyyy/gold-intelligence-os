import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface DemandSector {
  sector: string;
  sectorTh: string;
  tonnes: number;           // quarterly tonnes (Q1 2026 estimate)
  yoyChangePct: number;
  sharePct: number;         // % of total demand
  color: string;
  goldImpact: "bullish" | "neutral" | "bearish";
  note: string;
}

export interface RegionalEntry {
  region: string;
  regionTh: string;
  tonnes: number;
  yoyChangePct: number;
  type: "consumer" | "central_bank" | "etf";
}

export interface GoldDemandPayload {
  totalTonnes: number;         // Q1 2026 total
  yoyChangePct: number;        // vs Q1 2025
  demandBias: "bullish" | "neutral" | "bearish";
  demandBiasColor: string;
  demandBiasTh: string;
  demandScore: number;         // 0-100 demand strength
  sectors: DemandSector[];
  regional: RegionalEntry[];
  goldPrice: number;
  impliedAnnualDemand: number; // quarterly × 4
  generatedAt: string;
}

// World Gold Council Q1 2026 estimates (tonnes)
const SECTORS: Omit<DemandSector, "sharePct">[] = [
  {
    sector: "Jewellery",
    sectorTh: "เครื่องประดับ",
    tonnes: 478,
    yoyChangePct: -3.2,
    color: "#f5c451",
    goldImpact: "neutral",
    note: "จีน-อินเดียอ่อนตัวจากราคาสูง; ยุโรปทรงตัว",
  },
  {
    sector: "Investment (Bar & Coin)",
    sectorTh: "บาร์และเหรียญ",
    tonnes: 312,
    yoyChangePct: 14.8,
    color: "#34d399",
    goldImpact: "bullish",
    note: "ความต้องการป้องกันความเสี่ยงสูง; ตะวันออกกลางแข็งแกร่ง",
  },
  {
    sector: "Gold ETFs",
    sectorTh: "Gold ETFs",
    tonnes: 186,
    yoyChangePct: 32.4,
    color: "#818cf8",
    goldImpact: "bullish",
    note: "ไหลเข้า ETF ต่อเนื่อง; ยุโรปนำ, สหรัฐฯ ฟื้นตัว",
  },
  {
    sector: "Central Banks",
    sectorTh: "ธนาคารกลาง",
    tonnes: 228,
    yoyChangePct: 8.1,
    color: "#c084fc",
    goldImpact: "bullish",
    note: "EM ยังซื้อต่อเนื่อง; โปแลนด์, จีน, อินเดียนำ",
  },
  {
    sector: "Technology",
    sectorTh: "อุตสาหกรรม",
    tonnes: 82,
    yoyChangePct: 6.7,
    color: "#38bdf8",
    goldImpact: "neutral",
    note: "AI/semiconductor ดันความต้องการทองอุตสาหกรรม",
  },
];

const REGIONAL: RegionalEntry[] = [
  { region: "China",        regionTh: "จีน",         tonnes: 198, yoyChangePct: -5.1, type: "consumer"      },
  { region: "India",        regionTh: "อินเดีย",     tonnes: 163, yoyChangePct: +2.4, type: "consumer"      },
  { region: "USA",          regionTh: "สหรัฐอเมริกา", tonnes: 98, yoyChangePct: +28.3, type: "consumer"     },
  { region: "Europe",       regionTh: "ยุโรป",       tonnes: 112, yoyChangePct: +19.6, type: "consumer"     },
  { region: "Middle East",  regionTh: "ตะวันออกกลาง", tonnes: 87, yoyChangePct: +11.2, type: "consumer"     },
  { region: "Central Banks",regionTh: "ธนาคารกลาง",  tonnes: 228, yoyChangePct: +8.1,  type: "central_bank" },
  { region: "ETF (Global)", regionTh: "ETF ทั่วโลก", tonnes: 186, yoyChangePct: +32.4, type: "etf"          },
];

let CACHE: { data: GoldDemandPayload; ts: number } | null = null;
const TTL = 4 * 60 * 60 * 1000; // 4h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    let goldPrice = 3200;
    try {
      const r  = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      );
      const j  = await r.json();
      goldPrice = j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? goldPrice;
    } catch { /* keep fallback */ }

    const totalTonnes = SECTORS.reduce((s, e) => s + e.tonnes, 0);
    const sectors: DemandSector[] = SECTORS.map(s => ({
      ...s,
      sharePct: parseFloat(((s.tonnes / totalTonnes) * 100).toFixed(1)),
    }));

    // Weighted YoY: bigger sectors matter more
    const yoyChangePct = parseFloat(
      (SECTORS.reduce((s, e) => s + e.yoyChangePct * e.tonnes, 0) / totalTonnes).toFixed(1)
    );

    // Demand score: bullish sectors (ETF, CB, bar/coin) drive score
    const bullishTonnes = SECTORS.filter(s => s.goldImpact === "bullish").reduce((a, s) => a + s.tonnes, 0);
    const demandScore = Math.round((bullishTonnes / totalTonnes) * 100);

    const demandBias: GoldDemandPayload["demandBias"] =
      yoyChangePct > 8 ? "bullish"
      : yoyChangePct > 0 ? "neutral"
      : "bearish";

    const data: GoldDemandPayload = {
      totalTonnes:       Math.round(totalTonnes),
      yoyChangePct,
      demandBias,
      demandBiasColor:   demandBias === "bullish" ? "#34d399" : demandBias === "bearish" ? "#f87171" : "#f5c451",
      demandBiasTh:
        demandBias === "bullish" ? "Bullish — อุปสงค์ทองรวมเติบโตแข็งแกร่ง"
        : demandBias === "bearish" ? "Bearish — อุปสงค์รวมชะลอตัว"
        : "Neutral — อุปสงค์ทรงตัว",
      demandScore,
      sectors,
      regional: REGIONAL,
      goldPrice:         Math.round(goldPrice),
      impliedAnnualDemand: Math.round(totalTonnes * 4),
      generatedAt:       new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
