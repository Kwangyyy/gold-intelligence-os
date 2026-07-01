import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface PositionCalcResult {
  // Inputs echo
  accountSize: number;
  riskPct: number;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number | null;
  takeProfit3: number | null;
  direction: "long" | "short";

  // Core calculations
  riskAmount: number;        // $ risked
  stopPips: number;          // distance entry → SL in points
  lotSize: number;           // standard lots (for gold 1 lot = 100 oz)
  positionSizeOz: number;    // total oz position

  // R:R
  rr1: number;               // R:R to TP1
  rr2: number | null;
  rr3: number | null;
  profitAtTp1: number;       // $ profit at TP1
  profitAtTp2: number | null;
  profitAtTp3: number | null;

  // Max loss / drawdown
  maxLossIfStopped: number;
  breakEvenPrice: number;    // price including spread (approx)

  // Leverage info
  marginRequired: number;    // approximate margin at 1:100 leverage
  leverageUsed: number;      // approximate leverage used

  // Verdict
  verdict: "excellent" | "good" | "acceptable" | "high_risk" | "dangerous";
  verdictTh: string;
  verdictColor: string;

  // Spot price used for reference
  goldSpot: number;
}

async function fetchGoldSpot() {
  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1d&interval=1m",
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (!r.ok) return 3200;
    const j = await r.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3200;
  } catch { return 3200; }
}

// Gold contract: 1 standard lot = 100 troy oz
const OZ_PER_LOT = 100;

function calcPosition(
  accountSize: number,
  riskPct: number,
  entry: number,
  sl: number,
  tp1: number,
  tp2: number | null,
  tp3: number | null,
  direction: "long" | "short"
): Omit<PositionCalcResult, "goldSpot"> {
  const riskAmount = accountSize * (riskPct / 100);
  const stopDist   = Math.abs(entry - sl);
  const positionOz = stopDist > 0 ? riskAmount / stopDist : 0;
  const lots       = positionOz / OZ_PER_LOT;

  const dirMult = direction === "long" ? 1 : -1;

  const profitOz1 = tp1 ? (tp1 - entry) * dirMult * positionOz : 0;
  const profitOz2 = tp2 ? (tp2 - entry) * dirMult * positionOz : null;
  const profitOz3 = tp3 ? (tp3 - entry) * dirMult * positionOz : null;

  const rr1 = tp1 && stopDist > 0 ? +((Math.abs(tp1 - entry) / stopDist)).toFixed(2) : 0;
  const rr2 = tp2 && stopDist > 0 ? +((Math.abs(tp2 - entry) / stopDist)).toFixed(2) : null;
  const rr3 = tp3 && stopDist > 0 ? +((Math.abs(tp3 - entry) / stopDist)).toFixed(2) : null;

  // Margin: notional / leverage (1:100)
  const notional      = positionOz * entry;
  const marginRequired = notional / 100;
  const leverageUsed  = accountSize > 0 ? +(notional / accountSize).toFixed(1) : 0;

  // Verdict
  let verdict: PositionCalcResult["verdict"];
  let verdictTh: string;
  if      (rr1 >= 3 && riskPct <= 1)  { verdict = "excellent"; verdictTh = "ยอดเยี่ยม — R:R ≥ 3:1, Risk ≤ 1%"; }
  else if (rr1 >= 2 && riskPct <= 2)  { verdict = "good";      verdictTh = "ดี — R:R ≥ 2:1, Risk ≤ 2%"; }
  else if (rr1 >= 1.5 && riskPct <= 3){ verdict = "acceptable";verdictTh = "พอรับได้ — R:R ≥ 1.5:1"; }
  else if (riskPct > 3)               { verdict = "high_risk"; verdictTh = "เสี่ยงสูง — Risk > 3% ต่อเทรด"; }
  else                                 { verdict = "dangerous"; verdictTh = "อันตราย — R:R ต่ำมาก / SL แคบ"; }

  const verdictColor = { excellent: "#34d399", good: "#86efac", acceptable: "#f5c451", high_risk: "#f97316", dangerous: "#f87171" }[verdict];

  return {
    accountSize, riskPct, entry: +entry.toFixed(2), stopLoss: +sl.toFixed(2),
    takeProfit1: +tp1.toFixed(2), takeProfit2: tp2 ? +tp2.toFixed(2) : null, takeProfit3: tp3 ? +tp3.toFixed(2) : null,
    direction, riskAmount: +riskAmount.toFixed(2),
    stopPips: +stopDist.toFixed(2), lotSize: +lots.toFixed(3), positionSizeOz: +positionOz.toFixed(3),
    rr1, rr2, rr3,
    profitAtTp1: +profitOz1.toFixed(2), profitAtTp2: profitOz2 != null ? +profitOz2.toFixed(2) : null, profitAtTp3: profitOz3 != null ? +profitOz3.toFixed(2) : null,
    maxLossIfStopped: +(-riskAmount).toFixed(2),
    breakEvenPrice: direction === "long" ? +(entry + 0.5).toFixed(2) : +(entry - 0.5).toFixed(2),
    marginRequired: +marginRequired.toFixed(2), leverageUsed,
    verdict, verdictTh, verdictColor,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p   = url.searchParams;

  const accountSize = +(p.get("account") ?? "10000");
  const riskPct     = +(p.get("risk")    ?? "1");
  const entry       = +(p.get("entry")   ?? "0");
  const sl          = +(p.get("sl")      ?? "0");
  const tp1         = +(p.get("tp1")     ?? "0");
  const tp2         = p.get("tp2") ? +(p.get("tp2")!) : null;
  const tp3         = p.get("tp3") ? +(p.get("tp3")!) : null;
  const direction   = (p.get("dir") ?? "long") as "long" | "short";

  const goldSpot = await fetchGoldSpot();

  const useEntry = entry > 0 ? entry : goldSpot;
  const useSl    = sl    > 0 ? sl    : (direction === "long" ? goldSpot * 0.99 : goldSpot * 1.01);
  const useTp1   = tp1   > 0 ? tp1   : (direction === "long" ? goldSpot * 1.02 : goldSpot * 0.98);

  const result = calcPosition(accountSize, riskPct, useEntry, useSl, useTp1, tp2, tp3, direction);
  return NextResponse.json({ ...result, goldSpot: +goldSpot.toFixed(0) });
}
