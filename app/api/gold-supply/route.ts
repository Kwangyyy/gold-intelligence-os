import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface SupplyComponent {
  name: string;
  nameTh: string;
  tonnesQ1: number;       // Q1 2026
  yoyChangePct: number;
  shareOfTotal: number;   // % of total supply
  trend: "up" | "flat" | "down";
  trendColor: string;
  note: string;
}

export interface MiningRegion {
  region: string;
  regionTh: string;
  tonnes: number;         // annual estimate
  sharePct: number;
  yoyChangePct: number;
}

export interface GoldSupplyPayload {
  totalSupplyQ1: number;          // Q1 2026 tonnes
  totalDemandQ1: number;          // from demand data
  deficitSurplus: number;         // supply - demand (negative = deficit)
  isDeficit: boolean;
  balanceSignal: "deficit" | "balance" | "surplus";
  balanceColor: string;
  balanceTh: string;
  supplyGrowthYoy: number;        // %
  components: SupplyComponent[];
  regions: MiningRegion[];
  goldPrice: number;
  miningCostAvgAisc: number;      // avg AISC $ per oz
  marginPct: number;              // (gold - AISC) / gold
  generatedAt: string;
}

// Q1 2026 supply data (WGC estimates, tonnes)
const SUPPLY_COMPONENTS: Omit<SupplyComponent, "shareOfTotal">[] = [
  {
    name: "Mine Production",
    nameTh: "การผลิตเหมือง",
    tonnesQ1: 893,
    yoyChangePct: 1.8,
    trend: "up",
    trendColor: "#f87171",   // more supply = slightly bearish
    note: "สูงสุดเป็นประวัติการณ์; Nevada, Australia, Canada นำ",
  },
  {
    name: "Recycling",
    nameTh: "การรีไซเคิล",
    tonnesQ1: 312,
    yoyChangePct: 12.4,
    trend: "up",
    trendColor: "#f97316",
    note: "ราคาสูงกระตุ้น recycling; เพิ่มแรงขายระยะสั้น",
  },
  {
    name: "Producer Hedging",
    nameTh: "Hedging ผู้ผลิต",
    tonnesQ1: 18,
    yoyChangePct: -22.1,
    trend: "down",
    trendColor: "#34d399",   // less hedging = less sell pressure
    note: "Dehedging ต่อเนื่อง; ผู้ผลิตไม่อยากล็อกราคาต่ำ",
  },
];

const MINING_REGIONS: Omit<MiningRegion, "sharePct">[] = [
  { region: "China",          regionTh: "จีน",          tonnes: 370, yoyChangePct:  0.5 },
  { region: "Australia",      regionTh: "ออสเตรเลีย",   tonnes: 310, yoyChangePct:  3.2 },
  { region: "Russia",         regionTh: "รัสเซีย",      tonnes: 310, yoyChangePct: -1.4 },
  { region: "Canada",         regionTh: "แคนาดา",       tonnes: 200, yoyChangePct:  4.1 },
  { region: "USA",            regionTh: "สหรัฐอเมริกา", tonnes: 173, yoyChangePct:  2.8 },
  { region: "Ghana",          regionTh: "กานา",         tonnes: 130, yoyChangePct: -2.3 },
  { region: "Indonesia",      regionTh: "อินโดนีเซีย",  tonnes: 110, yoyChangePct:  5.7 },
  { region: "Other",          regionTh: "อื่นๆ",        tonnes: 970, yoyChangePct:  1.1 },
];

let CACHE: { data: GoldSupplyPayload; ts: number } | null = null;
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

    const totalSupplyQ1 = SUPPLY_COMPONENTS.reduce((s, c) => s + c.tonnesQ1, 0);
    const totalDemandQ1 = 1286; // from gold-demand data (Q1 2026 estimate)
    const deficitSurplus = Math.round(totalSupplyQ1 - totalDemandQ1);

    const components: SupplyComponent[] = SUPPLY_COMPONENTS.map(c => ({
      ...c,
      shareOfTotal: parseFloat(((c.tonnesQ1 / totalSupplyQ1) * 100).toFixed(1)),
    }));

    const totalRegionTonnes = MINING_REGIONS.reduce((s, r) => s + r.tonnes, 0);
    const regions: MiningRegion[] = MINING_REGIONS.map(r => ({
      ...r,
      sharePct: parseFloat(((r.tonnes / totalRegionTonnes) * 100).toFixed(1)),
    }));

    const supplyGrowthYoy = parseFloat(
      (SUPPLY_COMPONENTS.reduce((s, c) => s + c.yoyChangePct * c.tonnesQ1, 0) / totalSupplyQ1).toFixed(2)
    );

    const balanceSignal: GoldSupplyPayload["balanceSignal"] =
      deficitSurplus < -50 ? "deficit"
      : deficitSurplus >  50 ? "surplus"
      : "balance";

    const miningCostAvgAisc = 1443; // from mining-cost data
    const marginPct = parseFloat(((goldPrice - miningCostAvgAisc) / goldPrice * 100).toFixed(1));

    const data: GoldSupplyPayload = {
      totalSupplyQ1:    Math.round(totalSupplyQ1),
      totalDemandQ1,
      deficitSurplus,
      isDeficit:        deficitSurplus < 0,
      balanceSignal,
      balanceColor:     balanceSignal === "deficit" ? "#34d399" : balanceSignal === "surplus" ? "#f87171" : "#f5c451",
      balanceTh:
        balanceSignal === "deficit" ? `ขาดดุล ${Math.abs(deficitSurplus)}t — อุปสงค์สูงกว่าอุปทาน → Bullish`
        : balanceSignal === "surplus" ? `เกินดุล ${deficitSurplus}t — อุปทานเกิน → Bearish`
        : "สมดุล — อุปสงค์เท่าอุปทาน",
      supplyGrowthYoy,
      components,
      regions,
      goldPrice:        Math.round(goldPrice),
      miningCostAvgAisc,
      marginPct,
      generatedAt:      new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
