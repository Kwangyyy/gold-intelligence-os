// People who asked the bot for alerts themselves.
//
// Until now the only way in was for the owner to send a channel invite by hand,
// which stops scaling the moment there is more than a handful of readers. This
// keeps a list of chat ids that said /start, and the alert paths fan out to it
// alongside the channel.
//
// Two things this has to get right, both of which are quiet when wrong:
// a reader who unsubscribes must actually stop receiving, and a reader who
// blocks the bot must be dropped rather than retried forever — Telegram answers
// 403 for those and a list that never prunes them slowly becomes mostly dead
// addresses, spending the send budget on people who left.

import { kvGet, kvSet, kvDel } from "./kvStore";

const KEY = "gios:tg:subscribers";

export interface Subscriber {
  chatId: number;
  name: string;          // first name or @username, for the owner's own list
  since: number;
  /**
   * The app account this chat belongs to, once linked.
   *
   * Deliberately the email and not the tier. A tier copied here at link time
   * would be frozen: someone whose subscription lapsed would keep receiving paid
   * alerts until a human noticed, and nothing would look wrong. The account is
   * the record; the tier is read from it at the moment of sending.
   */
  email?: string;
  linkedAt?: number;
}

export async function listSubscribers(): Promise<Subscriber[]> {
  return (await kvGet<Subscriber[]>(KEY)) ?? [];
}

async function save(list: Subscriber[]): Promise<void> {
  await kvSet(KEY, list);
}

/** Returns false when they were already on the list, so /start can say so. */
export async function addSubscriber(chatId: number, name: string): Promise<boolean> {
  const list = await listSubscribers();
  if (list.some((s) => s.chatId === chatId)) return false;
  list.push({ chatId, name, since: Date.now() });
  await save(list);
  return true;
}

/** Returns false when they were not subscribed, so /stop can say so. */
export async function removeSubscriber(chatId: number): Promise<boolean> {
  const list = await listSubscribers();
  const next = list.filter((s) => s.chatId !== chatId);
  if (next.length === list.length) return false;
  await save(next);
  return true;
}

export async function isSubscribed(chatId: number): Promise<boolean> {
  return (await listSubscribers()).some((s) => s.chatId === chatId);
}

const SECRET_KEY = "gios:tg:webhook-secret";

/**
 * The webhook secret as it stands, or null.
 *
 * Reading and creating are separate on purpose. When one function did both, the
 * side that *verifies* incoming requests could mint a secret — so any failure to
 * read the stored one silently rotated it, and the value Telegram had been
 * registered with stopped matching forever. That is exactly what happened: a
 * bug in the store meant string values always read back as absent, so every
 * verification generated a fresh secret and every delivery was refused, with
 * nothing anywhere reporting a problem.
 *
 * Verification uses this. If it returns null there is no secret to check
 * against, which is a state to report rather than to paper over.
 */
export async function webhookSecret(): Promise<string | null> {
  return await kvGet<string>(SECRET_KEY);
}

/**
 * The secret, creating one if there is none. Only registration may do this,
 * since only registration then hands the value to Telegram.
 *
 * Telegram will deliver to whoever knows the URL, so a webhook without a shared
 * secret is an open endpoint that anything can post to — and this one acts on
 * what it is told. Keeping the value in the store rather than an environment
 * variable means it exists in one place and nobody has to handle it.
 */
export async function ensureWebhookSecret(): Promise<string> {
  const existing = await webhookSecret();
  if (existing) return existing;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await kvSet(SECRET_KEY, secret);
  return secret;
}

// ── linking a chat to an app account ────────────────────────────────────────
//
// The web issues the code, because the web is where a subscription is bought and
// therefore where the truth about it lives. The code is one-use and short-lived:
// it is effectively a bearer token for someone's account tier, and one that
// lingered in a chat log or a screenshot would be reusable by whoever saw it.

const CODE_TTL_SEC = 15 * 60;
const codeKey = (code: string) => `gios:tg:link:${code}`;

/** A fresh single-use code for `email`, valid for fifteen minutes. */
export async function createLinkCode(email: string): Promise<string> {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await kvSet(codeKey(code), { email, at: Date.now() }, CODE_TTL_SEC);
  return code;
}

/**
 * Redeem a code, returning the account it was issued for.
 *
 * Burned on use. Expiry is enforced by the store's TTL, and checked again here
 * rather than trusted: a store without TTL support would otherwise leave these
 * valid forever.
 */
export async function consumeLinkCode(code: string): Promise<string | null> {
  if (!/^[a-f0-9]{32}$/.test(code)) return null;
  const rec = await kvGet<{ email: string; at: number }>(codeKey(code));
  if (!rec?.email) return null;
  await kvDel(codeKey(code));
  if (Date.now() - rec.at > CODE_TTL_SEC * 1000) return null;
  return rec.email;
}

/** Attach an account to a chat, subscribing it if it was not already. */
export async function linkSubscriber(chatId: number, name: string, email: string): Promise<void> {
  const list = await listSubscribers();
  const existing = list.find((s) => s.chatId === chatId);
  if (existing) {
    existing.email = email;
    existing.linkedAt = Date.now();
    existing.name = name;
  } else {
    list.push({ chatId, name, since: Date.now(), email, linkedAt: Date.now() });
  }
  await save(list);
}
