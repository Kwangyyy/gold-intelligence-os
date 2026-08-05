// Whether a proposed trade is allowed through.
//
// This decides, on a reader's behalf, that a trade the strategy wanted will not
// be taken. Both ways of getting it wrong are silent: block what should pass and
// the app goes quiet for weeks with nothing indicating why, let through what
// should be blocked and it emits exactly the trades measured as losing money.
//
// The case worth stating outright is an unreadable count. It blocks — not
// because blocking is obviously right, but because the backtest scored an
// unreadable count as disagreement, and if live behaviour differed there the
// published numbers would describe a policy the app does not follow.
//
//   npx tsx scripts/waveFilter.test.mts

import { judge, type WaveContext } from "../lib/waveFilter";

const up: WaveContext = { direction: "up", degree: "Intermediate", label: "(3)" };
const down: WaveContext = { direction: "down", degree: "Intermediate", label: "(C)" };
const unknown: WaveContext = { direction: null, degree: null, label: null };

let failed = 0;
function check(name: string, got: boolean, want: boolean) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}`);
  if (!ok) console.log(`        want allow=${want} got allow=${got}`);
}

// With the leg.
check("buy allowed while the leg runs up", judge("buy", up).allow, true);
check("sell allowed while the leg runs down", judge("sell", down).allow, true);

// Against it — the population that lost money on every timeframe tested.
check("buy blocked while the leg runs down", judge("buy", down).allow, false);
check("sell blocked while the leg runs up", judge("sell", up).allow, false);

// No reading. Blocks, to match what the backtest counted.
check("buy blocked when the count is unreadable", judge("buy", unknown).allow, false);
check("sell blocked when the count is unreadable", judge("sell", unknown).allow, false);

// A wait is not a trade and must never be turned into one, nor blocked in a way
// that implies the filter had an opinion about it.
check("wait passes with the leg up", judge("wait", up).allow, true);
check("wait passes with the leg down", judge("wait", down).allow, true);
check("wait passes with no reading at all", judge("wait", unknown).allow, true);

// A blocked trade has to say why, in both languages, or the reader is left with
// a silent refusal and no way to disagree with it.
const blocked = judge("buy", down);
const hasReason = blocked.reason.length > 10 && blocked.reasonTh.length > 10;
check("a block explains itself", hasReason, true);
const named = blocked.reason.includes("Intermediate") && blocked.reasonTh.includes("Intermediate");
check("and names the degree it is deferring to", named, true);

// The unreadable case must not claim a direction it does not have.
const noRead = judge("buy", unknown);
check("an unreadable count does not invent a direction", noRead.reason.includes("unreadable"), true);

console.log(failed ? `\n${failed} failed` : "\nall correct");
if (failed) process.exit(1);
