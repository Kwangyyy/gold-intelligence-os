// Trade with the larger degree, or do not trade.
//
// Measured before it was believed. Replaying the strategy across three
// timeframes and splitting the same trades by whether the leg in progress at
// Intermediate degree ran the same way:
//
//            with the wave              against it
//   H1   156 trades  45.5%  PF 1.57    61 trades  27.9%  PF 0.64
//   4H   171 trades  44.4%  PF 1.30    40 trades  27.5%  PF 0.50
//   1D    88 trades  38.6%  PF 1.61    23 trades  21.7%  PF 1.18
//
// Trading against it lost money outright on two of the three, and the unfiltered
// strategy was negative in one period of every timeframe while the filtered one
// was positive in all nine.
//
// One asset over one nested history, and the filter was the first thing tried
// rather than the best of many — so there is no discarded pile behind those
// numbers, and equally no independent confirmation. See
// scripts/backtestStrategy.mts.

import { getGoldCandles } from "./goldSource";
import { countMultiSource } from "./waveHierarchy";

export interface WaveContext {
  direction: "up" | "down" | null;
  degree: string | null;
  label: string | null;
}

/** Which way the leg in progress at the largest resolvable degree is running. */
export async function currentWaveDirection(): Promise<WaveContext> {
  const fetched = await Promise.all(
    (["1M", "1w", "1d"] as const).map((c) =>
      getGoldCandles(c, c === "1M" ? 200 : 1000, false).catch(() => null),
    ),
  );
  const spine = fetched
    .filter((c): c is NonNullable<typeof c> => !!c && c.c.length >= 25)
    .map((c) => ({ t: c.t, h: c.h, l: c.l, c: c.c }));
  if (!spine.length) return { direction: null, degree: null, label: null };

  const levels = countMultiSource(spine, 4);
  const lvl = levels.find((l) => l.degree === "Intermediate") ?? levels[levels.length - 1];
  const leg = lvl?.legs[lvl.legs.length - 1];
  if (!lvl || !leg) return { direction: null, degree: null, label: null };
  return { direction: leg.up ? "up" : "down", degree: lvl.degree, label: lvl.currentLabel };
}

export interface FilterVerdict {
  allow: boolean;
  reason: string;
  reasonTh: string;
  wave: WaveContext;
}

/**
 * Whether a direction may be traded, given the wave.
 *
 * An unreadable count blocks. That is the conservative answer and, more to the
 * point, it is what the backtest did — a count it could not read was scored as
 * disagreement. Letting live trades through on the one condition the measurement
 * excluded would mean the published numbers describe a policy the app does not
 * follow.
 */
export function judge(direction: string, wave: WaveContext): FilterVerdict {
  if (direction === "wait") {
    return { allow: true, reason: "no trade proposed", reasonTh: "ไม่ได้เสนอไม้เทรด", wave };
  }
  if (wave.direction == null) {
    return {
      allow: false,
      reason: "wave count unreadable — not trading on an unconfirmed structure",
      reasonTh: "อ่านโครงสร้างคลื่นไม่ได้ — ไม่เทรดเมื่อยังยืนยันไม่ได้",
      wave,
    };
  }
  const agrees = direction === "buy" ? wave.direction === "up" : wave.direction === "down";
  if (agrees) {
    return {
      allow: true,
      reason: `${wave.degree} leg is running ${wave.direction}`,
      reasonTh: `คลื่นดีกรี ${wave.degree} กำลังเดิน${wave.direction === "up" ? "ขึ้น" : "ลง"} ทางเดียวกัน`,
      wave,
    };
  }
  return {
    allow: false,
    reason: `against the ${wave.degree} leg, which is running ${wave.direction}`,
    reasonTh: `สวนทางคลื่นดีกรี ${wave.degree} ที่กำลังเดิน${wave.direction === "up" ? "ขึ้น" : "ลง"}`,
    wave,
  };
}
