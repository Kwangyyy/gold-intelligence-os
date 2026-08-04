// Who receives which alert.
//
// News is free, wave structure is premium. Both ways of getting this wrong are
// silent: gate too tightly and someone who paid stops receiving with no error
// anywhere, gate too loosely and the paid alert is free and nobody finds out
// from the software.
//
// The subtle one is the channel. A channel has a single audience and no tiers —
// everyone in it sees every message, and membership is an invite link that can
// be forwarded. Sending premium content there while carefully filtering direct
// subscribers would gate nothing at all: the cheapest way past the paywall would
// be to join the channel.
//
//   npx tsx scripts/alertTier.test.mts

import { qualifies, channelReceives } from "../lib/telegram";
import type { Tier } from "../lib/tierConfig";

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}`);
  if (!ok) console.log(`        want ${JSON.stringify(want)}  got ${JSON.stringify(got)}`);
}

// The functions broadcastToSubscribers actually calls, not a copy of the rule.
const receives = (accountTier: Tier | null, minTier: Tier) => qualifies(accountTier, minTier);
const channelGets = (minTier: Tier) => channelReceives(minTier);

// News: everyone, linked or not.
check("free account gets news", receives("free", "free"), true);
check("unlinked chat gets news", receives(null, "free"), true);
check("premium gets news", receives("premium", "free"), true);
check("pro gets news", receives("pro", "free"), true);

// Wave: premium and above only.
check("free account does not get wave", receives("free", "premium"), false);
check("unlinked chat does not get wave", receives(null, "premium"), false);
check("premium gets wave", receives("premium", "premium"), true);
check("pro gets wave — higher tiers must not be excluded", receives("pro", "premium"), true);

// The channel rule: it carries free alerts only.
check("channel carries news", channelGets("free"), true);
check("channel does not carry wave", channelGets("premium"), false);
check("channel does not carry pro-only either", channelGets("pro"), false);

// A tier that is not recognised must not be treated as the highest by accident.
check("unknown tier falls back to free", receives(null, "pro"), false);

console.log(failed ? `\n${failed} failed` : "\nall correct");
if (failed) process.exit(1);
