// MT5 Bridge store — MULTI-ACCOUNT, per Google user.
// Production (Vercel): Upstash Redis. Development: globalThis in-memory fallback.
//
// Each logged-in user can link multiple MT5 accounts, capped by their tier:
//   Free 1 · Premium 5 · Pro 10 (admins 10).
// Every account has its own push token; the EA authenticates with that token,
// so account data is isolated per user + per account.
//
// Redis keys (mirrors the userTier.ts pattern):
//   mt5:acctids:{email}      → Set of accountIds owned by the user
//   mt5:acct:{email}:{id}    → Hash { id, label, token, createdAt }  (account metadata)
//   mt5:tok:{token}          → JSON { email, accountId }             (reverse lookup for EA push)
//   mt5:live:{email}:{id}    → JSON MT5Account (TTL 300s)            (latest pushed snapshot)

import { Redis } from "@upstash/redis";
import { randomBytes } from "crypto";

export interface MT5Position {
  ticket: number;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  openTime: number; // unix seconds
  comment: string;
}

export interface MT5ClosedTrade {
  ticket: number;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  openPrice: number;
  closePrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: number;
  closeTime: number;
  comment: string;
}

export interface MT5Account {
  balance: number;
  equity: number;
  floating: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
  positions: MT5Position[];
  closedTrades?: MT5ClosedTrade[];
  server: string;
  account: string;
  lastUpdate: number; // Date.now()
}

export interface MT5AccountMeta {
  id: string;
  label: string;
  token: string;
  createdAt: number;
}

// ── Tier limits ─────────────────────────────────────────────────────────────
export const MT5_ACCOUNT_LIMIT: Record<string, number> = { free: 1, premium: 5, pro: 10 };
export function accountLimit(tier: string, isAdmin = false): number {
  if (isAdmin) return 10;
  return MT5_ACCOUNT_LIMIT[tier] ?? 1;
}

const TTL_SEC = 300; // live snapshot expiry
const MEM_TTL = TTL_SEC * 1000;

function newId(): string   { return "a" + randomBytes(5).toString("hex"); }         // 11 chars
function newToken(): string { return "gios_" + randomBytes(20).toString("hex"); }   // gios_ + 40 hex

// ── Redis client ────────────────────────────────────────────────────────────
function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ── In-memory fallback (dev) ──────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __mt5Accts:  Map<string, Map<string, MT5AccountMeta>> | undefined; // email → (id → meta)
  // eslint-disable-next-line no-var
  var __mt5Tokens: Map<string, { email: string; accountId: string }>    | undefined;
  // eslint-disable-next-line no-var
  var __mt5Live:   Map<string, MT5Account>                              | undefined; // `${email}:${id}` → data
}
function memAccts():  Map<string, Map<string, MT5AccountMeta>> { return (globalThis.__mt5Accts  ??= new Map()); }
function memTokens(): Map<string, { email: string; accountId: string }> { return (globalThis.__mt5Tokens ??= new Map()); }
function memLive():   Map<string, MT5Account> { return (globalThis.__mt5Live ??= new Map()); }

const lc = (e: string) => e.toLowerCase();
const kIds  = (email: string) => `mt5:acctids:${lc(email)}`;
const kAcct = (email: string, id: string) => `mt5:acct:${lc(email)}:${id}`;
const kTok  = (token: string) => `mt5:tok:${token}`;
const kLive = (email: string, id: string) => `mt5:live:${lc(email)}:${id}`;

// ── Account management ────────────────────────────────────────────────────────

export async function listAccounts(email: string): Promise<MT5AccountMeta[]> {
  const redis = getRedis();
  if (redis) {
    const ids = await redis.smembers(kIds(email)) as string[];
    const metas = await Promise.all(ids.map(async (id) => {
      const h = await redis.hgetall(kAcct(email, id));
      if (!h) return null;
      return {
        id: String(h.id ?? id),
        label: String(h.label ?? "Account"),
        token: String(h.token ?? ""),
        createdAt: Number(h.createdAt ?? 0),
      } as MT5AccountMeta;
    }));
    return (metas.filter(Boolean) as MT5AccountMeta[]).sort((a, b) => a.createdAt - b.createdAt);
  }
  const m = memAccts().get(lc(email));
  return m ? Array.from(m.values()).sort((a, b) => a.createdAt - b.createdAt) : [];
}

export async function countAccounts(email: string): Promise<number> {
  const redis = getRedis();
  if (redis) return await redis.scard(kIds(email));
  return memAccts().get(lc(email))?.size ?? 0;
}

export async function createAccount(
  email: string, label: string, tier: string, isAdmin: boolean
): Promise<{ ok: true; account: MT5AccountMeta } | { ok: false; reason: string; limit: number }> {
  const limit = accountLimit(tier, isAdmin);
  const used  = await countAccounts(email);
  if (used >= limit) {
    return { ok: false, reason: `ถึงขีดจำกัดแล้ว (${used}/${limit} พอร์ต) — อัปเกรด tier เพื่อเพิ่มพอร์ต`, limit };
  }
  const meta: MT5AccountMeta = {
    id: newId(),
    label: (label || `พอร์ต ${used + 1}`).slice(0, 40),
    token: newToken(),
    createdAt: Date.now(),
  };
  const redis = getRedis();
  if (redis) {
    await Promise.all([
      redis.sadd(kIds(email), meta.id),
      redis.hset(kAcct(email, meta.id), meta as unknown as Record<string, unknown>),
      redis.set(kTok(meta.token), { email: lc(email), accountId: meta.id }),
    ]);
  } else {
    const m = memAccts().get(lc(email)) ?? new Map<string, MT5AccountMeta>();
    m.set(meta.id, meta);
    memAccts().set(lc(email), m);
    memTokens().set(meta.token, { email: lc(email), accountId: meta.id });
  }
  return { ok: true, account: meta };
}

export async function getAccountMeta(email: string, id: string): Promise<MT5AccountMeta | null> {
  const redis = getRedis();
  if (redis) {
    const h = await redis.hgetall(kAcct(email, id));
    if (!h || !h.id) return null;
    return { id: String(h.id), label: String(h.label ?? ""), token: String(h.token ?? ""), createdAt: Number(h.createdAt ?? 0) };
  }
  return memAccts().get(lc(email))?.get(id) ?? null;
}

export async function renameAccount(email: string, id: string, label: string): Promise<boolean> {
  const meta = await getAccountMeta(email, id);
  if (!meta) return false;
  const clean = (label || meta.label).slice(0, 40);
  const redis = getRedis();
  if (redis) await redis.hset(kAcct(email, id), { label: clean });
  else { const m = memAccts().get(lc(email)); if (m) m.set(id, { ...meta, label: clean }); }
  return true;
}

export async function regenerateToken(email: string, id: string): Promise<string | null> {
  const meta = await getAccountMeta(email, id);
  if (!meta) return null;
  const token = newToken();
  const redis = getRedis();
  if (redis) {
    await Promise.all([
      redis.del(kTok(meta.token)),
      redis.hset(kAcct(email, id), { token }),
      redis.set(kTok(token), { email: lc(email), accountId: id }),
    ]);
  } else {
    memTokens().delete(meta.token);
    const m = memAccts().get(lc(email)); if (m) m.set(id, { ...meta, token });
    memTokens().set(token, { email: lc(email), accountId: id });
  }
  return token;
}

export async function deleteAccount(email: string, id: string): Promise<void> {
  const meta = await getAccountMeta(email, id);
  const redis = getRedis();
  if (redis) {
    await Promise.all([
      redis.srem(kIds(email), id),
      redis.del(kAcct(email, id)),
      redis.del(kLive(email, id)),
      meta?.token ? redis.del(kTok(meta.token)) : Promise.resolve(),
    ]);
  } else {
    memAccts().get(lc(email))?.delete(id);
    memLive().delete(`${lc(email)}:${id}`);
    if (meta?.token) memTokens().delete(meta.token);
  }
}

export async function getDefaultAccountId(email: string): Promise<string | null> {
  const accounts = await listAccounts(email);
  return accounts[0]?.id ?? null;
}

// ── Token resolution (EA push) ────────────────────────────────────────────────

export async function resolveToken(token: string): Promise<{ email: string; accountId: string } | null> {
  if (!token) return null;
  const redis = getRedis();
  if (redis) {
    const v = await redis.get<{ email: string; accountId: string }>(kTok(token));
    return v ?? null;
  }
  return memTokens().get(token) ?? null;
}

// ── Live snapshot ─────────────────────────────────────────────────────────────

export async function setLiveData(email: string, accountId: string, raw: Omit<MT5Account, "lastUpdate">): Promise<void> {
  const data: MT5Account = { ...raw, lastUpdate: Date.now() };
  const redis = getRedis();
  if (redis) await redis.set(kLive(email, accountId), JSON.stringify(data), { ex: TTL_SEC });
  else memLive().set(`${lc(email)}:${accountId}`, data);
}

export async function getLiveData(email: string, accountId: string): Promise<MT5Account | null> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>(kLive(email, accountId));
    if (!raw) return null;
    try {
      const data = (typeof raw === "string" ? JSON.parse(raw) : raw) as MT5Account;
      if (Date.now() - data.lastUpdate > MEM_TTL) { await redis.del(kLive(email, accountId)); return null; }
      return data;
    } catch { return null; }
  }
  const d = memLive().get(`${lc(email)}:${accountId}`);
  if (!d) return null;
  if (Date.now() - d.lastUpdate > MEM_TTL) { memLive().delete(`${lc(email)}:${accountId}`); return null; }
  return d;
}

export async function clearLiveData(email: string, accountId: string): Promise<void> {
  const redis = getRedis();
  if (redis) await redis.del(kLive(email, accountId));
  else memLive().delete(`${lc(email)}:${accountId}`);
}

/** Resolve the live snapshot for a user, defaulting to their first account. */
export async function getUserLiveData(email: string, accountId?: string): Promise<{ meta: MT5AccountMeta; data: MT5Account | null } | null> {
  const id = accountId ?? await getDefaultAccountId(email);
  if (!id) return null;
  const meta = await getAccountMeta(email, id);
  if (!meta) return null;
  const data = await getLiveData(email, id);
  return { meta, data };
}
