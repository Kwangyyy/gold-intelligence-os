// Which tier a route needs.
//
// The lookup was exact, so a page added under a gated area was ungated by
// default — nobody has to make a mistake for that to happen, it is simply what
// adding a page does. /scanner required premium and /scanner/multi, sitting
// inside it, answered 200 to anyone logged out. Verified against production
// before the fix.
//
// The risk in fixing it is the opposite one: matching too eagerly and gating
// pages that were meant to be open. Hence the pairs below where one name is a
// prefix of another.
//
//   npx tsx scripts/tierGating.test.mts

import { minTierFor } from "../lib/tierConfig";

const cases: [string, string][] = [
  // Inheritance — the hole this closes.
  ["/admin", "pro"],
  ["/admin/telegram", "pro"],
  ["/scanner", "premium"],
  ["/scanner/multi", "premium"],
  ["/admin/anything/deeper", "pro"],

  // A gated name must not gate a different route that merely starts with the
  // same letters. Segment boundaries, not string prefixes.
  ["/scanner-free", "free"],
  ["/administration", "free"],

  // Open routes stay open.
  ["/", "free"],
  ["/markets", "free"],
  ["/locked", "free"],
];

let failed = 0;
for (const [route, want] of cases) {
  const got = minTierFor(route);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${route.padEnd(28)} ${got}${ok ? "" : `  (want ${want})`}`);
}

console.log(`\n${cases.length - failed}/${cases.length} correct`);
if (failed) process.exit(1);
