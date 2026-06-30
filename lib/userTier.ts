// Server-side user tier storage — tied to the logged-in Google account email.
// Production (Vercel): Upstash Redis, key `tier:{email}`.
// Development (local, no Redis): falls back to globalThis in-memory map.
//
// ADMIN_EMAILS (comma-separated) always resolve to "pro" — lets the project
// owner use every feature without needing a payment flow to exist yet.

import { Redis } from "@upstash/redis";
import type { Tier } from "./tierConfig";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

declare global {
  // eslint-disable-next-line no-var
  var __userTiers: Map<string, Tier> | undefined;
}
function memStore(): Map<string, Tier> {
  if (!globalThis.__userTiers) globalThis.__userTiers = new Map();
  return globalThis.__userTiers;
}

export async function getUserTier(email: string | null | undefined): Promise<Tier> {
  if (!email) return "free";
  const lower = email.toLowerCase();
  if (ADMIN_EMAILS.includes(lower)) return "pro";

  const redis = getRedis();
  if (redis) {
    const t = await redis.get<Tier>(`tier:${lower}`);
    return t ?? "free";
  }
  return memStore().get(lower) ?? "free";
}

export async function setUserTier(email: string, tier: Tier): Promise<void> {
  const lower = email.toLowerCase();
  const redis = getRedis();
  if (redis) await redis.set(`tier:${lower}`, tier);
  else memStore().set(lower, tier);
}
