// Shared authorization helpers for API route handlers.
//
// Because sign-up goes through the admin approval queue (see lib/userTier.ts),
// "has a session with a real tier" already means "a human the admin vetted".
// So requiring a session is a meaningful gate, not a formality — it is what
// separates an approved customer from an anonymous caller on the internet.
//
// Use `getApiUser()`  for anything that costs money or writes state.
// Use `getApiAdmin()` for anything with side effects on OUR infrastructure
//                     (the Telegram channel, broadcast to all subscribers).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import type { Tier } from "./tierConfig";

export interface ApiUser {
  email: string;
  tier: Tier;
  isAdmin: boolean;
}

/** An approved, signed-in user — or null for anonymous / pending / rejected. */
export async function getApiUser(): Promise<ApiUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;

  const u = session.user as { tier?: string; isAdmin?: boolean };
  const tier = (u.tier ?? "free") as Tier;
  // Awaiting approval or explicitly rejected: not a customer yet.
  if (tier === ("pending" as Tier) || tier === ("rejected" as Tier)) return null;

  return { email, tier, isAdmin: u.isAdmin ?? false };
}

/** Signed-in AND admin — or null. */
export async function getApiAdmin(): Promise<ApiUser | null> {
  const user = await getApiUser();
  return user?.isAdmin ? user : null;
}

/**
 * True when the caller is Vercel Cron.
 *
 * Vercel attaches `Authorization: Bearer $CRON_SECRET` to scheduled invocations
 * whenever the CRON_SECRET env var is set. If it is NOT set we return false —
 * we deliberately do not fall back to the `x-vercel-cron` header, because any
 * caller can spoof a header, which would leave the endpoint effectively open.
 */
export function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}
