// The rules behind /start and /stop.
//
// Subscribing is the one part of this a stranger drives, and every way it can go
// wrong is quiet: a double /start that duplicates someone means they get every
// alert twice, a /stop that does not remove them means they keep receiving after
// asking not to, and a blocked reader who is never dropped slowly turns the list
// into dead addresses the send budget is spent on.
//
//   npx tsx scripts/subscribers.test.mts

import { addSubscriber, removeSubscriber, isSubscribed, listSubscribers } from "../lib/telegramSubscribers";

let failed = 0;
async function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}`);
  if (!ok) console.log(`        want ${JSON.stringify(want)}  got ${JSON.stringify(got)}`);
}

// Runs against the in-memory/file store the app uses locally.
for (const s of await listSubscribers()) await removeSubscriber(s.chatId);

await check("a new chat subscribes", await addSubscriber(1, "Kwang"), true);
await check("the same chat again is not a second subscriber", await addSubscriber(1, "Kwang"), false);
await check("one entry, not two", (await listSubscribers()).length, 1);

await check("a different chat is added", await addSubscriber(2, "Ann"), true);
await check("both are on the list", (await listSubscribers()).map((s) => s.chatId), [1, 2]);

await check("isSubscribed sees a member", await isSubscribed(1), true);
await check("isSubscribed does not invent one", await isSubscribed(99), false);

await check("removing takes them off", await removeSubscriber(1), true);
await check("removing again reports nothing to do", await removeSubscriber(1), false);
await check("the other is untouched", (await listSubscribers()).map((s) => s.chatId), [2]);
await check("a removed chat is no longer subscribed", await isSubscribed(1), false);

// Re-subscribing after leaving has to work, or a reader who says /stop by
// mistake can never come back.
await check("re-subscribing after /stop works", await addSubscriber(1, "Kwang"), true);
await check("and they are on the list again", (await isSubscribed(1)), true);

// A subscriber who has not linked an account carries no account, and no tier
// either. The tier used to be stored here and is not any more: a value copied at
// link time would be frozen, so a lapsed subscription would keep receiving paid
// alerts until a human noticed. It is read from the account when sending.
await check("an unlinked subscriber has no account", (await listSubscribers()).every((s) => s.email === undefined), true);
await check("and no tier is stored on them", (await listSubscribers()).every((s) => !("tier" in s)), true);

for (const s of await listSubscribers()) await removeSubscriber(s.chatId);

console.log(failed ? `\n${failed} failed` : "\nall correct");
if (failed) process.exit(1);
