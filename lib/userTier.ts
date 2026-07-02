// Server-side user tier + admin storage — tied to the logged-in Google account email.
// Production (Vercel): Upstash Redis, key `tier:{email}`.
// Development (local, no Redis): falls back to globalThis in-memory map.
//
// ADMIN_EMAILS (comma-separated in .env.local / Vercel) = immutable super-admins.
// Additional admins can be added dynamically via /admin panel → Redis key `admin:list` (Set).
// All admins (env + Redis) always resolve to tier "pro".
//
// Pending / rejected:
//   pending:set  → Redis Set of emails awaiting approval
//   pending:{email} → Redis Hash { name, picture, registeredAt }
//   rejected:set → Redis Set of rejected emails

import { Redis } from "@upstash/redis";
import type { Tier } from "./tierConfig";

export interface PendingUser {
  email:        string;
  name:         string;
  picture:      string;
  registeredAt: string; // ISO string
}

// Root super-admins from env — cannot be removed via UI
export const SUPER_ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const REDIS_ADMIN_KEY = "admin:list";  // Redis Set of additional admin emails

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

declare global {
  // eslint-disable-next-line no-var
  var __userTiers:    Map<string, Tier>        | undefined;
  // eslint-disable-next-line no-var
  var __adminEmails:  Set<string>              | undefined;
  // eslint-disable-next-line no-var
  var __pendingUsers: Map<string, PendingUser> | undefined;
  // eslint-disable-next-line no-var
  var __rejectedEmails: Set<string>            | undefined;
}
function memTiers(): Map<string, Tier> {
  if (!globalThis.__userTiers)  globalThis.__userTiers  = new Map();
  return globalThis.__userTiers;
}
function memAdmins(): Set<string> {
  if (!globalThis.__adminEmails) globalThis.__adminEmails = new Set();
  return globalThis.__adminEmails;
}
function memPending(): Map<string, PendingUser> {
  if (!globalThis.__pendingUsers) globalThis.__pendingUsers = new Map();
  return globalThis.__pendingUsers;
}
function memRejected(): Set<string> {
  if (!globalThis.__rejectedEmails) globalThis.__rejectedEmails = new Set();
  return globalThis.__rejectedEmails;
}

// ─── Admin checks ──────────────────────────────────────────────────────────

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

/** True if email is super-admin (env) OR added via admin panel (Redis/memory) */
export async function isAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(lower)) return true;
  const redis = getRedis();
  if (redis) {
    const members = await redis.smembers(REDIS_ADMIN_KEY);
    return members.map((m: string) => m.toLowerCase()).includes(lower);
  }
  return memAdmins().has(lower);
}

/** List all dynamically-added admins (not including super-admins from env) */
export async function listDynamicAdmins(): Promise<string[]> {
  const redis = getRedis();
  if (redis) {
    const members = await redis.smembers(REDIS_ADMIN_KEY);
    return (members as string[]).map((m: string) => m.toLowerCase()).sort();
  }
  return Array.from(memAdmins()).sort();
}

/** Add an admin email (stored in Redis Set / in-memory) */
export async function addAdmin(email: string): Promise<void> {
  const lower = email.toLowerCase().trim();
  if (!lower) return;
  const redis = getRedis();
  if (redis) await redis.sadd(REDIS_ADMIN_KEY, lower);
  else memAdmins().add(lower);
}

/** Remove a dynamically-added admin (cannot remove super-admins from env) */
export async function removeAdmin(email: string): Promise<{ ok: boolean; reason?: string }> {
  const lower = email.toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.includes(lower)) {
    return { ok: false, reason: "Cannot remove super-admin set in ADMIN_EMAILS env" };
  }
  const redis = getRedis();
  if (redis) await redis.srem(REDIS_ADMIN_KEY, lower);
  else memAdmins().delete(lower);
  return { ok: true };
}

// ─── Pending / Rejected ─────────────────────────────────────────────────────

/** True if email is in the pending queue (not yet approved) */
export async function isPendingUser(email: string): Promise<boolean> {
  const lower = email.toLowerCase();
  const redis = getRedis();
  if (redis) return !!(await redis.sismember("pending:set", lower));
  return memPending().has(lower);
}

/** True if email has been rejected */
export async function isRejectedUser(email: string): Promise<boolean> {
  const lower = email.toLowerCase();
  const redis = getRedis();
  if (redis) return !!(await redis.sismember("rejected:set", lower));
  return memRejected().has(lower);
}

/** True if user has any record (tier, pending, or rejected) — used to detect first login */
export async function hasAnyRecord(email: string): Promise<boolean> {
  const lower = email.toLowerCase();
  const redis = getRedis();
  if (redis) {
    const [hasTier, isPending, isRejected] = await Promise.all([
      redis.exists(`tier:${lower}`),
      redis.sismember("pending:set", lower),
      redis.sismember("rejected:set", lower),
    ]);
    return !!(hasTier || isPending || isRejected);
  }
  return memTiers().has(lower) || memPending().has(lower) || memRejected().has(lower);
}

/** Add a user to the pending approval queue (called on first login) */
export async function addPendingUser(user: PendingUser): Promise<void> {
  const lower = user.email.toLowerCase();
  const data: PendingUser = { ...user, email: lower };
  const redis = getRedis();
  if (redis) {
    await Promise.all([
      redis.sadd("pending:set", lower),
      redis.hset(`pending:${lower}`, data as unknown as Record<string, unknown>),
    ]);
  } else {
    memPending().set(lower, data);
  }
}

/** Get all pending users */
export async function listPendingUsers(): Promise<PendingUser[]> {
  const redis = getRedis();
  if (redis) {
    const emails = await redis.smembers("pending:set") as string[];
    const users = await Promise.all(
      emails.map(async (e) => {
        const h = await redis.hgetall(`pending:${e}`);
        if (!h) return null;
        return h as unknown as PendingUser;
      })
    );
    return (users.filter(Boolean) as PendingUser[])
      .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
  }
  return Array.from(memPending().values())
    .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
}

/** Approve a pending user — remove from pending, set their tier */
export async function approvePendingUser(email: string, tier: Tier = "free"): Promise<void> {
  const lower = email.toLowerCase();
  const redis = getRedis();
  if (redis) {
    await Promise.all([
      redis.srem("pending:set", lower),
      redis.del(`pending:${lower}`),
      redis.set(`tier:${lower}`, tier),
    ]);
  } else {
    memPending().delete(lower);
    memTiers().set(lower, tier);
  }
}

/** Reject a pending user — remove from pending, add to rejected set */
export async function rejectPendingUser(email: string): Promise<void> {
  const lower = email.toLowerCase();
  const redis = getRedis();
  if (redis) {
    await Promise.all([
      redis.srem("pending:set", lower),
      redis.del(`pending:${lower}`),
      redis.sadd("rejected:set", lower),
    ]);
  } else {
    memPending().delete(lower);
    memRejected().add(lower);
  }
}

/** Count pending users (for badge) */
export async function countPendingUsers(): Promise<number> {
  const redis = getRedis();
  if (redis) return await redis.scard("pending:set");
  return memPending().size;
}

// ─── Tier management ────────────────────────────────────────────────────────

export async function getUserTier(email: string | null | undefined): Promise<Tier> {
  if (!email) return "free";
  const lower = email.toLowerCase();
  // All admins (super + dynamic) get "pro"
  if (await isAdmin(lower)) return "pro";

  const redis = getRedis();
  if (redis) {
    const t = await redis.get<Tier>(`tier:${lower}`);
    return t ?? "free";
  }
  return memTiers().get(lower) ?? "free";
}

export async function setUserTier(email: string, tier: Tier): Promise<void> {
  const lower = email.toLowerCase();
  const redis = getRedis();
  if (redis) await redis.set(`tier:${lower}`, tier);
  else memTiers().set(lower, tier);
}

/** List all users with explicit tier records (Redis SCAN or in-memory) */
export async function listAllUsers(): Promise<Array<{ email: string; tier: Tier; isAdmin: boolean }>> {
  const redis = getRedis();
  const adminSet = new Set([
    ...SUPER_ADMIN_EMAILS,
    ...(await listDynamicAdmins()),
  ]);

  const entries: Array<{ email: string; tier: Tier; isAdmin: boolean }> = [];

  if (redis) {
    // Scan for all tier:* keys
    let cursor = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: "tier:*", count: 100 });
      cursor = Number(next);
      for (const key of keys as string[]) {
        const email = (key as string).replace(/^tier:/, "");
        const t = await redis.get<Tier>(key as string);
        entries.push({ email, tier: t ?? "free", isAdmin: adminSet.has(email) });
      }
    } while (cursor !== 0);
  } else {
    memTiers().forEach((tier, email) => {
      entries.push({ email, tier, isAdmin: adminSet.has(email) });
    });
  }

  // Ensure all admins appear even if not in tier store
  for (const email of adminSet) {
    if (!entries.find(e => e.email === email)) {
      entries.push({ email, tier: "pro", isAdmin: true });
    }
  }

  return entries.sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
}
