// Codes that link a Telegram chat to an app account.
//
// A code is a bearer token for someone's subscription tier: whoever redeems it
// becomes that account as far as the bot is concerned. So the properties that
// matter are the ones that stop a code being used by anybody but the person it
// was issued to, and only once — a code that survived its own redemption is
// replayable by anyone who saw the chat log or the screenshot.
//
//   npx tsx scripts/linkCode.test.mts

import { createLinkCode, consumeLinkCode, linkSubscriber, listSubscribers, removeSubscriber } from "../lib/telegramSubscribers";

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}`);
  if (!ok) console.log(`        want ${JSON.stringify(want)}  got ${JSON.stringify(got)}`);
}

for (const s of await listSubscribers()) await removeSubscriber(s.chatId);

// A code redeems once, to the account it was issued for.
const code = await createLinkCode("trader@example.com");
check("redeems to the issuing account", await consumeLinkCode(code), "trader@example.com");
check("a second redemption is refused", await consumeLinkCode(code), null);

// Two accounts must never collide.
const a = await createLinkCode("a@example.com");
const b = await createLinkCode("b@example.com");
check("codes are distinct", a === b, false);
check("each redeems to its own account", await consumeLinkCode(b), "b@example.com");
check("the other is still usable", await consumeLinkCode(a), "a@example.com");

// Anything that is not a code we issued is refused before it touches the store.
check("empty string", await consumeLinkCode(""), null);
check("wrong length", await consumeLinkCode("abc123"), null);
check("non-hex characters", await consumeLinkCode("z".repeat(32)), null);
check("uppercase is not our format", await consumeLinkCode("A".repeat(32)), null);
check("never-issued code of the right shape", await consumeLinkCode("0".repeat(32)), null);

// Codes are long enough that guessing is not a strategy. 16 random bytes.
const sample = await createLinkCode("len@example.com");
check("code is 32 hex characters", /^[a-f0-9]{32}$/.test(sample), true);
await consumeLinkCode(sample);

// Linking attaches the account, and linking a chat twice moves it rather than
// adding a duplicate — otherwise a reader who re-links receives everything twice.
await linkSubscriber(1, "Kwang", "first@example.com");
check("linking subscribes the chat", (await listSubscribers()).length, 1);
await linkSubscriber(1, "Kwang", "second@example.com");
const after = await listSubscribers();
check("re-linking does not duplicate", after.length, 1);
check("re-linking moves the account", after[0].email, "second@example.com");

// The tier is not stored on the subscriber. It has to be read from the account
// at send time, or a lapsed subscription keeps receiving paid alerts forever.
check("no tier is frozen onto the subscriber", "tier" in after[0], false);
check("the account is what is kept", typeof after[0].email, "string");

for (const s of await listSubscribers()) await removeSubscriber(s.chatId);

console.log(failed ? `\n${failed} failed` : "\nall correct");
if (failed) process.exit(1);
