// Did the signal work?
//
// The log recorded entry, stop and target for every signal and then never went
// back to look. Six signals, every one of them "pending", the oldest from five
// weeks earlier. An app with a hundred and sixty analysis pages had no evidence
// that any of it was right.
//
// This walks the price that actually printed after each signal and settles it.

import { getGoldCandles } from "./goldSource";
import { getSignals, updateOutcome, type SignalEntry, type SignalOutcome } from "./signalLog";

// 15-minute bars: fine enough that stop and target rarely fall in the same bar,
// and 5,000 of them still reach back about seven weeks — further than any signal
// in the log. Hourly bars would triple the ambiguous cases below.
const RESOLVE_TF = "15m" as const;
const RESOLVE_BARS = 5000;

/**
 * A signal nobody closed is not a winner.
 *
 * Left running forever, an open trade quietly flatters the record: losses get
 * marked and winners get marked, while the ones that went nowhere stay
 * "pending" and are excluded from every statistic. Fourteen days is the point
 * at which a setup built on a 4H chart has stopped being the setup that was
 * described, so it is reported as expired and counted — at whatever it was
 * worth when time ran out.
 */
const EXPIRY_DAYS = 14;

export interface Resolved {
  id: string;
  outcome: SignalOutcome | "expired";
  pnlPips: number;
  bars: number;              // bars from signal to settlement
  ambiguous: boolean;        // stop and target inside one bar
}

/**
 * Settle one signal against the bars that followed it.
 *
 * `ambiguous` is the honest part. When a bar's high reaches the target and its
 * low reaches the stop, an OHLC series cannot say which came first — the bar
 * only records that both happened. Assuming the good one is how a backtest
 * quietly turns losses into wins, so the stop is assumed and the case is
 * flagged, both in the returned record and in the rate reported alongside it.
 */
export function settle(
  s: SignalEntry,
  bars: { t: number[]; h: number[]; l: number[]; c: number[] },
): Resolved | null {
  // "wait" is advice not to trade. It has no result and counting it either way
  // would be inventing one.
  if (s.direction === "wait") return null;

  const long = s.direction === "buy";
  const start = bars.t.findIndex((t) => t * 1000 >= s.ts);
  if (start < 0) return null;

  const expiryTs = s.ts + EXPIRY_DAYS * 86_400_000;
  const pips = (to: number) => Math.round((long ? to - s.entry : s.entry - to) * 10) / 10;

  for (let i = start; i < bars.t.length; i++) {
    const hitTp2 = s.tp2 != null && (long ? bars.h[i] >= s.tp2 : bars.l[i] <= s.tp2);
    const hitTp1 = long ? bars.h[i] >= s.tp1 : bars.l[i] <= s.tp1;
    const hitSl = long ? bars.l[i] <= s.sl : bars.h[i] >= s.sl;

    if (hitSl && (hitTp1 || hitTp2)) {
      return { id: s.id, outcome: "sl", pnlPips: pips(s.sl), bars: i - start + 1, ambiguous: true };
    }
    if (hitSl) {
      return { id: s.id, outcome: "sl", pnlPips: pips(s.sl), bars: i - start + 1, ambiguous: false };
    }
    if (hitTp2 && s.tp2 != null) {
      return { id: s.id, outcome: "tp2", pnlPips: pips(s.tp2), bars: i - start + 1, ambiguous: false };
    }
    if (hitTp1) {
      return { id: s.id, outcome: "tp1", pnlPips: pips(s.tp1), bars: i - start + 1, ambiguous: false };
    }
    if (bars.t[i] * 1000 > expiryTs) {
      return { id: s.id, outcome: "expired", pnlPips: pips(bars.c[i]), bars: i - start + 1, ambiguous: false };
    }
  }
  return null;   // still running, and not yet old enough to expire
}

/** Settle every unsettled signal that the price record can now answer for. */
export async function resolvePending(): Promise<Resolved[]> {
  const signals = await getSignals(200);
  const open = signals.filter((s) => s.outcome === "pending" && s.direction !== "wait");
  if (!open.length) return [];

  const bars = await getGoldCandles(RESOLVE_TF, RESOLVE_BARS, true).catch(() => null);
  if (!bars) return [];

  const done: Resolved[] = [];
  for (const s of open) {
    const r = settle(s, bars);
    if (!r) continue;
    // "expired" is not one of the outcomes the store knows about. It is recorded
    // as break-even so the entry stops being pending, and the pips carry what it
    // was actually worth.
    await updateOutcome(r.id, r.outcome === "expired" ? "be" : r.outcome, r.pnlPips);
    done.push(r);
  }
  return done;
}

export interface Performance {
  settled: number;
  wins: number;
  losses: number;
  breakEven: number;
  stillOpen: number;
  notTrades: number;          // "wait" calls, which have no result
  winRate: number | null;     // null when nothing has settled
  avgWinPips: number | null;
  avgLossPips: number | null;
  expectancyPips: number | null;
  totalPips: number;
  /** Whether the sample is large enough to mean anything. */
  reliable: boolean;
  /** How far off a usable sample is, and roughly when. */
  target: number;
  remaining: number;
  /** Directional trades opened per day, over a trailing window. */
  tradesPerDay: number | null;
  /** How many trades that rate rests on — below three, there is no estimate. */
  rateFromTrades: number;
  readyAbout: string | null;
  verdict: string;
  verdictTh: string;
}

// Below this, a win rate is noise. Four wins from six trades reads as 67% and
// is worth nothing; saying so is the difference between a track record and a
// number that flatters whoever is reading it.
const MIN_SAMPLE = 20;

export function performanceOf(signals: SignalEntry[]): Performance {
  const trades = signals.filter((s) => s.direction !== "wait");
  const settled = trades.filter((s) => s.outcome !== "pending");
  const wins = settled.filter((s) => s.outcome === "tp1" || s.outcome === "tp2");
  const losses = settled.filter((s) => s.outcome === "sl");
  const be = settled.filter((s) => s.outcome === "be");

  const pipsOf = (list: SignalEntry[]) => list.reduce((n, s) => n + (s.pnlPips ?? 0), 0);
  const avg = (list: SignalEntry[]) => (list.length ? pipsOf(list) / list.length : null);

  const winRate = settled.length ? (wins.length / settled.length) * 100 : null;
  const avgWin = avg(wins);
  const avgLoss = avg(losses);
  const expectancy = settled.length ? pipsOf(settled) / settled.length : null;
  const reliable = settled.length >= MIN_SAMPLE;

  const verdict = !settled.length
    ? "No signal has settled yet — nothing to judge."
    : !reliable
    ? `${settled.length} settled trades is too few to draw a conclusion from. At least ${MIN_SAMPLE} before this number means anything.`
    : expectancy != null && expectancy > 0
    ? `${settled.length} settled trades, ${winRate!.toFixed(0)}% won, averaging ${expectancy.toFixed(1)} points a trade.`
    : `${settled.length} settled trades, ${winRate!.toFixed(0)}% won, losing ${Math.abs(expectancy ?? 0).toFixed(1)} points a trade on average.`;

  const verdictTh = !settled.length
    ? "ยังไม่มีสัญญาณไหนรู้ผล — ยังตัดสินอะไรไม่ได้"
    : !reliable
    ? `รู้ผลแล้ว ${settled.length} ไม้ ยังน้อยเกินกว่าจะสรุปอะไรได้ ต้องมีอย่างน้อย ${MIN_SAMPLE} ไม้ตัวเลขนี้ถึงจะมีความหมาย`
    : expectancy != null && expectancy > 0
    ? `รู้ผลแล้ว ${settled.length} ไม้ ชนะ ${winRate!.toFixed(0)}% เฉลี่ยได้ ${expectancy.toFixed(1)} จุดต่อไม้`
    : `รู้ผลแล้ว ${settled.length} ไม้ ชนะ ${winRate!.toFixed(0)}% เฉลี่ยเสีย ${Math.abs(expectancy ?? 0).toFixed(1)} จุดต่อไม้`;

  // When will this be worth reading?
  //
  // The question a launch decision turns on, and one that is easy to answer
  // confidently and wrongly. The first version measured outcomeTs — when a trade
  // was *marked* settled — and the resolver's first run had settled four old
  // trades in the same second. That produced 2.34 a day against a true 0.17, and
  // a launch date sixteen times too optimistic.
  //
  // So the rate comes from when trades were opened, over a trailing window. The
  // window matters as much as the field: before the scheduler existed, signals
  // were logged only when somebody opened a page, and averaging that era in
  // would describe a cadence the system no longer has.
  const RATE_WINDOW_DAYS = 14;
  const MIN_FOR_RATE = 3;

  const since = Date.now() - RATE_WINDOW_DAYS * 86_400_000;
  const openedRecently = trades.filter((s) => s.ts >= since);
  const perDay = openedRecently.length >= MIN_FOR_RATE
    ? openedRecently.length / RATE_WINDOW_DAYS
    : null;
  const remaining = Math.max(0, MIN_SAMPLE - settled.length);
  const readyAbout =
    remaining === 0 || !perDay || perDay <= 0
      ? null
      : new Date(Date.now() + (remaining / perDay) * 86_400_000).toISOString().slice(0, 10);

  return {
    target: MIN_SAMPLE,
    remaining,
    // Named for what it measures. "settling" invited the reading that tripped
    // this up in the first place.
    tradesPerDay: perDay == null ? null : +perDay.toFixed(2),
    rateFromTrades: openedRecently.length,
    readyAbout,
    settled: settled.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: be.length,
    stillOpen: trades.length - settled.length,
    notTrades: signals.length - trades.length,
    winRate: winRate == null ? null : +winRate.toFixed(1),
    avgWinPips: avgWin == null ? null : +avgWin.toFixed(1),
    avgLossPips: avgLoss == null ? null : +avgLoss.toFixed(1),
    expectancyPips: expectancy == null ? null : +expectancy.toFixed(1),
    totalPips: +pipsOf(settled).toFixed(1),
    reliable,
    verdict,
    verdictTh,
  };
}
