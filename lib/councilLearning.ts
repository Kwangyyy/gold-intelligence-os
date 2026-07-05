// PRD Module K / Module 11 — Self-Learning Engine (pure math).
//
// Records of past council votes are scored against how price ACTUALLY moved
// afterwards, producing a per-agent accuracy (hit rate) and a reliability
// multiplier. This file is intentionally free of any I/O (no Redis / env) so it
// can be unit-tested and reused on both server and client. Persistence lives in
// councilJournal.ts.

import type { Bilingual } from "./types";
import type { CouncilVote } from "./council";

export interface AgentVoteRecord {
  id: string;
  name: Bilingual;
  vote: CouncilVote;
  score: number; // directional lean at vote time
  confidence: number;
}

export interface CouncilVoteEntry {
  id: string;
  ts: number; // unix ms when the vote was cast
  symbol: string;
  price: number; // price at vote time
  decision: CouncilVote;
  confidence: number;
  agents: AgentVoteRecord[];
  // Filled once the entry matures and is evaluated against a later price:
  evalTs?: number;
  evalPrice?: number;
}

// A single agent vote scored against the realised move.
export type VoteScore = "correct" | "wrong" | "flat" | "skip";

// XAUUSD moved enough (in %) to count as a real directional move rather than noise.
export const DIRECTION_THRESHOLD_PCT = 0.12;

export interface AgentAccuracy {
  id: string;
  name: Bilingual;
  samples: number; // scored votes (correct + wrong)
  correct: number;
  wrong: number;
  flat: number; // directional votes where price stayed within the band
  hitRate: number; // 0..100 over correct+wrong
  reliability: number; // 0.6..1.4 multiplier for future weighting
  lastVote: CouncilVote | null;
}

export interface LearningStats {
  agents: AgentAccuracy[];
  totalEntries: number;
  evaluatedEntries: number;
  pendingEntries: number;
}

// Score one agent's vote given the entry price and a later price.
export function scoreAgentVote(
  vote: CouncilVote,
  entryPrice: number,
  laterPrice: number,
  thresholdPct = DIRECTION_THRESHOLD_PCT
): VoteScore {
  if (!entryPrice || !laterPrice) return "skip";
  const movePct = ((laterPrice - entryPrice) / entryPrice) * 100;
  const up = movePct > thresholdPct;
  const down = movePct < -thresholdPct;
  const flat = !up && !down;

  switch (vote) {
    case "BUY":
      return up ? "correct" : down ? "wrong" : "flat";
    case "SELL":
      return down ? "correct" : up ? "wrong" : "flat";
    case "WAIT":
      // Waiting is "right" when price didn't make a real move.
      return flat ? "correct" : "wrong";
    default:
      // REDUCE_LOT / CLOSE are risk actions, not directional calls — not scored.
      return "skip";
  }
}

// hitRate (0..100) → reliability multiplier in [0.6, 1.4].
function reliabilityFrom(hitRate: number, samples: number): number {
  if (samples < 3) return 1; // not enough data — stay neutral
  return +(0.6 + (hitRate / 100) * 0.8).toFixed(2);
}

// Aggregate per-agent accuracy across all EVALUATED entries.
export function computeAgentAccuracy(
  entries: CouncilVoteEntry[],
  thresholdPct = DIRECTION_THRESHOLD_PCT
): LearningStats {
  const evaluated = entries.filter((e) => e.evalPrice != null);
  const acc = new Map<string, { name: Bilingual; correct: number; wrong: number; flat: number; lastVote: CouncilVote | null; lastTs: number }>();

  for (const e of evaluated) {
    for (const a of e.agents) {
      const cur = acc.get(a.id) ?? { name: a.name, correct: 0, wrong: 0, flat: 0, lastVote: null, lastTs: 0 };
      const s = scoreAgentVote(a.vote, e.price, e.evalPrice as number, thresholdPct);
      if (s === "correct") cur.correct++;
      else if (s === "wrong") cur.wrong++;
      else if (s === "flat") cur.flat++;
      if (e.ts >= cur.lastTs) {
        cur.lastTs = e.ts;
        cur.lastVote = a.vote;
      }
      cur.name = a.name;
      acc.set(a.id, cur);
    }
  }

  const agents: AgentAccuracy[] = [...acc.entries()].map(([id, v]) => {
    const samples = v.correct + v.wrong;
    const hitRate = samples ? +((v.correct / samples) * 100).toFixed(1) : 0;
    return {
      id,
      name: v.name,
      samples,
      correct: v.correct,
      wrong: v.wrong,
      flat: v.flat,
      hitRate,
      reliability: reliabilityFrom(hitRate, samples),
      lastVote: v.lastVote,
    };
  });

  // Rank most-accurate first (agents with enough samples above those without).
  agents.sort((a, b) => {
    if (a.samples >= 3 && b.samples < 3) return -1;
    if (b.samples >= 3 && a.samples < 3) return 1;
    return b.hitRate - a.hitRate;
  });

  return {
    agents,
    totalEntries: entries.length,
    evaluatedEntries: evaluated.length,
    pendingEntries: entries.length - evaluated.length,
  };
}
