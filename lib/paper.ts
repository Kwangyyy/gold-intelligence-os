// Paper Trader — types and pure calculation utilities. No side effects.

export type TradeType   = "buy" | "sell";
export type TradeStatus = "open" | "closed";
export type ClosedBy    = "manual" | "sl" | "tp";

export interface PaperTrade {
  id: string;
  type: TradeType;
  lots: number;
  entryPrice: number;
  sl: number | null;
  tp: number | null;
  openedAt: string;
  closedAt: string | null;
  closePrice: number | null;
  pnl: number | null;      // realized P&L USD
  closedBy: ClosedBy | null;
  note: string;
  status: TradeStatus;
}

export interface PaperAccount {
  balance: number;
  trades: PaperTrade[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
// XAUUSD: 1 standard lot = 100 oz. $1 price move × 1 lot = $100 P&L.
export const STARTING_BALANCE      = 10_000;
export const PNL_PER_LOT_PER_USD   = 100;    // USD per lot per $1 price move
export const MARGIN_PER_LOT        = 400;     // USD margin per standard lot (~1:500 leverage approx)
export const MIN_LOT               = 0.01;
export const MAX_LOT               = 10;
export const LOT_STEP              = 0.01;

// ── Calculations ──────────────────────────────────────────────────────────────

export function calcPnl(trade: PaperTrade, currentPrice: number): number {
  const dir = trade.type === "buy" ? 1 : -1;
  return parseFloat((dir * (currentPrice - trade.entryPrice) * trade.lots * PNL_PER_LOT_PER_USD).toFixed(2));
}

export function calcMargin(lots: number): number {
  return parseFloat((lots * MARGIN_PER_LOT).toFixed(2));
}

export function calcRisk(entryPrice: number, sl: number, lots: number, type: TradeType): number {
  const dir = type === "buy" ? 1 : -1;
  return parseFloat((dir * (sl - entryPrice) * lots * PNL_PER_LOT_PER_USD).toFixed(2)); // negative = loss
}

export function calcReward(entryPrice: number, tp: number, lots: number, type: TradeType): number {
  const dir = type === "buy" ? 1 : -1;
  return parseFloat((dir * (tp - entryPrice) * lots * PNL_PER_LOT_PER_USD).toFixed(2));
}

export function suggestTp(entry: number, sl: number, type: TradeType, rr: number): number {
  const slDist = Math.abs(entry - sl);
  return type === "buy"
    ? parseFloat((entry + slDist * rr).toFixed(2))
    : parseFloat((entry - slDist * rr).toFixed(2));
}

// Returns "sl" | "tp" | null based on whether current price has triggered a level
export function checkSLTP(trade: PaperTrade, price: number): ClosedBy | null {
  if (trade.type === "buy") {
    if (trade.sl !== null && price <= trade.sl) return "sl";
    if (trade.tp !== null && price >= trade.tp) return "tp";
  } else {
    if (trade.sl !== null && price >= trade.sl) return "sl";
    if (trade.tp !== null && price <= trade.tp) return "tp";
  }
  return null;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface AccountSnapshot {
  equity: number;
  floatingPnl: number;
  usedMargin: number;
  freeMargin: number;
  drawdownPct: number;
}

export interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
}

export function calcSnapshot(account: PaperAccount, price: number): AccountSnapshot {
  const open        = account.trades.filter(t => t.status === "open");
  const floatingPnl = open.reduce((s, t) => s + calcPnl(t, price), 0);
  const usedMargin  = open.reduce((s, t) => s + calcMargin(t.lots), 0);
  const equity      = account.balance + floatingPnl;
  const freeMargin  = equity - usedMargin;
  const drawdownPct = account.balance < STARTING_BALANCE
    ? ((account.balance - STARTING_BALANCE) / STARTING_BALANCE) * 100
    : 0;
  return {
    equity:       parseFloat(equity.toFixed(2)),
    floatingPnl:  parseFloat(floatingPnl.toFixed(2)),
    usedMargin:   parseFloat(usedMargin.toFixed(2)),
    freeMargin:   parseFloat(freeMargin.toFixed(2)),
    drawdownPct:  parseFloat(drawdownPct.toFixed(2)),
  };
}

// ── Equity Curve ──────────────────────────────────────────────────────────────

export interface EquityPoint {
  index: number;
  date: string;
  equity: number;
  pnl: number;
}

export function calcEquityCurve(initialBalance: number, trades: PaperTrade[]): EquityPoint[] {
  const closed = trades
    .filter(t => t.status === "closed" && t.pnl !== null && t.closedAt !== null)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());
  let equity = initialBalance;
  return closed.map((t, i) => {
    equity += t.pnl!;
    return { index: i, date: t.closedAt!, equity: parseFloat(equity.toFixed(2)), pnl: t.pnl! };
  });
}

export function calcMaxDrawdown(initialBalance: number, trades: PaperTrade[]): { maxDrawdown: number; maxDrawdownPct: number } {
  const curve = calcEquityCurve(initialBalance, trades);
  if (curve.length === 0) return { maxDrawdown: 0, maxDrawdownPct: 0 };
  let peak = initialBalance;
  let maxDD = 0;
  for (const p of curve) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak - p.equity;
    if (dd > maxDD) maxDD = dd;
  }
  return { maxDrawdown: parseFloat(maxDD.toFixed(2)), maxDrawdownPct: parseFloat(((maxDD / initialBalance) * 100).toFixed(1)) };
}

export function calcStreak(trades: PaperTrade[]): { streak: number; type: "win" | "loss" | "none" } {
  const closed = trades
    .filter(t => t.status === "closed" && t.pnl !== null)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());
  if (closed.length === 0) return { streak: 0, type: "none" };
  const lastWin = closed[closed.length - 1].pnl! > 0;
  const type: "win" | "loss" = lastWin ? "win" : "loss";
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if ((closed[i].pnl! > 0) === lastWin) streak++;
    else break;
  }
  return { streak, type };
}

export function calcTradeStats(trades: PaperTrade[]): TradeStats {
  const closed  = trades.filter(t => t.status === "closed" && t.pnl !== null);
  const pnls    = closed.map(t => t.pnl!);
  const wins    = pnls.filter(p => p > 0);
  const losses  = pnls.filter(p => p <= 0);
  const grossW  = wins.reduce((s, v) => s + v, 0);
  const grossL  = Math.abs(losses.reduce((s, v) => s + v, 0));
  return {
    totalTrades:  closed.length,
    wins:         wins.length,
    losses:       losses.length,
    winRate:      closed.length ? parseFloat(((wins.length / closed.length) * 100).toFixed(1)) : 0,
    avgWin:       wins.length   ? parseFloat((grossW / wins.length).toFixed(2))   : 0,
    avgLoss:      losses.length ? parseFloat((-grossL / losses.length).toFixed(2)): 0,
    profitFactor: grossL > 0 ? parseFloat((grossW / grossL).toFixed(2)) : grossW > 0 ? 99 : 0,
    totalPnl:     parseFloat(pnls.reduce((s, v) => s + v, 0).toFixed(2)),
    bestTrade:    pnls.length ? parseFloat(Math.max(...pnls).toFixed(2)) : 0,
    worstTrade:   pnls.length ? parseFloat(Math.min(...pnls).toFixed(2)) : 0,
  };
}
