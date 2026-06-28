// Risk Management calculations (Module 12). Pure, client-safe math for XAUUSD.
//
// Contract assumptions (standard retail XAUUSD):
//   1 lot = 100 oz, so a $1 move in price = $100 P/L per lot.
// Account currency assumed USD.

export const CONTRACT_OZ = 100; // oz per standard lot
export const USD_PER_DOLLAR_MOVE_PER_LOT = CONTRACT_OZ; // $100 per $1 move per lot

export type RiskLabel = "low" | "medium" | "high" | "extreme" | "do_not_trade";

export interface RiskInputs {
  balance: number;
  riskPct: number; // % of balance risked on this trade
  leverage: number;
  entry: number;
  stopLoss: number; // price
  direction: "buy" | "sell";
}

export interface RiskResult {
  riskAmount: number; // $ risked
  slDistance: number; // price distance to SL
  lots: number; // recommended lot size
  units: number; // oz
  notional: number; // position value in $
  margin: number; // required margin in $
  marginPct: number; // margin as % of balance
  potentialLoss: number; // $ loss if SL hit (≈ riskAmount)
  takeProfits: { rr: number; price: number; reward: number }[];
  valid: boolean;
}

const round = (n: number, d = 2) => +n.toFixed(d);

export function computeRisk(i: RiskInputs): RiskResult {
  const riskAmount = (i.balance * i.riskPct) / 100;
  const slDistance = Math.abs(i.entry - i.stopLoss);
  const valid = slDistance > 0 && i.balance > 0 && i.entry > 0 && i.leverage > 0;

  const rawLots = valid ? riskAmount / (slDistance * USD_PER_DOLLAR_MOVE_PER_LOT) : 0;
  const lots = round(Math.max(0, rawLots), 2);
  const units = lots * CONTRACT_OZ;
  const notional = units * i.entry;
  const margin = i.leverage > 0 ? notional / i.leverage : 0;
  const marginPct = i.balance > 0 ? (margin / i.balance) * 100 : 0;
  const potentialLoss = lots * USD_PER_DOLLAR_MOVE_PER_LOT * slDistance;

  const sign = i.direction === "buy" ? 1 : -1;
  const takeProfits = [1, 2, 3].map((rr) => ({
    rr,
    price: round(i.entry + sign * rr * slDistance),
    reward: round(lots * USD_PER_DOLLAR_MOVE_PER_LOT * rr * slDistance),
  }));

  return {
    riskAmount: round(riskAmount),
    slDistance: round(slDistance),
    lots,
    units: round(units),
    notional: round(notional),
    margin: round(margin),
    marginPct: round(marginPct, 1),
    potentialLoss: round(potentialLoss),
    takeProfits,
    valid,
  };
}

// Trade-level risk label, escalated by margin usage and imminent news.
export function riskLabel(riskPct: number, marginPct: number, newsWarning: boolean): RiskLabel {
  if (newsWarning) return "do_not_trade";
  if (riskPct > 6 || marginPct > 90) return "extreme";
  if (riskPct > 3.5 || marginPct > 60) return "high";
  if (riskPct > 2) return "medium";
  return "low";
}

// Portfolio heat = total % of balance at risk across concurrent trades.
export function portfolioHeat(riskPctPerTrade: number, openTrades: number): { heat: number; label: RiskLabel } {
  const heat = round(riskPctPerTrade * Math.max(0, openTrades), 1);
  let label: RiskLabel;
  if (heat > 12) label = "extreme";
  else if (heat > 8) label = "high";
  else if (heat > 4) label = "medium";
  else label = "low";
  return { heat, label };
}

// Volatility-based suggestion: SL should respect ATR. Returns a recommended SL
// distance (>= multiple of ATR) and the lot size that keeps the same $ risk.
export function volatilityAdjustment(
  atr: number,
  slDistance: number,
  riskAmount: number,
  atrMultiple = 1.5
): { recommendedSlDistance: number; recommendedLots: number; tooTight: boolean } {
  const recommendedSlDistance = round(Math.max(slDistance, atr * atrMultiple), 2);
  const recommendedLots =
    recommendedSlDistance > 0 ? round(riskAmount / (recommendedSlDistance * USD_PER_DOLLAR_MOVE_PER_LOT), 2) : 0;
  const tooTight = atr > 0 && slDistance < atr; // SL inside one ATR = likely noise stop-out
  return { recommendedSlDistance, recommendedLots, tooTight };
}
