// Does the signal strategy make money?
//
// The live signal log answers this at one trade every few days, and only when
// somebody opens the page — six signals in thirty-four days, four of them
// settled. Twenty settled trades, the point at which a win rate starts meaning
// anything, arrives some time in 2027. That is too slow to learn from.
//
// So the strategy is replayed over history instead. Every H1 bar, the same
// features are computed from the bars before it, the same function that ships
// decides, and the result is settled against the bars that followed.
//
// What this does NOT test: the Gemini path. Every signal in the live log came
// from the LLM, which cannot be re-run bar by bar over months. What is measured
// here is the deterministic strategy that ships as the fallback, reading the
// same feature set the LLM is handed. That is a floor and a comparison, not the
// whole system, and the numbers below should not be described as anything else.
//
//   npx tsx scripts/backtestStrategy.mts [costPerTrade] [timeframe]

import { getGoldCandles } from "../lib/goldSource";
import { emaSeries, rsi, macd, atr } from "../lib/indicators";
import { ruleBasedSetup } from "../lib/gemini";

// Gold spreads run a few tens of cents; a strategy that only works at zero cost
// does not work. Passed as an argument so the sensitivity is visible rather than
// buried in an assumption.
const COST = Number(process.argv[2] ?? 0.35);

// H1 reaches back about seven months at the 5,000-bar ceiling — one market
// regime, which is not enough to call anything an edge. 4H reaches years, and a
// rule that only works on one timeframe is usually a rule that fits noise.
const TF = (process.argv[3] ?? "1h") as "1h" | "4h" | "1d";
const BARS_PER_DAY = TF === "1h" ? 24 : TF === "4h" ? 6 : 1;

const WARMUP = 60;          // enough for EMA50, MACD(12,26,9) and ATR(14)
const EXPIRY_BARS = BARS_PER_DAY * 14; // the live settler gives a trade fourteen days

interface Trade {
  dir: "buy" | "sell";
  entryIdx: number;
  entry: number;
  sl: number;
  tp: number;
  exitIdx: number;
  exit: number;
  outcome: "tp" | "sl" | "expired";
  points: number;
  ambiguous: boolean;
}

const bars = await getGoldCandles(TF, 5000, false);
const n = bars.c.length;
console.log(`replaying ${n} ${TF.toUpperCase()} bars — ${new Date(bars.t[0] * 1000).toISOString().slice(0, 10)} to ${new Date(bars.t[n - 1] * 1000).toISOString().slice(0, 10)}`);
console.log(`cost assumed: ${COST.toFixed(2)} points per trade (spread + slippage)\n`);

const candles = bars.t.map((t, i) => ({
  time: t, open: bars.o[i], high: bars.h[i], low: bars.l[i], close: bars.c[i],
}));

const trades: Trade[] = [];
let waits = 0;
let openUntil = -1;   // no overlapping positions: one trade at a time

for (let i = WARMUP; i < n - 1; i++) {
  // A position is still running; the live system would not stack another.
  if (i <= openUntil) continue;

  // Only data up to and including bar i. Anything beyond is the future.
  const closes = bars.c.slice(0, i + 1);
  const window = candles.slice(0, i + 1);
  const price = closes[closes.length - 1];

  const setup = ruleBasedSetup({
    price,
    ema20: emaSeries(closes, 20).at(-1) ?? price,
    ema50: emaSeries(closes, 50).at(-1) ?? price,
    rsi: rsi(closes, 14) ?? 50,
    macdHist: macd(closes, 12, 26, 9)?.histogram ?? 0,
    atr: atr(window, 14) ?? 10,
  });

  if (setup.direction === "wait") { waits++; continue; }
  const dir = setup.direction as "buy" | "sell";
  const long = dir === "buy";

  // Entry at the close of bar i, so settlement starts at bar i+1. Starting at i
  // would let the bar that triggered the signal also resolve it, using a high
  // and low that had already printed when the decision was made.
  let settled: Trade | null = null;
  for (let j = i + 1; j < n; j++) {
    const hitSl = long ? bars.l[j] <= setup.sl : bars.h[j] >= setup.sl;
    const hitTp = long ? bars.h[j] >= setup.tp1 : bars.l[j] <= setup.tp1;

    // Both inside one bar: an OHLC series cannot say which came first, so the
    // stop is assumed. Counting these as wins is how a backtest flatters itself.
    if (hitSl) {
      settled = {
        dir, entryIdx: i, entry: price, sl: setup.sl, tp: setup.tp1,
        exitIdx: j, exit: setup.sl, outcome: "sl",
        points: (long ? setup.sl - price : price - setup.sl) - COST,
        ambiguous: hitTp,
      };
      break;
    }
    if (hitTp) {
      settled = {
        dir, entryIdx: i, entry: price, sl: setup.sl, tp: setup.tp1,
        exitIdx: j, exit: setup.tp1, outcome: "tp",
        points: (long ? setup.tp1 - price : price - setup.tp1) - COST,
        ambiguous: false,
      };
      break;
    }
    if (j - i >= EXPIRY_BARS) {
      settled = {
        dir, entryIdx: i, entry: price, sl: setup.sl, tp: setup.tp1,
        exitIdx: j, exit: bars.c[j], outcome: "expired",
        points: (long ? bars.c[j] - price : price - bars.c[j]) - COST,
        ambiguous: false,
      };
      break;
    }
  }
  if (!settled) break;   // ran out of history; an unfinished trade is not a result
  trades.push(settled);
  openUntil = settled.exitIdx;
}

// ── results ─────────────────────────────────────────────────────────────────
const wins = trades.filter((t) => t.outcome === "tp");
const losses = trades.filter((t) => t.outcome === "sl");
const expired = trades.filter((t) => t.outcome === "expired");
const ambiguous = trades.filter((t) => t.ambiguous);
const total = trades.reduce((s, t) => s + t.points, 0);
const grossWin = trades.filter((t) => t.points > 0).reduce((s, t) => s + t.points, 0);
const grossLoss = Math.abs(trades.filter((t) => t.points < 0).reduce((s, t) => s + t.points, 0));

// Worst peak-to-trough on the equity curve. A strategy with a good average and a
// drawdown nobody could sit through is not tradeable.
let peak = 0, equity = 0, maxDd = 0;
for (const t of trades) {
  equity += t.points;
  peak = Math.max(peak, equity);
  maxDd = Math.max(maxDd, peak - equity);
}

const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) + "%" : "—");
const avg = (list: Trade[]) => (list.length ? list.reduce((s, t) => s + t.points, 0) / list.length : 0);

console.log(`  bars where it waited : ${waits}`);
console.log(`  trades taken         : ${trades.length}`);
console.log(`  won / lost / expired : ${wins.length} / ${losses.length} / ${expired.length}`);
console.log(`  win rate             : ${pct(wins.length, trades.length)}`);
console.log(`  same-bar SL+TP       : ${ambiguous.length} (counted as losses)`);
console.log();
console.log(`  average win          : ${avg(wins).toFixed(1)} points`);
console.log(`  average loss         : ${avg(losses).toFixed(1)} points`);
console.log(`  expectancy per trade : ${(total / Math.max(1, trades.length)).toFixed(2)} points`);
console.log(`  total                : ${total.toFixed(1)} points`);
console.log(`  profit factor        : ${grossLoss ? (grossWin / grossLoss).toFixed(2) : "—"}`);
console.log(`  max drawdown         : ${maxDd.toFixed(1)} points`);
console.log();

// The honest comparison. A strategy has to beat doing nothing clever, and over a
// period when gold rose steeply, "always long" is a hard baseline to beat.
const first = bars.c[WARMUP], last = bars.c[n - 1];
console.log(`  buy and hold over the same window: ${(last - first).toFixed(1)} points`);

// Split into thirds. A strategy that only works in one stretch is a strategy
// that fitted that stretch, and the average across the whole window hides it.
if (trades.length >= 30) {
  console.log("\n  by period (equal thirds of the trade sequence):");
  const third = Math.ceil(trades.length / 3);
  for (let k = 0; k < 3; k++) {
    const slice = trades.slice(k * third, (k + 1) * third);
    if (!slice.length) continue;
    const p = slice.reduce((s2, t) => s2 + t.points, 0);
    const w = slice.filter((t) => t.outcome === "tp").length;
    const from = new Date(bars.t[slice[0].entryIdx] * 1000).toISOString().slice(0, 10);
    const to = new Date(bars.t[slice[slice.length - 1].exitIdx] * 1000).toISOString().slice(0, 10);
    const sign = p >= 0 ? "+" : "";
    console.log(`    ${from} → ${to}  ${String(slice.length).padStart(3)} trades  ${pct(w, slice.length).padStart(6)} won  ${sign}${p.toFixed(0)} points`);
  }
}

const positiveThirds = (() => {
  if (trades.length < 30) return 0;
  const third = Math.ceil(trades.length / 3);
  let c = 0;
  for (let k = 0; k < 3; k++) {
    const slice = trades.slice(k * third, (k + 1) * third);
    if (slice.length && slice.reduce((s2, t) => s2 + t.points, 0) > 0) c++;
  }
  return c;
})();

// The headline number is the one most likely to mislead. A total carried by a
// single stretch is a fitted result, and reporting only "positive over N trades"
// would hide exactly what the split above exists to reveal.
const pf = grossLoss ? grossWin / grossLoss : Infinity;
const verdict =
  trades.length < 30
    ? `\n  ${trades.length} trades is too few to conclude from.`
    : total <= 0
    ? `\n  Negative over ${trades.length} trades. This strategy lost money on this data.`
    : positiveThirds < 3
    ? `\n  Positive overall (profit factor ${pf.toFixed(2)}) but only ${positiveThirds} of 3 periods\n  were positive — the total is carried by part of the window, not by an edge\n  that held throughout. Treat this as unproven.`
    : pf > 1.2
    ? `\n  Positive over ${trades.length} trades, profit factor ${pf.toFixed(2)}, and positive\n  in all three periods.`
    : `\n  Positive in all three periods but at profit factor ${pf.toFixed(2)} — close enough\n  to 1 that costs or a different window could erase it.`;
console.log(verdict);
console.log(`  Deterministic fallback only — the Gemini path is not measured here.`);
