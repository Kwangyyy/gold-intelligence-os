// PRD Module 10 — Research Database (Postgres tier).
//
// Durable storage for the council vote journal so Self-Learning accumulates in
// PRODUCTION (on Vercel the local-file tier is ephemeral and resets on every
// cold start / deploy). Uses @vercel/postgres, which reads POSTGRES_URL — set it
// via a Vercel Postgres / Neon integration to activate. When unset, pgEnabled()
// is false and councilJournal falls back to Redis → file → memory unchanged.

import { sql } from "@vercel/postgres";
import type { CouncilVoteEntry, AgentVoteRecord } from "./councilLearning";

export function pgEnabled(): boolean {
  return !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL);
}

let schemaReady = false;
async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await sql`CREATE TABLE IF NOT EXISTS council_votes (
    id         TEXT PRIMARY KEY,
    ts         BIGINT NOT NULL,
    symbol     TEXT NOT NULL,
    price      DOUBLE PRECISION NOT NULL,
    decision   TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    agents     JSONB NOT NULL,
    eval_ts    BIGINT,
    eval_price DOUBLE PRECISION
  )`;
  schemaReady = true;
}

interface Row {
  id: string; ts: string | number; symbol: string; price: string | number;
  decision: string; confidence: number; agents: AgentVoteRecord[] | string;
  eval_ts: string | number | null; eval_price: string | number | null;
}

function toEntry(r: Row): CouncilVoteEntry {
  return {
    id: r.id,
    ts: Number(r.ts),
    symbol: r.symbol,
    price: Number(r.price),
    decision: r.decision as CouncilVoteEntry["decision"],
    confidence: r.confidence,
    agents: typeof r.agents === "string" ? JSON.parse(r.agents) : r.agents,
    evalTs: r.eval_ts != null ? Number(r.eval_ts) : undefined,
    evalPrice: r.eval_price != null ? Number(r.eval_price) : undefined,
  };
}

export async function pgAppendVote(e: CouncilVoteEntry): Promise<void> {
  await ensureSchema();
  await sql`INSERT INTO council_votes (id, ts, symbol, price, decision, confidence, agents)
    VALUES (${e.id}, ${e.ts}, ${e.symbol}, ${e.price}, ${e.decision}, ${e.confidence}, ${JSON.stringify(e.agents)}::jsonb)
    ON CONFLICT (id) DO NOTHING`;
}

export async function pgGetVotes(limit: number): Promise<CouncilVoteEntry[]> {
  await ensureSchema();
  const { rows } = await sql<Row>`SELECT * FROM council_votes ORDER BY ts DESC LIMIT ${limit}`;
  return rows.map(toEntry);
}

// Lock in the later price on matured, not-yet-evaluated entries. Returns count.
export async function pgMatureAndEvaluate(now: number, currentPrice: number, maturityMs: number, maxAgeMs: number): Promise<number> {
  await ensureSchema();
  const { rowCount } = await sql`UPDATE council_votes
    SET eval_ts = ${now}, eval_price = ${currentPrice}
    WHERE eval_ts IS NULL AND (${now} - ts) >= ${maturityMs} AND (${now} - ts) <= ${maxAgeMs}`;
  return rowCount ?? 0;
}
