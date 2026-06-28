// Trade Journal — pure client-side, persisted to localStorage as "gios.journal".

export type TradeDirection = "buy" | "sell";
export type TradeSetup = "smc" | "sr" | "breakout" | "trend" | "news" | "pattern" | "other";
export type TradeResult = "win" | "loss" | "breakeven" | "running";

export interface TradeEntry {
  id: string;
  symbol: string; // "XAUUSD"
  direction: TradeDirection;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  lotSize: number;
  openTime: string; // ISO
  closeTime?: string; // ISO
  setup: TradeSetup;
  notes: string;
  pnlUSD: number | null; // null = running
  rr: number | null;
  result: TradeResult;
}

export interface JournalStats {
  totalTrades: number;
  closedTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number; // %
  avgRR: number;
  totalPnL: number;
  maxDrawdown: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  equityCurve: number[]; // cumulative P&L after each closed trade
}

// XAUUSD: 1 lot = 100 oz.  P&L = direction × (exit - entry) × lots × 100
export function calcPnL(direction: TradeDirection, entry: number, exit: number, lots: number): number {
  const pip = direction === "buy" ? exit - entry : entry - exit;
  return +(pip * lots * 100).toFixed(2);
}

export function calcRR(direction: TradeDirection, entry: number, sl: number, tp: number): number {
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk === 0) return 0;
  return +(reward / risk).toFixed(2);
}

export function resolveResult(pnl: number | null, sl?: number, tp?: number, exit?: number): TradeResult {
  if (pnl === null) return "running";
  if (Math.abs(pnl) < 0.01) return "breakeven";
  return pnl > 0 ? "win" : "loss";
}

export function computeTrade(
  draft: Omit<TradeEntry, "id" | "pnlUSD" | "rr" | "result">
): Omit<TradeEntry, "id"> {
  let pnlUSD: number | null = null;
  let rr: number | null = null;

  if (draft.exitPrice != null) {
    pnlUSD = calcPnL(draft.direction, draft.entryPrice, draft.exitPrice, draft.lotSize);
  }
  if (draft.stopLoss != null && draft.takeProfit != null) {
    rr = calcRR(draft.direction, draft.entryPrice, draft.stopLoss, draft.takeProfit);
  } else if (draft.stopLoss != null && draft.exitPrice != null) {
    // Use actual exit as reward proxy
    const risk = Math.abs(draft.entryPrice - draft.stopLoss) * draft.lotSize * 100;
    if (risk > 0 && pnlUSD !== null) rr = +(Math.abs(pnlUSD) / risk).toFixed(2);
  }

  return { ...draft, pnlUSD, rr, result: resolveResult(pnlUSD, draft.stopLoss, draft.takeProfit, draft.exitPrice) };
}

export function computeStats(trades: TradeEntry[]): JournalStats {
  const closed = trades.filter((t) => t.result !== "running");
  const wins = closed.filter((t) => t.result === "win");
  const losses = closed.filter((t) => t.result === "loss");
  const bes = closed.filter((t) => t.result === "breakeven");

  const grossProfit = wins.reduce((s, t) => s + (t.pnlUSD ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnlUSD ?? 0), 0));
  const totalPnL = closed.reduce((s, t) => s + (t.pnlUSD ?? 0), 0);

  const rrs = closed.filter((t) => t.rr !== null).map((t) => t.rr as number);
  const avgRR = rrs.length ? +(rrs.reduce((s, r) => s + r, 0) / rrs.length).toFixed(2) : 0;

  // Equity curve & max drawdown
  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  const equityCurve: number[] = [];
  for (const t of closed) {
    cum += t.pnlUSD ?? 0;
    equityCurve.push(+cum.toFixed(2));
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }

  const pnls = closed.map((t) => t.pnlUSD ?? 0);

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    winCount: wins.length,
    lossCount: losses.length,
    breakevenCount: bes.length,
    winRate: closed.length ? +((wins.length / closed.length) * 100).toFixed(1) : 0,
    avgRR,
    totalPnL: +totalPnL.toFixed(2),
    maxDrawdown: +maxDD.toFixed(2),
    profitFactor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 99 : 0,
    bestTrade: pnls.length ? +Math.max(...pnls).toFixed(2) : 0,
    worstTrade: pnls.length ? +Math.min(...pnls).toFixed(2) : 0,
    equityCurve,
  };
}

// localStorage helpers
const KEY = "gios.journal";

export function loadTrades(): TradeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as TradeEntry[];
  } catch {
    return [];
  }
}

export function saveTrades(trades: TradeEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(trades));
}

export function exportCSV(trades: TradeEntry[]): void {
  const headers = ["ID", "Date", "Symbol", "Direction", "Setup", "Entry", "Exit", "SL", "TP", "Lots", "P&L (USD)", "R:R", "Result", "Notes"];
  const rows = trades.map((t) => [
    t.id.slice(0, 8),
    t.openTime.slice(0, 10),
    t.symbol,
    t.direction,
    t.setup,
    t.entryPrice,
    t.exitPrice ?? "",
    t.stopLoss ?? "",
    t.takeProfit ?? "",
    t.lotSize,
    t.pnlUSD ?? "",
    t.rr ?? "",
    t.result,
    `"${t.notes.replace(/"/g, "'")}"`,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trade-journal-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
