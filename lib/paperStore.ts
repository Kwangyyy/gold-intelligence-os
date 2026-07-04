// Shared client-side persistence for the Paper Trader account, so multiple
// pages (e.g. the AI Council execution gate and the Paper Trader page) read and
// write the SAME account. Storage key & trade shape match app/paper/page.tsx.

import {
  STARTING_BALANCE,
  calcPnl,
  type PaperAccount,
  type PaperTrade,
  type TradeType,
} from "./paper";

export const PAPER_STORAGE_KEY = "gios.paper.v2";

export function paperGenId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function defaultPaperAccount(): PaperAccount {
  return { balance: STARTING_BALANCE, trades: [] };
}

export function loadPaperAccount(): PaperAccount {
  if (typeof window === "undefined") return defaultPaperAccount();
  try {
    const raw = localStorage.getItem(PAPER_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PaperAccount;
  } catch {
    /* ignore corrupt state */
  }
  return defaultPaperAccount();
}

export function savePaperAccount(acc: PaperAccount): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(acc));
}

// Append a new open trade and persist. Returns the updated account.
export function appendPaperTrade(input: {
  type: TradeType;
  lots: number;
  entryPrice: number;
  sl: number | null;
  tp: number | null;
  note: string;
}): PaperAccount {
  const acc = loadPaperAccount();
  const trade: PaperTrade = {
    id: paperGenId(),
    type: input.type,
    lots: input.lots,
    entryPrice: input.entryPrice,
    sl: input.sl,
    tp: input.tp,
    openedAt: new Date().toISOString(),
    closedAt: null,
    closePrice: null,
    pnl: null,
    closedBy: null,
    note: input.note,
    status: "open",
  };
  const next: PaperAccount = { ...acc, trades: [...acc.trades, trade] };
  savePaperAccount(next);
  return next;
}

// Close every open trade at the given price (manual/emergency close). Returns
// the updated account and how many positions were closed.
export function closeAllOpenPaper(price: number): { account: PaperAccount; closed: number } {
  const acc = loadPaperAccount();
  let balance = acc.balance;
  let closed = 0;
  const trades = acc.trades.map((t) => {
    if (t.status !== "open") return t;
    const pnl = calcPnl(t, price);
    balance += pnl;
    closed++;
    return {
      ...t,
      status: "closed" as const,
      closePrice: price,
      pnl,
      closedAt: new Date().toISOString(),
      closedBy: "manual" as const,
    };
  });
  const next: PaperAccount = { balance: +balance.toFixed(2), trades };
  savePaperAccount(next);
  return { account: next, closed };
}
