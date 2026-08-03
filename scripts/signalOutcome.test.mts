// Settling a signal against the price that followed it.
//
// This decides what the app claims about its own accuracy, so it is checked
// against bars whose answer is known rather than against the live log. The
// cases that matter are the ones where being generous is tempting: a bar that
// touched both the stop and the target, a trade that reached the target only
// after the stop, and a "wait" call that has no result to record at all.
//
//   npx tsx scripts/signalOutcome.test.mts

import { settle } from "../lib/signalOutcome";
import type { SignalEntry } from "../lib/signalLog";

const HOUR = 3_600_000;
const t0 = Date.parse("2026-07-01T00:00:00Z");

/** A long from 4000, stop 3980, target 4040. */
function longSignal(over: Partial<SignalEntry> = {}): SignalEntry {
  return {
    id: "t", ts: t0, symbol: "XAUUSD", direction: "buy", confidence: 60,
    setupType: "test", entry: 4000, sl: 3980, tp1: 4040, tp2: null, rr1: 2,
    source: "rule", outcome: "pending", ...over,
  };
}

/** Bars every 15 minutes from t0, given as [high, low] pairs. */
function bars(pairs: [number, number][], startMs = t0) {
  return {
    t: pairs.map((_, i) => Math.floor((startMs + i * 900_000) / 1000)),
    h: pairs.map((p) => p[0]),
    l: pairs.map((p) => p[1]),
    c: pairs.map((p) => (p[0] + p[1]) / 2),
  };
}

type Case = [string, ReturnType<typeof settle>, { outcome: string; pnlPips?: number; ambiguous?: boolean } | null];

const cases: Case[] = [
  [
    "target reached cleanly",
    settle(longSignal(), bars([[4010, 3995], [4045, 4005]])),
    { outcome: "tp1", pnlPips: 40, ambiguous: false },
  ],
  [
    "stop reached cleanly",
    settle(longSignal(), bars([[4010, 3995], [4005, 3975]])),
    { outcome: "sl", pnlPips: -20, ambiguous: false },
  ],
  [
    "stop first, target later — must be a loss, not a win",
    settle(longSignal(), bars([[4005, 3975], [4050, 4010]])),
    { outcome: "sl", pnlPips: -20, ambiguous: false },
  ],
  [
    "one bar touched both — the stop is assumed and the case is flagged",
    settle(longSignal(), bars([[4045, 3975]])),
    { outcome: "sl", pnlPips: -20, ambiguous: true },
  ],
  [
    "tp2 in the same bar as tp1 takes the further target",
    settle(longSignal({ tp2: 4060 }), bars([[4065, 4005]])),
    { outcome: "tp2", pnlPips: 60, ambiguous: false },
  ],
  [
    "a short settles by the mirrored rule",
    settle(
      longSignal({ direction: "sell", entry: 4000, sl: 4020, tp1: 3960 }),
      bars([[4005, 3955]]),
    ),
    { outcome: "tp1", pnlPips: 40, ambiguous: false },
  ],
  [
    "a wait call has no result",
    settle(longSignal({ direction: "wait" }), bars([[4045, 3975]])),
    null,
  ],
  [
    "still running inside the expiry window",
    settle(longSignal(), bars([[4010, 3995], [4012, 3999]])),
    null,
  ],
  [
    "past 14 days with neither touched — expires at the price it was worth",
    settle(
      longSignal(),
      bars(
        Array.from({ length: 30 }, () => [4010, 3995] as [number, number]),
        t0 + 15 * 24 * HOUR,
      ),
    ),
    { outcome: "expired", pnlPips: 2.5 },
  ],
  [
    "bars that all predate the signal cannot settle it",
    settle(longSignal(), bars([[4045, 3975]], t0 - 10 * HOUR)),
    null,
  ],
];

let failed = 0;
for (const [name, got, want] of cases) {
  let ok: boolean;
  if (want === null) {
    ok = got === null;
  } else {
    ok =
      got !== null &&
      got.outcome === want.outcome &&
      (want.pnlPips === undefined || got.pnlPips === want.pnlPips) &&
      (want.ambiguous === undefined || got.ambiguous === want.ambiguous);
  }
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}`);
  if (!ok) console.log(`        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
}

console.log(`\n${cases.length - failed}/${cases.length} correct`);
if (failed) process.exit(1);
