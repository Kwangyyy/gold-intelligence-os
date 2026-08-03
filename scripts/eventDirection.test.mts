// Does a headline push gold up or down?
//
// The scorer counts keywords, and counting them without reading direction is a
// silent failure: "Trump cancels attack on Iran to reach nuclear deal" matched
// +nuclear and +attack and went out as a 62-point *bullish* alert. Three of the
// ten stories in one live scan were the same mistake. Nothing about the alert
// looks wrong — it names a real story with a real severity and the wrong sign.
//
// So the direction rules get a test rather than an eye. Every case below is a
// real headline from a live scan, apart from the last four, which cover the
// reverse: a cue undoing a *bearish* term, and plain readings with no cue at
// all, so that a fix for negation cannot quietly invert everything else.
//
//   npx tsx scripts/eventDirection.test.mts

import { scoreForTest as score } from "../lib/eventWatch";

type Bias = "bullish" | "bearish" | "unclear";

const cases: [string, string, Bias][] = [
  // De-escalation, previously scored bullish — the defect this guards.
  ["Oil tumbles as Trump cancels attack on Iran to reach nuclear deal", "conflict", "bearish"],
  ["Trump Says U.S. Will Hold Off on Iran Strike if Nuclear Deal Reached Quickly", "conflict", "bearish"],
  ["Oil drops over 4% after Trump calls off planned strike on Iran", "conflict", "bearish"],

  // Escalation, and it must stay escalation.
  ["Vance, Caine raised concerns about escalating war in Iran, sources say as US pauses strikes", "conflict", "bullish"],
  ["Russia-Ukraine War Latest News: At Least 8 Killed After Kyiv Launches 635 Drones in Mass Attack on Russia Amid Escalating Cross-Border Strikes", "conflict", "bullish"],
  ["Russian attacks bombard Ukraine as Volodymyr Zelensky says country has no interceptors", "conflict", "bullish"],
  ["Chevron CEO warns Iran conflict has created 'very real' threat to global oil supplies as gas prices climb", "conflict", "bullish"],
  ["Israel kills 17 in Gaza as attacks escalate despite latest Trump plan", "conflict", "bullish"],
  ["Russian Missile Attacks Kill 10 in Kyiv as Escalation Hits Record High", "conflict", "bullish"],
  ["Trump keeps escalating his trade threats. This time, Europe isn't biting.", "policy", "bullish"],
  ["Kuwait Says It Downed Iranian Drones as Mideast Braces for Possible Escalation", "conflict", "bullish"],

  // American spelling. The regex covered "cancelled" and missed "canceled",
  // so this real headline went out scored bullish for gold.
  ["Trump says canceled Iran attack would have been biggest 'since World War II'", "conflict", "bearish"],
  ["US canceling planned strike on Iranian facilities", "conflict", "bearish"],

  // A cue after the term it undoes, and undoing a bearish term.
  ["Gaza ceasefire collapses as strikes resume", "conflict", "bullish"],
  ["Peace deal rejected, fighting resumes across the border", "conflict", "bullish"],

  // No cue at all: these must read plainly.
  ["Israel and Hamas agree ceasefire, hostages to be released", "conflict", "bearish"],
  ["Fed signals rate hike as inflation eases", "centralBank", "bearish"],
];

let failed = 0;
for (const [title, category, want] of cases) {
  const r = score(title, category as never);
  const ok = r.goldBias === want;
  if (!ok) failed++;
  console.log(
    `${ok ? "  ok " : "FAIL "} ${r.goldBias.padEnd(7)} (want ${want.padEnd(7)}) sev ${String(r.severity).padStart(3)}  ${title.slice(0, 66)}`,
  );
  if (!ok) console.log(`        matched: ${r.matched.join(" ")}`);
}

console.log(`\n${cases.length - failed}/${cases.length} correct`);
if (failed) process.exit(1);
