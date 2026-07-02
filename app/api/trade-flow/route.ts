import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface TradeRoute {
  from: string;
  fromTh: string;
  fromFlag: string;
  to: string;
  toTh: string;
  toFlag: string;
  tonnesQ1: number;
  yoyChangePct: number;
  type: "export" | "import" | "transit";
  significance: "major" | "moderate" | "minor";
  goldImpact: "bullish" | "neutral" | "bearish";
  goldImpactTh: string;
  note: string;
}

export interface HubSummary {
  country: string;
  countryTh: string;
  flag: string;
  role: "refining_hub" | "consumer" | "producer" | "financial_hub";
  roleTh: string;
  netImport: number;      // tonnes (positive = net import, negative = net export)
  yoyChangePct: number;
  description: string;
}

export interface TradeFlowPayload {
  totalFlowQ1: number;    // total tonnes flowing globally Q1
  yoyChangePct: number;
  flowSignal: "bullish" | "neutral" | "bearish";
  flowSignalTh: string;
  flowColor: string;
  routes: TradeRoute[];
  hubs: HubSummary[];
  goldPrice: number;
  hotspot: string;        // country with biggest YoY change
  generatedAt: string;
}

const ROUTES: TradeRoute[] = [
  {
    from: "Switzerland", fromTh: "สวิตเซอร์แลนด์", fromFlag: "🇨🇭",
    to: "India",         toTh: "อินเดีย",           toFlag: "🇮🇳",
    tonnesQ1: 98, yoyChangePct: 4.2, type: "export", significance: "major",
    goldImpact: "bullish",
    goldImpactTh: "อินเดียนำเข้าเพิ่ม → demand แข็งแกร่ง",
    note: "Swiss refiners ส่งทองบริสุทธิ์ 99.5% ให้อินเดีย; demand เครื่องประดับ",
  },
  {
    from: "Switzerland", fromTh: "สวิตเซอร์แลนด์", fromFlag: "🇨🇭",
    to: "China",         toTh: "จีน",               toFlag: "🇨🇳",
    tonnesQ1: 84, yoyChangePct: -6.8, type: "export", significance: "major",
    goldImpact: "neutral",
    goldImpactTh: "จีนชะลอนำเข้าจาก Swiss ชั่วคราว",
    note: "จีนหันไปซื้อจาก EM miners มากขึ้น; Swiss share ลดลง",
  },
  {
    from: "Australia",   fromTh: "ออสเตรเลีย",     fromFlag: "🇦🇺",
    to: "Switzerland",   toTh: "สวิตเซอร์แลนด์",   toFlag: "🇨🇭",
    tonnesQ1: 62, yoyChangePct: 8.1, type: "export", significance: "major",
    goldImpact: "neutral",
    goldImpactTh: "ส่งไปกลั่น; ไม่ใช่ demand สุดท้าย",
    note: "ทองดิบ (doré) ส่งเข้ากลั่นในสวิส ก่อนกระจายต่อ",
  },
  {
    from: "South Africa", fromTh: "แอฟริกาใต้",     fromFlag: "🇿🇦",
    to: "United Kingdom", toTh: "อังกฤษ",            toFlag: "🇬🇧",
    tonnesQ1: 38, yoyChangePct: 2.3, type: "export", significance: "moderate",
    goldImpact: "neutral",
    goldImpactTh: "London vault ใช้เป็น settlement centre",
    note: "London LBMA เป็น hub ซื้อขายหลักของโลก",
  },
  {
    from: "Russia",      fromTh: "รัสเซีย",         fromFlag: "🇷🇺",
    to: "China",         toTh: "จีน",               toFlag: "🇨🇳",
    tonnesQ1: 55, yoyChangePct: 18.4, type: "export", significance: "major",
    goldImpact: "bullish",
    goldImpactTh: "รัสเซียหลีกเลี่ยง Western sanctions → China demand เพิ่ม",
    note: "รัสเซียขายทองให้จีนหลีกเลี่ยง SWIFT; กระตุ้น de-dollarization",
  },
  {
    from: "United States", fromTh: "สหรัฐอเมริกา", fromFlag: "🇺🇸",
    to: "United Kingdom",  toTh: "อังกฤษ",           toFlag: "🇬🇧",
    tonnesQ1: 29, yoyChangePct: 42.1, type: "export", significance: "major",
    goldImpact: "bullish",
    goldImpactTh: "Tariff arbitrage flow — COMEX vs LBMA premium",
    note: "US ส่งออกทองเพิ่มมากเพราะ COMEX premium จาก tariff ปลอม",
  },
  {
    from: "Dubai",       fromTh: "ดูไบ (UAE)",     fromFlag: "🇦🇪",
    to: "India",         toTh: "อินเดีย",           toFlag: "🇮🇳",
    tonnesQ1: 45, yoyChangePct: 11.7, type: "transit", significance: "major",
    goldImpact: "bullish",
    goldImpactTh: "Dubai hub รับทองจาก EM → กระจายให้เอเชียใต้",
    note: "UAE เป็น transit hub; India ซื้อผ่าน Dubai เพื่อภาษีต่ำกว่า",
  },
  {
    from: "Canada",      fromTh: "แคนาดา",         fromFlag: "🇨🇦",
    to: "United States", toTh: "สหรัฐอเมริกา",     toFlag: "🇺🇸",
    tonnesQ1: 22, yoyChangePct: -12.3, type: "export", significance: "moderate",
    goldImpact: "neutral",
    goldImpactTh: "Tariff ทำให้ flow ลดลง; US หาแหล่งอื่น",
    note: "US tariff threats ทำให้ Canada-US gold flow ลด",
  },
];

const HUBS: HubSummary[] = [
  {
    country: "Switzerland", countryTh: "สวิตเซอร์แลนด์", flag: "🇨🇭",
    role: "refining_hub", roleTh: "ศูนย์กลางการกลั่น",
    netImport: 180, yoyChangePct: 3.2,
    description: "กลั่นทองคำ ~70% ของโลก; Valcambi, PAMP, Argor-Heraeus",
  },
  {
    country: "China", countryTh: "จีน", flag: "🇨🇳",
    role: "consumer", roleTh: "ผู้บริโภคหลัก",
    netImport: 320, yoyChangePct: 2.1,
    description: "ผู้นำเข้าทองสูงสุดของโลก; SGE (Shanghai Gold Exchange)",
  },
  {
    country: "India", countryTh: "อินเดีย", flag: "🇮🇳",
    role: "consumer", roleTh: "ผู้บริโภคหลัก",
    netImport: 145, yoyChangePct: 6.8,
    description: "ผู้นำเข้าอันดับ 2; demand เพิ่มช่วง Diwali/Wedding season",
  },
  {
    country: "United Kingdom", countryTh: "อังกฤษ", flag: "🇬🇧",
    role: "financial_hub", roleTh: "ศูนย์ LBMA",
    netImport: 0, yoyChangePct: 38.4,
    description: "LBMA London Bullion Market; OTC settlement global hub",
  },
  {
    country: "UAE", countryTh: "ดูไบ (UAE)", flag: "🇦🇪",
    role: "financial_hub", roleTh: "Transit Hub",
    netImport: -30, yoyChangePct: 14.2,
    description: "Dubai เป็น re-export hub ระหว่าง Africa/Russia → Asia",
  },
  {
    country: "Australia", countryTh: "ออสเตรเลีย", flag: "🇦🇺",
    role: "producer", roleTh: "ประเทศผู้ผลิต",
    netImport: -320, yoyChangePct: 3.5,
    description: "ส่งออกสุทธิ; Perth Mint กลั่นในประเทศก่อนส่งออก",
  },
];

let CACHE: { data: TradeFlowPayload; ts: number } | null = null;
const TTL = 4 * 60 * 60 * 1000;

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
    } catch { /* fallback */ }

    const totalFlowQ1 = ROUTES.reduce((s, r) => s + r.tonnesQ1, 0);
    const yoyChangePct = parseFloat(
      (ROUTES.reduce((s, r) => s + r.yoyChangePct * r.tonnesQ1, 0) / totalFlowQ1).toFixed(1)
    );

    const bullishRoutes = ROUTES.filter(r => r.goldImpact === "bullish").reduce((s, r) => s + r.tonnesQ1, 0);
    const flowSignal: TradeFlowPayload["flowSignal"] =
      bullishRoutes / totalFlowQ1 > 0.5 ? "bullish"
      : yoyChangePct < -5 ? "bearish"
      : "neutral";

    const hotspot = ROUTES.sort((a, b) => Math.abs(b.yoyChangePct) - Math.abs(a.yoyChangePct))[0];

    const data: TradeFlowPayload = {
      totalFlowQ1:   Math.round(totalFlowQ1),
      yoyChangePct,
      flowSignal,
      flowSignalTh:
        flowSignal === "bullish" ? "Bullish — กระแสทองคำไปยังประเทศผู้บริโภคเพิ่มขึ้น"
        : flowSignal === "bearish" ? "Bearish — กระแสการค้าทองชะลอตัว"
        : "Neutral — กระแสการค้าทองปกติ",
      flowColor: flowSignal === "bullish" ? "#34d399" : flowSignal === "bearish" ? "#f87171" : "#f5c451",
      routes: ROUTES.sort((a, b) => b.tonnesQ1 - a.tonnesQ1),
      hubs: HUBS,
      goldPrice:     Math.round(goldPrice),
      hotspot:       `${hotspot.fromFlag} ${hotspot.fromTh} → ${hotspot.toFlag} ${hotspot.toTh} (${hotspot.yoyChangePct >= 0 ? "+" : ""}${hotspot.yoyChangePct.toFixed(1)}%)`,
      generatedAt:   new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
