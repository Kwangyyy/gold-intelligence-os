// In-memory store for MT5 Bridge data. Reset on server restart.
// The MT5 EA pushes data here; the portfolio API reads from here.

export interface MT5Position {
  ticket: number;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  openTime: number; // unix seconds
  comment: string;
}

export interface MT5Account {
  balance: number;
  equity: number;
  floating: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
  positions: MT5Position[];
  server: string;
  account: string;
  lastUpdate: number; // Date.now()
}

const TTL = 5 * 60 * 1000; // 5 min stale threshold

// Use globalThis so the singleton survives Next.js hot-module-reload in dev
declare global {
  // eslint-disable-next-line no-var
  var __mt5Data: MT5Account | null | undefined;
}

function getData(): MT5Account | null {
  return globalThis.__mt5Data ?? null;
}

function setData(v: MT5Account | null): void {
  globalThis.__mt5Data = v;
}

export function setMT5Data(raw: Omit<MT5Account, "lastUpdate">): void {
  setData({ ...raw, lastUpdate: Date.now() });
}

export function getMT5Data(): MT5Account | null {
  const d = getData();
  if (!d) return null;
  if (Date.now() - d.lastUpdate > TTL) { setData(null); return null; }
  return d;
}

export function clearMT5Data(): void {
  setData(null);
}
