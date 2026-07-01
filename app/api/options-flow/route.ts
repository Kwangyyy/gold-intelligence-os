import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface OptionsFlowPayload {
  // Gold Volatility Index (GVZ) proxy
  impliedVol: number;        // % — proxy from VIX + gold beta
  ivPercentile: number;      // 0-100 — where IV sits vs recent history
  ivRank: string;            // "Low" / "Normal" / "High" / "Extreme"
  ivRankTh: string;

  // Put/Call sentiment proxy (rule-based from VIX skew)
  putCallSentiment: "heavy_puts" | "balanced" | "heavy_calls";
  putCallTh: string;
  putCallScore: number;      // 0-100 (100 = most calls = bullish)

  // IV vs RV spread (risk premium)
  realizedVol: number;
  ivRvSpread: number;        // IV - RV (positive = options expensive)
  ivRvSignal: string;
  ivRvSignalTh: string;

  // Term structure (short vs long vol)
  termStructure: "contango" | "backwardation" | "flat";
  termStructureTh: string;

  // Composite options signal
  compositeSignal: "buy_volatility" | "sell_volatility" | "neutral";
  compositeSignalTh: string;
  compositeColor: string;

  goldPrice: number;
  vix: number;
  implicationTh: string;
  generatedAt: string;
}

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

async function fetchRealizedVol(): Promise<number> {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=40d&interval=1d";
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return 15;
    const j = await r.json();
    const closes: (number | null)[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c): c is number => c != null);
    if (valid.length < 21) return 15;
    const returns = valid.slice(-21).map((c, i, a) => i === 0 ? 0 : Math.log(c / a[i - 1])).slice(1);
    const mean = returns.reduce((a, v) => a + v, 0) / returns.length;
    const std  = Math.sqrt(returns.reduce((a, v) => a + (v - mean) ** 2, 0) / (returns.length - 1));
    return +(std * Math.sqrt(252) * 100).toFixed(1);
  } catch { return 15; }
}

let CACHE: { data: OptionsFlowPayload; ts: number } | null = null;
const TTL = 20 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldPrice, vix, rvRaw] = await Promise.all([
      fetchPrice("GC%3DF"),
      fetchPrice("%5EVIX"),
      fetchRealizedVol(),
    ]);

    const gold   = goldPrice ?? 3200;
    const vixVal = vix       ?? 18;
    const rv     = rvRaw;

    // Gold implied vol ≈ VIX × gold beta (gold beta to VIX is ~0.8-1.2)
    // Gold IV historically tracks about 1.1× VIX in high-stress, 0.8× in low
    const goldBeta = vixVal > 25 ? 1.15 : vixVal > 18 ? 1.0 : 0.85;
    const impliedVol = +(vixVal * goldBeta).toFixed(1);

    // IV Percentile: score relative to historical range (10-50% typical for gold)
    const ivPct = Math.max(0, Math.min(100, ((impliedVol - 8) / (45 - 8)) * 100));
    const ivRank = ivPct > 75 ? "Extreme" : ivPct > 50 ? "High" : ivPct > 25 ? "Normal" : "Low";
    const ivRankTh = ivPct > 75 ? "สูงสุดผิดปกติ" : ivPct > 50 ? "สูง" : ivPct > 25 ? "ปกติ" : "ต่ำ";

    // IV vs RV spread
    const ivRvSpread = +(impliedVol - rv).toFixed(1);
    const ivRvSignal = ivRvSpread > 5 ? "Options overpriced — consider selling premium" :
                       ivRvSpread < -3 ? "Options cheap — good time to buy vol" : "Fair value";
    const ivRvSignalTh = ivRvSpread > 5 ? "Options แพงเกินจริง — พิจารณาขาย premium" :
                         ivRvSpread < -3 ? "Options ถูก — โอกาสซื้อ volatility" : "ราคา Options สมเหตุสมผล";

    // Put/Call proxy from VIX level and direction
    // High VIX = more puts being bought = heavy puts signal
    const putCallScore = Math.max(0, Math.min(100, 100 - (vixVal - 12) / 28 * 100));
    const putCallSentiment: OptionsFlowPayload["putCallSentiment"] =
      putCallScore < 35 ? "heavy_puts" : putCallScore > 65 ? "heavy_calls" : "balanced";
    const putCallTh = putCallSentiment === "heavy_puts" ? "Put สูง — ตลาดป้องกัน downside มาก" :
                      putCallSentiment === "heavy_calls" ? "Call สูง — ตลาดเก็งขาขึ้น" : "สมดุล Put/Call";

    // Term structure proxy: if IV > RV by a lot = contango (normal), else backwardation
    const termStructure: OptionsFlowPayload["termStructure"] =
      ivRvSpread > 3 ? "contango" : ivRvSpread < -2 ? "backwardation" : "flat";
    const termStructureTh = termStructure === "contango" ? "Contango — Short-term vol ถูกกว่า Long-term" :
                             termStructure === "backwardation" ? "Backwardation — Short-term vol แพงกว่า Long-term (stress)" : "Flat";

    // Composite signal
    let compositeSignal: OptionsFlowPayload["compositeSignal"];
    let compositeSignalTh: string;
    let compositeColor: string;
    if (ivPct > 65 && ivRvSpread > 5) {
      compositeSignal = "sell_volatility"; compositeSignalTh = "Sell Volatility — IV แพง ขาย Premium"; compositeColor = "#f97316";
    } else if (ivPct < 30 && ivRvSpread < 0) {
      compositeSignal = "buy_volatility"; compositeSignalTh = "Buy Volatility — IV ถูก ซื้อ Option"; compositeColor = "#34d399";
    } else {
      compositeSignal = "neutral"; compositeSignalTh = "Neutral — ราคา Options สมเหตุสมผล รอสัญญาณ"; compositeColor = "#f5c451";
    }

    const implicationTh = compositeSignal === "sell_volatility"
      ? `IV สูงกว่า RV ถึง ${ivRvSpread}% — ตลาดกำลังกลัวมากเกินจริง Contrarian: ทองอาจ stabilize`
      : compositeSignal === "buy_volatility"
      ? `IV ต่ำกว่า RV — ตลาด underpricing ความเสี่ยง — อาจมี breakout ใหญ่กำลังจะเกิด`
      : `IV ${impliedVol}% vs RV ${rv}% — spread ${ivRvSpread}% อยู่ในระดับปกติ`;

    const data: OptionsFlowPayload = {
      impliedVol, ivPercentile: +ivPct.toFixed(0), ivRank, ivRankTh,
      putCallSentiment, putCallTh, putCallScore: +putCallScore.toFixed(0),
      realizedVol: rv, ivRvSpread, ivRvSignal, ivRvSignalTh,
      termStructure, termStructureTh,
      compositeSignal, compositeSignalTh, compositeColor,
      goldPrice: +gold.toFixed(0), vix: +vixVal.toFixed(1),
      implicationTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
