// When the wave count changes, does the channel hear about it — once?
//
// Both failures here are silent. Confirm too eagerly and every wobble of a
// forming bar becomes a push; confirm too strictly and a real structural change
// is never announced. Neither raises an error, and neither is visible from
// reading the code, so the decision is a pure function with a table.
//
//   npx tsx scripts/waveAlert.test.mts

import { decide, type Stored, type Snapshot } from "../lib/waveAlert";

const A: Snapshot = {
  Primary: { label: "after ⑤", structure: "terminal", complete: true, confidence: 100 },
  Intermediate: { label: "(C)", structure: "flat", complete: false, confidence: 67 },
};
// Intermediate has moved on to a new leg.
const B: Snapshot = {
  ...A,
  Intermediate: { label: "(5)", structure: "terminal", complete: false, confidence: 83 },
};
// Same as A but confidence drifted, which is not a change a reader would call one.
const A2: Snapshot = {
  ...A,
  Intermediate: { label: "(C)", structure: "flat", complete: false, confidence: 71 },
};

const cases: [string, Stored, Snapshot, string, string[]][] = [
  ["first ever run records a baseline and says nothing",
    { alerted: null, pending: null }, A, "baseline", []],

  ["no change stays quiet",
    { alerted: A, pending: null }, A, "quiet", []],

  ["confidence drifting is not a change",
    { alerted: A, pending: null }, A2, "quiet", []],

  ["a new change waits to be seen again",
    { alerted: A, pending: null }, B, "wait", ["Intermediate"]],

  ["the same change seen twice is sent",
    { alerted: A, pending: { snap: B, seen: 0 } }, B, "send", ["Intermediate"]],

  ["a change that reverts before confirmation is dropped, not sent",
    { alerted: A, pending: { snap: B, seen: 0 } }, A, "quiet", []],

  ["a different change replaces the pending one and waits again",
    { alerted: A, pending: { snap: B, seen: 0 } },
    { ...A, Primary: { label: "⑤", structure: "terminal", complete: false, confidence: 100 } },
    "wait", ["Primary"]],

  ["a completed pattern is a change even when the label is unchanged",
    { alerted: A, pending: null },
    { ...A, Intermediate: { ...A.Intermediate, complete: true } },
    "wait", ["Intermediate"]],
];

let failed = 0;
for (const [name, stored, now, wantAction, wantChanged] of cases) {
  const r = decide(stored, now);
  const ok = r.action === wantAction && r.changed.join(",") === wantChanged.join(",");
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}`);
  if (!ok) console.log(`        want ${wantAction} [${wantChanged}]  got ${r.action} [${r.changed}]`);
}

// Sending must clear the pending slot, or the next scan re-sends the same thing.
const after = decide({ alerted: A, pending: { snap: B, seen: 0 } }, B);
const resent = decide({ alerted: B, pending: null }, B);
const ok = after.action === "send" && resent.action === "quiet";
if (!ok) failed++;
console.log(`${ok ? "  ok " : "FAIL "} once sent, the same state is not sent again`);

console.log(`\n${cases.length + 1 - failed}/${cases.length + 1} correct`);
if (failed) process.exit(1);
