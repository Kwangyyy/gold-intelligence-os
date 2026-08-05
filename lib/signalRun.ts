// Emit a signal on a clock, not when somebody happens to open a page.
//
// Six signals in thirty-four days, and the gaps between them were gaps between
// visits — nobody was measuring the strategy, they were measuring browsing
// habits. A sample collected that way cannot be compared with anything, least
// of all with a backtest that replays every bar.
//
// So signals are logged on a fixed cadence, under the same rule the backtest
// uses: one position at a time. That makes the live record and the historical
// one measure the same policy, which is the only way the two numbers can be put
// side by side.

import { fetchCandlesForTf } from "./timeframes";
import { emaSeries, rsi, macd, atr } from "./indicators";
import { generateTradeStrategy, geminiEnabled } from "./gemini";
import { logSignal, getSignals } from "./signalLog";
import { kvGet, kvSet } from "./kvStore";

// The strategy reads H1 bars, so a new decision is only meaningful once a new
// bar has closed. Faster would sample the same bar repeatedly and call it more
// evidence; slower would miss bars.
const EVERY_MS = 60 * 60_000;
const LAST_KEY = "gios:signal:last-run";

export interface ScheduledResult {
  ran: boolean;
  reason: string;
  direction?: string;
  confidence?: number;
}

/**
 * Log one signal if it is time and no position is open.
 *
 * The open-position rule matters more than it looks. Without it a trending
 * market produces a signal every hour, all of them the same trade, and the
 * record fills with correlated duplicates that make a single good run look like
 * a hundred wins.
 */
export async function runScheduledSignal(force = false): Promise<ScheduledResult> {
  const last = await kvGet<number>(LAST_KEY);
  if (!force && last != null && Date.now() - last < EVERY_MS) {
    return { ran: false, reason: `waiting — ${Math.ceil((EVERY_MS - (Date.now() - last)) / 60_000)} min to the next bar` };
  }

  // A trade is still running. "wait" calls are not trades and do not block.
  const recent = await getSignals(20);
  const open = recent.find((s) => s.direction !== "wait" && s.outcome === "pending");
  if (open && !force) {
    await kvSet(LAST_KEY, Date.now(), Math.ceil(EVERY_MS / 1000));
    return { ran: false, reason: "a position from an earlier signal is still open" };
  }

  const h1 = await fetchCandlesForTf("H1");
  if (h1.length < 60) return { ran: false, reason: "insufficient H1 data" };

  const closes = h1.map((c) => c.close);
  const price = closes[closes.length - 1];
  const recent30 = h1.slice(-30);

  const setup = await generateTradeStrategy({
    price,
    ema20: emaSeries(closes, 20).at(-1) ?? price,
    ema50: emaSeries(closes, 50).at(-1) ?? price,
    rsi: rsi(closes, 14) ?? 50,
    macdHist: macd(closes, 12, 26, 9)?.histogram ?? 0,
    atr: atr(h1, 14) ?? 10,
    support: [...recent30.map((c) => c.low)].sort((a, b) => a - b).slice(0, 3),
    resistance: [...recent30.map((c) => c.high)].sort((a, b) => b - a).slice(0, 3),
    recentCandles: h1.slice(-10).map((c) => ({ h: c.high, l: c.low, c: c.close })),
  });

  // "wait" is recorded too. Dropping it would leave a log of the times the
  // strategy had an opinion and none of the times it did not, which reads as a
  // strategy that always has one.
  await logSignal({
    symbol: "XAUUSD",
    direction: setup.direction,
    confidence: setup.confidence,
    setupType: setup.setupType,
    entry: setup.entry,
    sl: setup.sl,
    tp1: setup.tp1,
    tp2: setup.tp2,
    rr1: setup.rr1,
    source: geminiEnabled() ? "gemini" : "rule",
  });

  await kvSet(LAST_KEY, Date.now(), Math.ceil(EVERY_MS / 1000));
  return { ran: true, reason: "logged", direction: setup.direction, confidence: setup.confidence };
}
