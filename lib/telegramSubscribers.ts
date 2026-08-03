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

import { kvGet, kvSet } from "./kvStore";

const KEY = "gios:tg:subscribers";

export interface Subscriber {
  chatId: number;
  name: string;          // first name or @username, for the owner's own list
  since: number;
  /** Reserved for linking to an app account. Everyone is "free" until then. */
  tier: "free" | "pro";
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
  list.push({ chatId, name, since: Date.now(), tier: "free" });
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

/**
 * The webhook secret, generated once and kept server-side.
 *
 * Telegram will happily deliver updates to whoever knows the URL, so a webhook
 * without a shared secret is an open endpoint that anything can post to — and
 * this one acts on what it is told. Generating it here rather than asking for
 * another environment variable keeps the value in one place and out of anyone's
 * hands, including mine.
 */
export async function webhookSecret(): Promise<string> {
  const existing = await kvGet<string>("gios:tg:webhook-secret");
  if (existing) return existing;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await kvSet("gios:tg:webhook-secret", secret);
  return secret;
}
