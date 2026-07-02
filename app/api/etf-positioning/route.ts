import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface GoldETFData {
  symbol: string;
  name: string;
  type: "physical" | "miners" | "leveraged";
  price: number;
  change1DPct: number;
  change1WPct: number;
  change1MPct: number;
  volume: number;
  avgVolume20D: number;
  relativeVolume: number;   // volume / 20D avg
  flowSignal: "strong_inflow" | "inflow" | "neutral" | "outflow" | "strong_outflow";
  flowColor: string;
  flowLabel: string;
  impliedFlowUSD: number;   // rough implied dollar flow (relative vol × price × avg vol × direction)
  aum: string;              // known AUM (approximate)
}

export interface ETFPositioningPayload {
  goldPrice: number;
  goldChange1DPct: number;
  etfs: GoldETFData[];
  compositeFlowSignal: "accumulation" | "neutral" | "distribution";
  compositeFlowColor: string;
  compositeFlowLabel: string;
  compositeFlowDescription: string;
  physicalETFBias: "accumulation" | "neutral" | "distribution";  // GLD + IAU + SGOL
  minerETFBias: "accumulation" | "neutral" | "distribution";     // GDX + GDXJ
  physicalColor: string;
  minerColor: string;
  leadingIndicatorNote: string;   // are miners leading/lagging physical?
  institutionalNote: string;      // interpretation of flow for institutional sentiment
  timestamp: string;
}

let CACHE: { data: ETFPositioningPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

const ETF_DEFS = [
  { symbol: "GLD",   name: "SPDR Gold Shares",        type: "physical" as const,  aum: "~$70B" },
  { symbol: "IAU",   name: "iShares Gold Trust",       type: "physical" as const,  aum: "~$30B" },
  { symbol: "SGOL",  name: "abrdn Physical Gold",      type: "physical" as const,  aum: "~$3B"  },
  { symbol: "BAR",   name: "GraniteShares Gold",       type: "physical" as const,  aum: "~$2B"  },
  { symbol: "GDX",   name: "VanEck Gold Miners",       type: "miners" as const,    aum: "~$15B" },
  { symbol: "GDXJ",  name: "VanEck Junior Gold Miners",type: "miners" as const,    aum: "~$5B"  },
  { symbol: "RING",  name: "iShares Gold Producers",   type: "miners" as const,    aum: "~$0.5B"},
  { symbol: "NUGT",  name: "Direxion Daily Gold 2×",   type: "leveraged" as const, aum: "~$0.5B"},
  { symbol: "JNUG",  name: "Direxion Junior Gold 2×",  type: "leveraged" as const, aum: "~$0.3B"},
];

async function fetchETF(symbol: string): Promise<{ price: number; change1D: number; change1W: number; change1M: number; volume: number; closes: number[]; volumes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta ?? {};
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const volumes: number[] = (r.indicators?.quote?.[0]?.volume ?? []).map((v: number | null) => v ?? 0);
    const price: number = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prevClose: number = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
    const volume: number = meta.regularMarketVolume ?? volumes[volumes.length - 1] ?? 0;
    const change1D = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    const pct = (n: number) => {
      if (closes.length < n + 1) return 0;
      const past = closes[closes.length - 1 - n];
      return past > 0 ? ((price - past) / past) * 100 : 0;
    };
    return { price, change1D, change1W: pct(5), change1M: pct(21), volume, closes, volumes };
  } catch { return null; }
}

function flowSignal(relVol: number, change1D: number): GoldETFData["flowSignal"] {
  const isUp = change1D > 0;
  if (relVol > 2.0 && isUp) return "strong_inflow";
  if (relVol > 1.3 && isUp) return "inflow";
  if (relVol > 2.0 && !isUp) return "strong_outflow";
  if (relVol > 1.3 && !isUp) return "outflow";
  return "neutral";
}

function flowColor(sig: GoldETFData["flowSignal"]): string {
  const c = { strong_inflow: "#34d399", inflow: "#86efac", neutral: "#f5c451", outflow: "#fb923c", strong_outflow: "#f87171" };
  return c[sig];
}

function flowLabel(sig: GoldETFData["flowSignal"]): string {
  const l = { strong_inflow: "Strong Inflow", inflow: "Inflow", neutral: "Neutral", outflow: "Outflow", strong_outflow: "Strong Outflow" };
  return l[sig];
}

function groupBias(etfList: GoldETFData[]): "accumulation" | "neutral" | "distribution" {
  const inflows = etfList.filter(e => e.flowSignal.includes("inflow")).length;
  const outflows = etfList.filter(e => e.flowSignal.includes("outflow")).length;
  if (inflows > outflows && inflows >= Math.ceil(etfList.length / 2)) return "accumulation";
  if (outflows > inflows && outflows >= Math.ceil(etfList.length / 2)) return "distribution";
  return "neutral";
}

function biasColor(b: "accumulation" | "neutral" | "distribution"): string {
  return b === "accumulation" ? "#34d399" : b === "distribution" ? "#f87171" : "#f5c451";
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldResult, ...etfResults] = await Promise.all([
      fetchETF("GC=F"),
      ...ETF_DEFS.map(e => fetchETF(e.symbol)),
    ]);

    const goldPrice = goldResult?.price ?? 3350;
    const goldChange1DPct = goldResult?.change1D ?? 0;

    const etfs: GoldETFData[] = ETF_DEFS.map((def, i) => {
      const r = etfResults[i];
      if (!r) return null;
      const avgVolume20D = r.volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, r.volumes.length);
      const relativeVolume = avgVolume20D > 0 ? r.volume / avgVolume20D : 1;
      const sig = flowSignal(relativeVolume, r.change1D);
      const impliedFlowUSD = Math.round((relativeVolume - 1) * avgVolume20D * r.price * (r.change1D >= 0 ? 1 : -1));
      return {
        symbol: def.symbol,
        name: def.name,
        type: def.type,
        aum: def.aum,
        price: Math.round(r.price * 100) / 100,
        change1DPct: Math.round(r.change1D * 100) / 100,
        change1WPct: Math.round(r.change1W * 100) / 100,
        change1MPct: Math.round(r.change1M * 100) / 100,
        volume: r.volume,
        avgVolume20D: Math.round(avgVolume20D),
        relativeVolume: Math.round(relativeVolume * 100) / 100,
        flowSignal: sig,
        flowColor: flowColor(sig),
        flowLabel: flowLabel(sig),
        impliedFlowUSD,
      };
    }).filter(Boolean) as GoldETFData[];

    const physicalETFs = etfs.filter(e => e.type === "physical");
    const minerETFs = etfs.filter(e => e.type === "miners");

    const physicalETFBias = groupBias(physicalETFs);
    const minerETFBias = groupBias(minerETFs);
    const physicalColor = biasColor(physicalETFBias);
    const minerColor = biasColor(minerETFBias);

    // Overall composite
    const allBias = groupBias(etfs);
    const compositeFlowColor = biasColor(allBias);
    const compositeFlowLabel = allBias === "accumulation" ? "Institutional Accumulation" : allBias === "distribution" ? "Institutional Distribution" : "Neutral Positioning";

    const compositeFlowDescription =
      allBias === "accumulation"
      ? "Above-average volume with rising prices across multiple gold ETFs — signals institutional accumulation. Smart money appears to be building gold positions."
      : allBias === "distribution"
      ? "Above-average volume with falling prices — signals institutional distribution or profit-taking. Monitor for follow-through selling in physical ETFs."
      : "Gold ETF volumes near 20-day average — no clear institutional positioning signal. Watch GLD volume specifically as a leading indicator.";

    // Leading indicator: miners vs physical
    const leadingIndicatorNote = minerETFBias === "accumulation" && physicalETFBias !== "accumulation"
      ? "Gold miners ETFs (GDX/GDXJ) accumulating AHEAD of physical gold ETFs — miners often lead the spot gold by 1-3 days. Historically bullish early signal."
      : physicalETFBias === "accumulation" && minerETFBias !== "accumulation"
      ? "Physical gold ETFs (GLD/IAU) accumulating while miners lag — institutional demand for pure gold exposure. Miners may catch up."
      : minerETFBias === "distribution" && physicalETFBias !== "distribution"
      ? "Miners distributing while physical gold holds — potential early warning of gold weakness. Miners tend to sell off first."
      : "Miners and physical gold ETFs moving in alignment — consistent institutional positioning signal.";

    const institutionalNote = allBias === "accumulation"
      ? `Total implied inflows across gold ETFs today — GLD being the primary indicator (AUM ~$70B). Sustained 3+ day accumulation typically precedes meaningful gold rallies.`
      : allBias === "distribution"
      ? `Distribution signals in gold ETFs. Large ETF outflows have historically coincided with short-term gold corrections of 2-5%. Monitor if this persists beyond 2-3 days.`
      : `ETF volumes near average suggest no urgent institutional repositioning. Normal market conditions; price action driven by technical levels and macro data flow.`;

    const payload: ETFPositioningPayload = {
      goldPrice, goldChange1DPct, etfs,
      compositeFlowSignal: allBias, compositeFlowColor, compositeFlowLabel, compositeFlowDescription,
      physicalETFBias, minerETFBias, physicalColor, minerColor,
      leadingIndicatorNote, institutionalNote,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("etf-positioning error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
