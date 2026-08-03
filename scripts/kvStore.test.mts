// Values must come back out the way they went in.
//
// This looks too basic to test until you see what it cost. Upstash deserialises
// JSON on read, so a value written as JSON.stringify("abc") returns as the plain
// string "abc" — and parsing that a second time throws. The throw was caught and
// reported as "no such key", which turns a stored value into an absent one: the
// worst possible answer, because callers treat absent as "create a new one".
//
// Every other key in this app holds an object or a number, and those come back
// already parsed and were fine. The single string key is the Telegram webhook
// secret, so verification read null every time, minted a fresh secret on every
// request, and could never match the value Telegram was registered with. The bot
// answered nothing, the admin page said the webhook was connected, and no amount
// of re-registering would have helped.
//
//   npx tsx scripts/kvStore.test.mts

import { kvGet, kvSet, decodeRedisValue } from "../lib/kvStore";

let failed = 0;
async function roundTrip(name: string, value: unknown) {
  const key = `gios:test:${name}`;
  await kvSet(key, value);
  const got = await kvGet(key);
  const ok = JSON.stringify(got) === JSON.stringify(value);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name.padEnd(22)} ${JSON.stringify(value)}`);
  if (!ok) console.log(`        came back as ${JSON.stringify(got)}`);
}

// The one that was broken.
await roundTrip("plain-string", "abc123");
await roundTrip("hex-secret", "dc19d1ce1e8549ce564e79c702dcad91");
await roundTrip("string-with-spaces", "hello world");
// A string that happens to be valid JSON must survive as a string, not become
// the thing it spells.
await roundTrip("numeric-string", "12345");

// The shapes that always worked, which must keep working.
await roundTrip("object", { a: 1, b: "two" });
await roundTrip("number", 42);
await roundTrip("boolean", true);
await roundTrip("array", [1, 2, 3]);
await roundTrip("nested", { at: 1785000000000, sent: true, names: ["a", "b"] });

// Absent really is absent.
const missing = await kvGet("gios:test:definitely-not-set");
const ok = missing === null;
if (!ok) failed++;
console.log(`${ok ? "  ok " : "FAIL "} ${"missing key".padEnd(22)} -> null`);

// Everything above runs against the file tier locally, which was never broken —
// so none of it would have caught this. The branch that broke is what Upstash
// returns after doing its own deserialisation, which is not the text written.
console.log("\n  what the Redis client hands back, decoded:");
const fromRedis: [string, unknown, unknown][] = [
  ["string written as JSON", JSON.parse(JSON.stringify("abc123")), "abc123"],
  ["hex secret", JSON.parse(JSON.stringify("dc19d1ce1e85")), "dc19d1ce1e85"],
  ["object written as JSON", JSON.parse(JSON.stringify({ a: 1 })), { a: 1 }],
  ["number", JSON.parse(JSON.stringify(42)), 42],
  // A client that does not deserialise hands back the raw JSON text instead,
  // and that has to keep working too.
  ["raw JSON text", '{"a":1}', { a: 1 }],
  ["raw quoted string", '"abc"', "abc"],
];
for (const [name, raw, want] of fromRedis) {
  const got = decodeRedisValue(raw);
  const same = JSON.stringify(got) === JSON.stringify(want);
  if (!same) failed++;
  console.log(`${same ? "  ok " : "FAIL "} ${name.padEnd(24)} ${JSON.stringify(got)}`);
  if (!same) console.log(`        want ${JSON.stringify(want)}`);
}

console.log(failed ? `\n${failed} failed` : "\nall correct");
if (failed) process.exit(1);
