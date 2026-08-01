// The real GLD option chain from CBOE, shared by every page that talks about
// option positioning.
//
// Why this file exists: /api/oi-levels already fetched this chain and used it
// correctly, while /api/options-gamma — a Pro feature — *modelled* an option
// chain from the spot price and multiplied it by Math.random(). Two calls
// seconds apart returned 463 and 419 contracts of call OI at the same strike,
// on a closed market. Two gamma features, one real, one invented, and the
// invented one was the paid one.
//
// The fetch lived inside the oi-levels route, and Next.js route modules may
// only export handlers, so it moved here rather than being duplicated.
//
// What this is not: COMEX OG options. CME's chain is login-gated and
// cmegroup.com refuses server-side calls. GLD is the liquid ETF proxy, and its
// strikes are converted to gold-equivalent by the live gold/GLD ratio.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export interface ChainRow {
  expiry: string;   // YYYY-MM-DD
  isCall: boolean;
  strike: number;   // raw GLD strike
  oi: number;
  iv: number;
  gamma: number;    // per-contract gamma from CBOE
}

interface CboeContract {
  option: string;
  iv?: number | null;
  open_interest?: number | null;
  volume?: number | null;
  gamma?: number | null;
}

export interface Chain {
  rows: ChainRow[];
  iv30: number;     // decimal, not percent
  gldClose: number;
  ts: number;
}

async function fetchChain(): Promise<Chain> {
  const r = await fetch("https://cdn.cboe.com/api/global/delayed_quotes/options/GLD.json", {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`CBOE ${r.status}`);
  const j = await r.json();
  const d = j?.data ?? {};
  const gldClose = Number(d.current_price ?? d.close ?? d.prev_day_close ?? 0);
  const iv30 = Number(d.iv30 ?? 0) / 100; // CBOE reports iv30 in percent

  const rows: ChainRow[] = [];
  // OCC symbol: ROOT + YYMMDD + C|P + strike×1000 (8 digits)
  const re = /^([A-Z]+)(\d{6})([CP])(\d{8})$/;
  for (const o of (d.options ?? []) as CboeContract[]) {
    const m = re.exec(o.option ?? "");
    if (!m) continue;
    const [, , ymd, cp, kk] = m;
    rows.push({
      expiry: `20${ymd.slice(0, 2)}-${ymd.slice(2, 4)}-${ymd.slice(4, 6)}`,
      isCall: cp === "C",
      strike: Number(kk) / 1000,
      oi: Number(o.open_interest ?? 0) || 0,
      iv: Number(o.iv ?? 0) || 0,
      gamma: Number(o.gamma ?? 0) || 0,
    });
  }
  if (!rows.length) throw new Error("no contracts parsed");
  return { rows, iv30, gldClose, ts: Date.now() };
}

// The 3.3 MB CBOE chain is itself delayed, so it is cached — but spot is not.
// Everything downstream of spot (expected range, distance from spot, GEX, which
// SD band a strike falls in) is recomputed per request so the numbers track the
// live market rather than whatever price was current when the chain was pulled.
let CHAIN: Chain | null = null;
const CHAIN_TTL = 10 * 60_000;

export async function getOptionChain(): Promise<Chain> {
  if (CHAIN && Date.now() - CHAIN.ts < CHAIN_TTL) return CHAIN;
  try {
    CHAIN = await fetchChain();
    return CHAIN;
  } catch (e) {
    // A stale real chain beats a fresh invented one.
    if (CHAIN) return CHAIN;
    throw e;
  }
}

export const dteOf = (iso: string) =>
  Math.round((Date.parse(`${iso}T21:00:00Z`) - Date.now()) / 86_400_000);

/** Expiries present in the chain, nearest first, with contract counts. */
export function expiriesOf(rows: ChainRow[]): { date: string; dte: number; oi: number }[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.expiry, (by.get(r.expiry) ?? 0) + r.oi);
  return [...by.entries()]
    .map(([date, oi]) => ({ date, dte: dteOf(date), oi }))
    .filter((e) => e.dte >= 0)
    .sort((a, b) => a.dte - b.dte);
}

/**
 * Which expiry to analyse. Shared so the pages cannot drift: reading the same
 * chain but choosing different expiries had oi-levels and options-gamma
 * reporting max pain 33 apart and opposite gamma regimes — real data, still
 * contradicting each other on screen.
 *
 * The nearest expiry with enough open interest to read, not the heaviest.
 * Picking max-OI inside a 7-60 day window kept selecting a ~50-day expiry, and
 * past 50 days the 1SD band widens to roughly ±8%, pushing the walls 25% from
 * spot where price will never test them.
 */
export function chooseExpiry(rows: ChainRow[], wanted = ""): { date: string; dte: number; oi: number } | null {
  const all = expiriesOf(rows).filter((e) => e.oi > 0);
  if (!all.length) return null;
  return (
    all.find((e) => e.date === wanted) ??
    all.find((e) => e.dte >= 5 && e.oi >= 30_000) ??
    all.find((e) => e.dte >= 2 && e.oi >= 20_000) ??
    [...all].sort((a, b) => b.oi - a.oi)[0]
  );
}

/**
 * Max pain: the settlement price at which the least intrinsic value is owed to
 * option holders.
 *
 * Shared because getting the direction backwards is easy and silent — a call is
 * in the money when settlement is *above* its strike, a put when settlement is
 * below. Inverting the two still produces a plausible strike, just the wrong
 * one, and the pages disagreed by $142 before this was one function.
 */
export function maxPainOf(strikes: { strike: number; calls: number; puts: number }[]): number {
  let best = Infinity;
  let at = strikes[0]?.strike ?? 0;
  for (const settle of strikes) {
    let cost = 0;
    for (const s of strikes) {
      if (settle.strike > s.strike) cost += s.calls * (settle.strike - s.strike);
      if (settle.strike < s.strike) cost += s.puts * (s.strike - settle.strike);
    }
    if (cost < best) { best = cost; at = settle.strike; }
  }
  return at;
}

/**
 * Price at which cumulative dealer gamma changes sign, walking strikes low to
 * high. The standard chart-level approximation, not a re-pricing of the book at
 * every spot. Returns `fallback` when the running total never crosses.
 */
export function gammaFlipOf(
  strikes: { strike: number; gex: number }[],
  fallback: number,
): number {
  let running = 0;
  for (const s of [...strikes].sort((a, b) => a.strike - b.strike)) {
    const prev = running;
    running += s.gex;
    if (prev !== 0 && Math.sign(prev) !== Math.sign(running)) return s.strike;
  }
  return fallback;
}
