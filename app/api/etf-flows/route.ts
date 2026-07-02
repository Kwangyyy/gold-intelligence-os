import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ETFEntry {
  symbol: string;
  name: string;
  nameTh: string;
  price: number;
  changeAmt: number;
  changePct: number;
  volume: number;       // today's volume (shares)
  avgVolume20: number;  // 20-day avg volume
  volumeRatio: number;  // volume / avgVolume20
  pos52w: number;       // price position in 52W range, 0-100%
  flowSignal: "strong_inflow" | "inflow" | "neutral" | "outflow" | "strong_outflow";
  flowSignalTh: string;
  flowSignalColor: string;
  weeklyFlows: number[]; // last 4 weeks estimated flow score (-100 to +100)
  high52: number;
  low52: number;
}

export interface ETFFlowsPayload {
  goldPrice: number;
  compositeFlow: "strong_inflow" | "inflow" | "neutral" | "outflow" | "strong_outflow";
  compositeFlowTh: string;
  compositeFlowColor: string;
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  entries: ETFEntry[];
  generatedAt: string;
}

const ETF_META = [
  { sym: "GLD",  name: "SPDR Gold Shares",  nameTh: "SPDR Gold Shares (ใหญ่สุด)" },
  { sym: "IAU",  name: "iShares Gold Trust", nameTh: "iShares Gold Trust"          },
  { sym: "SGOL", name: "Aberdeen Gold ETF",  nameTh: "Aberdeen Physical Gold"      },
];

type YChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketVolume?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
      };
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
};

async function fetchETF(sym: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=60d&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  const j = await r.json() as YChart;
  const res = j?.chart?.result?.[0];
  if (!res) return null;
  const meta = res.meta ?? {};
  const q    = res.indicators?.quote?.[0] ?? {};
  const opens  = (q.open  ?? []).filter((v): v is number => v !== null && !isNaN(v));
  const closes = (q.close ?? []).filter((v): v is number => v !== null && !isNaN(v));
  const vols   = (q.volume ?? []).filter((v): v is number => v !== null && !isNaN(v));

  // 20-day avg volume
  const recent20vols = vols.slice(-20);
  const avgVol20 = recent20vols.length ? recent20vols.reduce((s, v) => s + v, 0) / recent20vols.length : 0;

  // Weekly flows: split last ~28 bars into 4 groups of 5 trading days
  const weeklyFlows: number[] = [];
  for (let w = 3; w >= 0; w--) {
    const start = closes.length - (w + 1) * 5;
    const end   = closes.length - w * 5;
    const wCloses = closes.slice(Math.max(0, start), end);
    const wOpens  = opens.slice(Math.max(0, start), end);
    const wVols   = vols.slice(Math.max(0, start), end);
    if (!wCloses.length) { weeklyFlows.push(0); continue; }
    let score = 0;
    for (let i = 0; i < wCloses.length; i++) {
      const dir = wCloses[i] > (wOpens[i] ?? wCloses[i]) ? 1 : -1;
      const volW = wVols[i] ? wVols[i] / (avgVol20 || 1) : 1;
      score += dir * volW;
    }
    weeklyFlows.push(parseFloat((score / wCloses.length * 50).toFixed(1)));
  }

  return {
    price:      meta.regularMarketPrice ?? 0,
    prevClose:  meta.previousClose      ?? 0,
    volume:     meta.regularMarketVolume ?? 0,
    high52:     meta.fiftyTwoWeekHigh   ?? 0,
    low52:      meta.fiftyTwoWeekLow    ?? 0,
    avgVol20:   Math.round(avgVol20),
    weeklyFlows,
  };
}

function classifyFlow(volRatio: number, changePct: number): Pick<ETFEntry, "flowSignal" | "flowSignalTh" | "flowSignalColor"> {
  const score = (changePct > 0 ? 1 : -1) * volRatio;
  if (score > 2)   return { flowSignal: "strong_inflow",  flowSignalTh: "Inflow แรง",    flowSignalColor: "#34d399" };
  if (score > 0.8) return { flowSignal: "inflow",         flowSignalTh: "Inflow ปกติ",   flowSignalColor: "#86efac" };
  if (score > -0.8) return { flowSignal: "neutral",        flowSignalTh: "Neutral",        flowSignalColor: "#9ca3af" };
  if (score > -2)  return { flowSignal: "outflow",         flowSignalTh: "Outflow ปกติ",  flowSignalColor: "#f97316" };
  return                   { flowSignal: "strong_outflow", flowSignalTh: "Outflow แรง",   flowSignalColor: "#f87171" };
}

let CACHE: { data: ETFFlowsPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldR, ...etfResults] = await Promise.all([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }),
      ...ETF_META.map(e => fetchETF(e.sym).catch(() => null)),
    ]);

    type GJ = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
    const goldJ = await goldR.json() as GJ;
    const goldPrice = goldJ?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3200;

    const entries: ETFEntry[] = [];
    for (let i = 0; i < ETF_META.length; i++) {
      const meta = ETF_META[i];
      const d    = etfResults[i] as Awaited<ReturnType<typeof fetchETF>>;
      if (!d || !d.price) continue;

      const changeAmt = d.price - d.prevClose;
      const changePct = d.prevClose ? (changeAmt / d.prevClose) * 100 : 0;
      const volRatio  = d.avgVol20 ? d.volume / d.avgVol20 : 1;
      const range52   = d.high52 - d.low52;
      const pos52w    = range52 > 0 ? Math.round(((d.price - d.low52) / range52) * 100) : 50;

      entries.push({
        symbol: meta.sym,
        name: meta.name,
        nameTh: meta.nameTh,
        price: parseFloat(d.price.toFixed(2)),
        changeAmt: parseFloat(changeAmt.toFixed(2)),
        changePct: parseFloat(changePct.toFixed(2)),
        volume: d.volume,
        avgVolume20: d.avgVol20,
        volumeRatio: parseFloat(volRatio.toFixed(2)),
        pos52w,
        high52: d.high52,
        low52: d.low52,
        weeklyFlows: d.weeklyFlows,
        ...classifyFlow(volRatio, changePct),
      });
    }

    // Composite flow from all entries
    const flowScores: Record<ETFEntry["flowSignal"], number> = {
      strong_inflow: 2, inflow: 1, neutral: 0, outflow: -1, strong_outflow: -2,
    };
    const avgScore = entries.length
      ? entries.reduce((s, e) => s + flowScores[e.flowSignal], 0) / entries.length
      : 0;

    const compositeFlow: ETFFlowsPayload["compositeFlow"] =
      avgScore >= 1.5 ? "strong_inflow"
      : avgScore >= 0.5 ? "inflow"
      : avgScore <= -1.5 ? "strong_outflow"
      : avgScore <= -0.5 ? "outflow"
      : "neutral";

    const goldBias: ETFFlowsPayload["goldBias"] =
      compositeFlow === "strong_inflow" || compositeFlow === "inflow" ? "bullish"
      : compositeFlow === "strong_outflow" || compositeFlow === "outflow" ? "bearish"
      : "neutral";

    const compositeFlowLabel: Record<ETFFlowsPayload["compositeFlow"], string> = {
      strong_inflow:  "🟢 Strong Inflow — สถาบันซื้อทองหนัก",
      inflow:         "🟢 Inflow — เงินไหลเข้า ETF ทอง",
      neutral:        "⚪ Neutral — ETF flows ไม่มีทิศทางชัด",
      outflow:        "🔴 Outflow — เงินไหลออกจาก ETF ทอง",
      strong_outflow: "🔴 Strong Outflow — สถาบันขายทองหนัก",
    };
    const flowColors: Record<ETFFlowsPayload["compositeFlow"], string> = {
      strong_inflow: "#34d399", inflow: "#86efac", neutral: "#9ca3af", outflow: "#f97316", strong_outflow: "#f87171",
    };

    const data: ETFFlowsPayload = {
      goldPrice: Math.round(goldPrice),
      compositeFlow,
      compositeFlowTh: compositeFlowLabel[compositeFlow],
      compositeFlowColor: flowColors[compositeFlow],
      goldBias,
      goldBiasTh: goldBias === "bullish"
        ? "Bullish — ETF inflows หนุน demand ทอง"
        : goldBias === "bearish"
        ? "Bearish — ETF outflows สะท้อนการขายทองของสถาบัน"
        : "Neutral — ETF flows ไม่ชี้ทิศทางชัด",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      entries,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
