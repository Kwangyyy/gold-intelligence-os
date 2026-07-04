// PRD Module I (Risk Manager) → Execution — the gate that turns a Council
// decision into a concrete, risk-sized order plan. Pure & side-effect free.
//
// Closes the Vote → Risk → Order loop:
//   BUY/SELL  → OPEN a position, sized by % risk over an ATR-based stop.
//   REDUCE_LOT→ OPEN but at a reduced lot factor (default ×0.5).
//   CLOSE     → CLOSE_ALL open positions (emergency).
//   WAIT      → NONE (no order).
//
// This only PLANS the order. Actually applying it (paper trader / MT5) is done
// by the caller — never place real-money orders automatically.

import type { Bilingual } from "./types";
import type { CouncilResult } from "./council";
import { computeRisk } from "./risk";

export type OrderAction = "OPEN" | "REDUCE" | "CLOSE_ALL" | "NONE";

export interface OrderPlan {
  action: OrderAction;
  direction: "buy" | "sell" | null;
  entry: number | null;
  sl: number | null;
  takeProfits: number[]; // TP1..TP3 prices (RR 1/2/3)
  lots: number; // final lot size, after any reduction & clamping
  baseLots: number; // lot size before reduction
  lotFactor: number; // 1.0 or the reduce factor
  riskPct: number; // effective % of balance risked
  riskAmount: number; // $ at risk if SL is hit
  slDistance: number; // price distance to SL
  rr: number; // reward:risk to the primary TP
  atrMult: number; // ATR multiple used for the stop
  headline: Bilingual;
  notes: Bilingual[];
}

export interface ExecParams {
  price: number;
  atr: number;
  balance: number;
  riskPct?: number; // default 1%
  atrMult?: number; // stop distance = atrMult × ATR (default 1.5)
  rr?: number; // primary TP reward:risk (default 2)
  reduceFactor?: number; // lot multiplier on REDUCE_LOT (default 0.5)
  minLot?: number;
  maxLot?: number;
}

const round = (n: number, d = 2) => +n.toFixed(d);

function clampLot(lots: number, minLot: number, maxLot: number): number {
  const stepped = Math.round(lots / 0.01) * 0.01;
  return round(Math.max(minLot, Math.min(maxLot, stepped)), 2);
}

export function planExecution(council: CouncilResult, p: ExecParams): OrderPlan {
  const riskPct = p.riskPct ?? 1;
  const atrMult = p.atrMult ?? 1.5;
  const rr = p.rr ?? 2;
  const reduceFactor = p.reduceFactor ?? 0.5;
  const minLot = p.minLot ?? 0.01;
  const maxLot = p.maxLot ?? 10;
  const dec = council.decision;

  const empty = (action: OrderAction, headline: Bilingual, notes: Bilingual[] = []): OrderPlan => ({
    action,
    direction: null,
    entry: null,
    sl: null,
    takeProfits: [],
    lots: 0,
    baseLots: 0,
    lotFactor: 0,
    riskPct: 0,
    riskAmount: 0,
    slDistance: 0,
    rr,
    atrMult,
    headline,
    notes,
  });

  if (dec === "WAIT") {
    return empty(
      "NONE",
      { th: "ไม่ออกไม้ — เสียงโหวตไม่ถึงเกณฑ์ หรือประตูความเสี่ยงไม่ผ่าน", en: "No order — quorum not met or risk gate not passed" },
      [{ th: `โหวตซื้อ ${council.quorum.buy}/6 · ขาย ${council.quorum.sell}/6 (ต้องการ ≥ ${council.quorum.threshold})`, en: `BUY ${council.quorum.buy}/6 · SELL ${council.quorum.sell}/6 (need ≥ ${council.quorum.threshold})` }]
    );
  }

  if (dec === "CLOSE") {
    return empty(
      "CLOSE_ALL",
      { th: "ปิดสถานะทั้งหมด — ผู้จัดการความเสี่ยงสั่งฉุกเฉิน (DD/Margin)", en: "Close all positions — Risk Manager emergency (DD/margin)" },
      council.riskFlags
    );
  }

  // OPEN or REDUCE — determine direction. For BUY/SELL it's explicit; for
  // REDUCE_LOT it follows whichever side carried the (sub-quorum) lean.
  const direction: "buy" | "sell" =
    dec === "BUY" ? "buy" : dec === "SELL" ? "sell" : council.quorum.buy >= council.quorum.sell ? "buy" : "sell";

  const slDistance = round(Math.max(p.atr * atrMult, p.price * 0.001), 2);
  const sl = round(direction === "buy" ? p.price - slDistance : p.price + slDistance, 2);

  const risk = computeRisk({
    balance: p.balance,
    riskPct,
    leverage: 500,
    entry: p.price,
    stopLoss: sl,
    direction,
  });

  const lotFactor = dec === "REDUCE_LOT" ? reduceFactor : 1;
  const baseLots = clampLot(risk.lots, minLot, maxLot);
  const lots = clampLot(risk.lots * lotFactor, minLot, maxLot);
  const takeProfits = risk.takeProfits.map((t) => t.price);
  // Effective $ risk at the final (possibly reduced) lot size.
  const riskAmount = round(lots * 100 * slDistance, 2); // XAUUSD: $100 per lot per $1

  const dirTh = direction === "buy" ? "ซื้อ" : "ขาย";
  const action: OrderAction = dec === "REDUCE_LOT" ? "REDUCE" : "OPEN";

  const headline: Bilingual =
    dec === "REDUCE_LOT"
      ? { th: `เปิด ${dirTh} ขนาดลด (×${reduceFactor}) — ${lots} ล็อต`, en: `Open ${direction.toUpperCase()} reduced (×${reduceFactor}) — ${lots} lots` }
      : { th: `เปิด ${dirTh} — ${lots} ล็อต`, en: `Open ${direction.toUpperCase()} — ${lots} lots` };

  const notes: Bilingual[] = [
    { th: `เสี่ยง ${riskPct}% ของพอร์ต ≈ $${riskAmount} · SL ${atrMult}×ATR = ${slDistance}`, en: `Risk ${riskPct}% ≈ $${riskAmount} · SL ${atrMult}×ATR = ${slDistance}` },
    { th: `Entry ${p.price.toFixed(2)} · SL ${sl.toFixed(2)} · TP ${takeProfits.map((t) => t.toFixed(2)).join(" / ")}`, en: `Entry ${p.price.toFixed(2)} · SL ${sl.toFixed(2)} · TP ${takeProfits.map((t) => t.toFixed(2)).join(" / ")}` },
  ];
  if (dec === "REDUCE_LOT") {
    notes.push({ th: `ขนาดเต็มคือ ${baseLots} ล็อต แต่ถูกลดเพราะข่าว/ความเสี่ยง`, en: `Full size ${baseLots} lots, reduced due to news/risk` });
  }

  return {
    action,
    direction,
    entry: p.price,
    sl,
    takeProfits,
    lots,
    baseLots,
    lotFactor,
    riskPct,
    riskAmount,
    slDistance,
    rr,
    atrMult,
    headline,
    notes,
  };
}
