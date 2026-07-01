import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface HeatmapCell {
  symbol: string;
  name: string;
  nameTh: string;
  category: "metal" | "equity" | "bond" | "currency" | "commodity" | "crypto";
  currentPrice: number;
  ret1d: number;
  ret1w: number;
  ret1m: number;
  color1d: string;
  color1w: string;
  color1m: string;
  trend: "up" | "down" | "flat";
  goldCorr: number | null;  // rough correlation with gold
}

export interface IntermarketHeatmapPayload {
  cells: HeatmapCell[];
  goldPrice: number;
  goldRet1d: number;
  goldRet1w: number;
  goldRet1m: number;
  riskOnOff: "risk_on" | "risk_off" | "neutral";
  riskOnOffTh: string;
  riskSummaryTh: string;
  generatedAt: string;
}

const ASSETS = [
  { symbol: "GC%3DF",    name: "Gold",         nameTh: "ทองคำ",           category: "metal"     as const },
  { symbol: "SI%3DF",    name: "Silver",        nameTh: "เงิน",            category: "metal"     as const },
  { symbol: "PL%3DF",    name: "Platinum",      nameTh: "แพลตตินัม",       category: "metal"     as const },
  { symbol: "%5EGSPC",   name: "S&P 500",       nameTh: "S&P 500",         category: "equity"    as const },
  { symbol: "%5EDJI",    name: "Dow Jones",     nameTh: "Dow Jones",       category: "equity"    as const },
  { symbol: "%5EIXIC",   name: "NASDAQ",        nameTh: "NASDAQ",          category: "equity"    as const },
  { symbol: "TLT",       name: "US Bonds (TLT)",nameTh: "พันธบัตร (TLT)", category: "bond"      as const },
  { symbol: "DX-Y.NYB",  name: "DXY (USD)",     nameTh: "USD Index",       category: "currency"  as const },
  { symbol: "EURUSD%3DX",name: "EUR/USD",       nameTh: "ยูโร",            category: "currency"  as const },
  { symbol: "JPY%3DX",   name: "USD/JPY",       nameTh: "เยน",             category: "currency"  as const },
  { symbol: "CL%3DF",    name: "Crude Oil",     nameTh: "น้ำมัน",          category: "commodity" as const },
  { symbol: "NG%3DF",    name: "Nat Gas",       nameTh: "แก๊สธรรมชาติ",   category: "commodity" as const },
  { symbol: "BTC-USD",   name: "Bitcoin",       nameTh: "Bitcoin",         category: "crypto"    as const },
  { symbol: "%5EVIX",    name: "VIX",           nameTh: "VIX (Fear)",      category: "equity"    as const },
];

// Rough gold correlations (historical, static)
const GOLD_CORR: Record<string, number> = {
  "GC%3DF":     1.0,
  "SI%3DF":     0.85,
  "PL%3DF":     0.6,
  "%5EGSPC":   -0.1,
  "%5EDJI":    -0.1,
  "%5EIXIC":   -0.15,
  "TLT":        0.35,
  "DX-Y.NYB":  -0.65,
  "EURUSD%3DX": 0.55,
  "JPY%3DX":   -0.3,
  "CL%3DF":     0.25,
  "NG%3DF":     0.05,
  "BTC-USD":    0.2,
  "%5EVIX":    -0.4,
};

function retColor(ret: number): string {
  if (ret > 3)   return "#34d399";
  if (ret > 1)   return "#6ee7b7";
  if (ret > 0)   return "#a7f3d0";
  if (ret > -1)  return "#fca5a5";
  if (ret > -3)  return "#f87171";
  return "#ef4444";
}

async function fetchReturns(symbol: string): Promise<{ price: number; ret1d: number; ret1w: number; ret1m: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=45d&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const result = j?.chart?.result?.[0];
    if (!result) return null;
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c): c is number => c != null);
    if (valid.length < 22) return null;
    const price = valid.at(-1)!;
    const ret1d = ((valid.at(-1)! - valid.at(-2)!) / valid.at(-2)!) * 100;
    const ret1w = ((valid.at(-1)! - valid.at(-6)!) / valid.at(-6)!) * 100;
    const ret1m = ((valid.at(-1)! - valid.at(-22)!) / valid.at(-22)!) * 100;
    return { price, ret1d: +ret1d.toFixed(2), ret1w: +ret1w.toFixed(2), ret1m: +ret1m.toFixed(2) };
  } catch { return null; }
}

let CACHE: { data: IntermarketHeatmapPayload; ts: number } | null = null;
const TTL = 20 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const results = await Promise.all(ASSETS.map(a => fetchReturns(a.symbol)));

    const cells: HeatmapCell[] = [];
    for (let i = 0; i < ASSETS.length; i++) {
      const a = ASSETS[i];
      const r = results[i];
      if (!r) continue;
      cells.push({
        symbol: a.symbol, name: a.name, nameTh: a.nameTh, category: a.category,
        currentPrice: +r.price.toFixed(a.symbol.includes("VIX") ? 2 : a.symbol.includes("DX") ? 3 : 0),
        ret1d: r.ret1d, ret1w: r.ret1w, ret1m: r.ret1m,
        color1d: retColor(r.ret1d),
        color1w: retColor(r.ret1w),
        color1m: retColor(r.ret1m),
        trend: r.ret1w > 0.5 ? "up" : r.ret1w < -0.5 ? "down" : "flat",
        goldCorr: GOLD_CORR[a.symbol] ?? null,
      });
    }

    if (!cells.length) throw new Error("No asset data");

    const gold = cells.find(c => c.symbol === "GC%3DF");
    const spx  = cells.find(c => c.symbol === "%5EGSPC");
    const vix  = cells.find(c => c.symbol === "%5EVIX");
    const tlt  = cells.find(c => c.symbol === "TLT");

    // Risk-on/off determination
    let riskOnOff: IntermarketHeatmapPayload["riskOnOff"] = "neutral";
    const riskScore = (spx?.ret1w ?? 0) - (tlt?.ret1w ?? 0) - (vix ? (vix.ret1w * 0.5) : 0);
    if (riskScore > 1) riskOnOff = "risk_on";
    else if (riskScore < -1) riskOnOff = "risk_off";

    const riskOnOffTh = riskOnOff === "risk_on" ? "Risk-On 🟢 (นักลงทุนชอบความเสี่ยง)" : riskOnOff === "risk_off" ? "Risk-Off 🔴 (นักลงทุนหลีกเลี่ยงความเสี่ยง)" : "Neutral 🟡";
    const riskSummaryTh = riskOnOff === "risk_on"
      ? `หุ้นนำ, พันธบัตรอ่อน — ทองอาจ underperform ระยะสั้น แต่ภาพใหญ่ยังน่าสนใจหาก USD อ่อน`
      : riskOnOff === "risk_off"
      ? `นักลงทุนหนีความเสี่ยง — ทองได้แรงหนุน Safe-Haven demand สูง`
      : `ตลาดผสม ไม่มีทิศทาง Risk-On/Off ชัดเจน`;

    const data: IntermarketHeatmapPayload = {
      cells,
      goldPrice: gold?.currentPrice ?? 0,
      goldRet1d: gold?.ret1d ?? 0,
      goldRet1w: gold?.ret1w ?? 0,
      goldRet1m: gold?.ret1m ?? 0,
      riskOnOff, riskOnOffTh, riskSummaryTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
