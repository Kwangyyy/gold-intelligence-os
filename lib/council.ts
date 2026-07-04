// PRD Module H / Module 7 — Multi-Agent Council + Vote Engine.
//
// A panel of 6 specialist "analyst" agents each look at the SAME market context
// through a different lens, cast an independent vote, and a Vote Engine combines
// them with an explicit QUORUM rule + a Risk Manager gate.
//
// The 6 agents (per spec):
//   1. Trend        — EMA / MA / ADX (+ MTF confirmation)
//   2. Momentum     — RSI / MACD / Stochastic
//   3. Volatility   — ATR / Bollinger Band (regime & breakout timing)
//   4. Price Action — Swing High/Low / Breakout (SMC structure)
//   5. Risk Manager — Drawdown / Margin / Lot exposure / News  (gate + veto)
//   6. News Filter  — high-impact events before trading
//
// Votes: BUY | SELL | WAIT | REDUCE_LOT | CLOSE
//
// Quorum rule:
//   - BUY  ≥ 4 of 6  AND Risk Manager passes → BUY
//   - SELL ≥ 4 of 6  AND Risk Manager passes → SELL
//   - otherwise                              → WAIT (no trade)
//   - strong news imminent                   → REDUCE_LOT (if a lean exists) / WAIT
//   - drawdown / margin critical             → CLOSE (emergency)
//
// Agents are deterministic and rule-based over the existing analytics modules —
// no LLM in the hot path, so the council returns well under the PRD's 5s budget
// and costs nothing per decision. An LLM layer can later enrich `reasons`.

import type {
  Bilingual,
  IndicatorReading,
  MarketSnapshot,
  MultiTimeframe,
  PortfolioSnapshot,
  SmcAnalysis,
  TechnicalScore,
} from "./types";

export type CouncilVote = "BUY" | "SELL" | "WAIT" | "REDUCE_LOT" | "CLOSE";
export type CouncilDecision = CouncilVote;
export type RiskGate = "pass" | "caution" | "block";

export interface AgentOpinion {
  id: string;
  name: Bilingual;
  role: Bilingual;
  vote: CouncilVote;
  confidence: number; // 0..100
  score: number; // -100 (max SELL) .. +100 (max BUY) directional lean (0 for non-directional)
  reasons: Bilingual[];
  gate?: RiskGate; // Risk Manager only
}

export interface CouncilResult {
  symbol: string;
  price: number;
  decision: CouncilDecision;
  confidence: number; // 0..100 confidence in the final decision
  counts: Record<CouncilVote, number>; // how many of the 6 agents chose each option
  quorum: {
    threshold: number; // votes needed for a directional decision
    buy: number; // BUY votes among the 6
    sell: number; // SELL votes among the 6
    riskPass: boolean; // did the Risk Manager clear the trade?
    met: "BUY" | "SELL" | null; // which side reached quorum (before the risk gate)
  };
  agents: AgentOpinion[];
  riskFlags: Bilingual[];
  overridden: boolean; // true when the risk/news gate changed the raw quorum outcome
  summary: Bilingual;
  disclaimer: Bilingual;
  timestamp: string;
}

export interface CouncilContext {
  snapshot: MarketSnapshot;
  technical: TechnicalScore; // H1 indicator suite
  mtf: MultiTimeframe;
  smc: SmcAnalysis; // H1 structure
  portfolio: PortfolioSnapshot; // DD / margin / lot exposure (simulated)
}

const THRESHOLD = 4; // BUY/SELL votes required, of 6

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Count bull/bear/neutral signals across a basket of indicator readings.
function tally(readings: IndicatorReading[]) {
  let bull = 0, bear = 0, neutral = 0;
  for (const r of readings) {
    if (r.signal === "bull") bull++;
    else if (r.signal === "bear") bear++;
    else neutral++;
  }
  return { bull, bear, neutral, total: readings.length };
}

// A directional score in [-100,100] from a bull/bear tally.
function scoreFromTally(t: { bull: number; bear: number; total: number }) {
  return t.total ? clamp(((t.bull - t.bear) / t.total) * 100, -100, 100) : 0;
}

function voteFromScore(score: number, deadzone = 18): CouncilVote {
  if (score > deadzone) return "BUY";
  if (score < -deadzone) return "SELL";
  return "WAIT";
}

function confFromScore(score: number, floor = 35, ceil = 92): number {
  return Math.round(clamp(floor + Math.abs(score) * 0.62, floor, ceil));
}

// Pull one indicator reading by key (e.g. "ind_adx") for citing in reasons.
function pick(readings: IndicatorReading[], key: string): IndicatorReading | undefined {
  return readings.find((r) => r.key === key);
}

// ── Agent 1: Trend (EMA / MA / ADX + MTF) ────────────────────────────────────
function trendAgent(ctx: CouncilContext): AgentOpinion {
  const t = ctx.technical.indicators.trend; // EMA20/50/100/200, SMA20, MACD, ADX, SuperTrend, PSAR, Ichimoku, VWAP
  const tt = tally(t);
  const indScore = scoreFromTally(tt);
  // MTF confirmation (net of bull vs bear timeframes).
  const rows = ctx.mtf.rows.filter((r) => r.available).length || 1;
  const mtfScore = ((ctx.mtf.overall.bullishCount - ctx.mtf.overall.bearishCount) / rows) * 100;
  const score = clamp(0.7 * indScore + 0.3 * mtfScore, -100, 100);

  const adx = pick(t, "ind_adx");
  const ema20 = pick(t, "ind_ema20");
  const macd = pick(t, "ind_macd");
  const reasons: Bilingual[] = [
    {
      th: `อินดิเคเตอร์เทรนด์: ขึ้น ${tt.bull} · ลง ${tt.bear} · กลาง ${tt.neutral}`,
      en: `Trend indicators: ${tt.bull} bull · ${tt.bear} bear · ${tt.neutral} neutral`,
    },
    {
      th: `EMA20 ${ema20?.signal === "bull" ? "หนุนขาขึ้น" : ema20?.signal === "bear" ? "กดขาลง" : "กลาง"} · ADX ${adx?.value ?? "—"} (${adx?.detail ?? ""})`,
      en: `EMA20 ${ema20?.signal ?? "n/a"} · ADX ${adx?.value ?? "—"} (${adx?.detail ?? ""})`,
    },
    {
      th: `MACD ${macd?.detail ?? macd?.value ?? "—"} · มัลติไทม์เฟรม ขึ้น ${ctx.mtf.overall.bullishCount}/ลง ${ctx.mtf.overall.bearishCount}`,
      en: `MACD ${macd?.detail ?? macd?.value ?? "—"} · MTF ${ctx.mtf.overall.bullishCount}↑/${ctx.mtf.overall.bearishCount}↓`,
    },
  ];
  return {
    id: "trend",
    name: { th: "นักวิเคราะห์เทรนด์", en: "Trend Analyst" },
    role: { th: "EMA / MA / ADX + หลายไทม์เฟรม", en: "EMA / MA / ADX + multi-timeframe" },
    vote: voteFromScore(score),
    confidence: confFromScore(score),
    score: Math.round(score),
    reasons,
  };
}

// ── Agent 2: Momentum (RSI / MACD / Stochastic) ──────────────────────────────
function momentumAgent(ctx: CouncilContext): AgentOpinion {
  const m = ctx.technical.indicators.momentum; // RSI, Stochastic, CCI, Momentum, ROC
  const mt = tally(m);
  const score = clamp(0.8 * scoreFromTally(mt) + 0.2 * clamp(ctx.snapshot.changePercent * 26, -100, 100), -100, 100);
  const rsi = pick(m, "ind_rsi");
  const stoch = pick(m, "ind_stoch");
  return {
    id: "momentum",
    name: { th: "นักวิเคราะห์โมเมนตัม", en: "Momentum Analyst" },
    role: { th: "RSI / MACD / Stochastic", en: "RSI / MACD / Stochastic" },
    vote: voteFromScore(score),
    confidence: confFromScore(score),
    score: Math.round(score),
    reasons: [
      {
        th: `อินดิเคเตอร์โมเมนตัม: ขึ้น ${mt.bull} · ลง ${mt.bear} · กลาง ${mt.neutral}`,
        en: `Momentum indicators: ${mt.bull} bull · ${mt.bear} bear · ${mt.neutral} neutral`,
      },
      {
        th: `RSI ${rsi?.value ?? "—"} · Stochastic ${stoch?.value ?? "—"}`,
        en: `RSI ${rsi?.value ?? "—"} · Stochastic ${stoch?.value ?? "—"}`,
      },
      {
        th: `เปลี่ยนแปลงวันนี้ ${ctx.snapshot.changePercent >= 0 ? "+" : ""}${ctx.snapshot.changePercent.toFixed(2)}%`,
        en: `Daily change ${ctx.snapshot.changePercent >= 0 ? "+" : ""}${ctx.snapshot.changePercent.toFixed(2)}%`,
      },
    ],
  };
}

// ── Agent 3: Volatility (ATR / Bollinger Band) ───────────────────────────────
function volatilityAgent(ctx: CouncilContext): AgentOpinion {
  const { snapshot, technical } = ctx;
  const v = technical.indicators.volatility; // Bollinger, ATR, Keltner
  const extreme = snapshot.volatilityStatus === "extreme";
  const bb = pick(v, "ind_bollinger");
  const atr = pick(v, "ind_atr");

  // Volatility is chiefly a timing/regime gate. Under extreme vol it votes WAIT.
  // Otherwise it CONFIRMS the prevailing trend only when a breakout looks likely
  // (Bollinger breach or high breakout probability); low breakout probability
  // means "no conviction → WAIT", never a flip to the opposite direction.
  const trendSign = Math.sign(technical.trendScore - 50);
  const bbBreak = bb?.signal === "bull" ? 1 : bb?.signal === "bear" ? -1 : 0;
  const breakoutEdge = Math.max(0, technical.breakoutProbability - 45);
  let score = 0;
  if (!extreme) {
    if (bbBreak !== 0) score = bbBreak * clamp(45 + breakoutEdge, 40, 85);
    else score = trendSign * clamp(breakoutEdge * 1.5, 0, 70);
  }
  const vote: CouncilVote = extreme ? "WAIT" : voteFromScore(score);
  const confidence = extreme ? 85 : confFromScore(score, 30, 78);
  return {
    id: "volatility",
    name: { th: "นักวิเคราะห์ความผันผวน", en: "Volatility Analyst" },
    role: { th: "ATR / Bollinger Band · จังหวะเข้า", en: "ATR / Bollinger Band · timing" },
    vote,
    confidence,
    score: Math.round(score),
    reasons: [
      {
        th: `ความผันผวน: ${snapshot.volatilityStatus}${extreme ? " — แนะนำรอ" : ""} · ATR ${atr?.value ?? snapshot.atr.toFixed(2)}`,
        en: `Volatility: ${snapshot.volatilityStatus}${extreme ? " — stand aside" : ""} · ATR ${atr?.value ?? snapshot.atr.toFixed(2)}`,
      },
      {
        th: `Bollinger ${bb?.value ?? "—"} (${bb?.detail ?? ""}) · โอกาสเบรก ${technical.breakoutProbability}/100`,
        en: `Bollinger ${bb?.value ?? "—"} (${bb?.detail ?? ""}) · breakout ${technical.breakoutProbability}/100`,
      },
    ],
  };
}

// ── Agent 4: Price Action (Swing High/Low / Breakout — SMC) ──────────────────
function priceActionAgent(ctx: CouncilContext): AgentOpinion {
  const { smc } = ctx;
  // Structure bias (BOS/CHoCH), value zone, and any imminent liquidity sweep.
  const base = smc.bias === "bullish" ? 55 : smc.bias === "bearish" ? -55 : 0;
  const lastEvent = smc.events[smc.events.length - 1];
  const eventPush = lastEvent ? (lastEvent.direction === "bullish" ? 22 : -22) : 0;
  const liqPush = smc.liquidityTarget ? (smc.liquidityTarget.side === "buyside" ? 12 : -12) : 0;
  const score = clamp(base + eventPush + liqPush, -100, 100);

  const reasons: Bilingual[] = [
    { th: `โครงสร้างราคา (SMC): ${smc.bias}`, en: `Price structure (SMC): ${smc.bias}` },
  ];
  if (lastEvent) {
    reasons.push({
      th: `${lastEvent.type} ${lastEvent.direction === "bullish" ? "ขึ้น" : "ลง"} ที่ ${lastEvent.level.toFixed(2)}`,
      en: `${lastEvent.type} ${lastEvent.direction} at ${lastEvent.level.toFixed(2)}`,
    });
  }
  reasons.push({
    th: `โซน ${smc.premiumDiscount.zone} (${smc.premiumDiscount.position}/100)${smc.possibleSweep ? ` · อาจกวาดสภาพคล่องฝั่ง ${smc.possibleSweep.side === "buyside" ? "บน" : "ล่าง"}` : ""}`,
    en: `${smc.premiumDiscount.zone} zone (${smc.premiumDiscount.position}/100)${smc.possibleSweep ? ` · possible ${smc.possibleSweep.side} sweep` : ""}`,
  });
  return {
    id: "priceAction",
    name: { th: "นักวิเคราะห์ไพรซ์แอ็กชัน", en: "Price Action Analyst" },
    role: { th: "Swing High/Low · Breakout", en: "Swing High/Low · Breakout" },
    vote: voteFromScore(score),
    confidence: confFromScore(score, 34, 82),
    score: Math.round(score),
    reasons,
  };
}

// ── Agent 5: Risk Manager (DD / Margin / Lot / News) — gate + veto ───────────
function riskAgent(ctx: CouncilContext): AgentOpinion {
  const { snapshot, portfolio } = ctx;
  const flags: Bilingual[] = [];

  // PRD Risk limits: portfolio DD 10%, margin-call danger, plus market context.
  const critical =
    portfolio.drawdownPct >= 10 || (portfolio.marginLevel > 0 && portfolio.marginLevel < 150);
  const blocked = snapshot.session.current === "closed" || snapshot.volatilityStatus === "extreme";
  const caution =
    portfolio.drawdownPct >= 6 ||
    portfolio.lotExposure > portfolio.balance / 1000 || // heuristic exposure cap
    snapshot.newsRisk.level === "high" ||
    snapshot.newsRisk.level === "extreme";

  let gate: RiskGate;
  let vote: CouncilVote;
  let confidence: number;
  if (critical) {
    gate = "block";
    vote = "CLOSE";
    confidence = 95;
    flags.push({
      th: `วิกฤต: ${portfolio.drawdownPct >= 10 ? `พอร์ตขาดทุน ${portfolio.drawdownPct.toFixed(1)}%` : `Margin Level ${portfolio.marginLevel.toFixed(0)}%`} — ปิดสถานะ`,
      en: `Critical: ${portfolio.drawdownPct >= 10 ? `portfolio DD ${portfolio.drawdownPct.toFixed(1)}%` : `margin level ${portfolio.marginLevel.toFixed(0)}%`} — close positions`,
    });
  } else if (blocked) {
    gate = "block";
    vote = "WAIT";
    confidence = 88;
    flags.push({
      th: snapshot.session.current === "closed" ? "ตลาดปิด/สภาพคล่องต่ำ — งดเทรด" : "ผันผวนสูงมาก — งดเทรด",
      en: snapshot.session.current === "closed" ? "Market closed / low liquidity — no trade" : "Extreme volatility — no trade",
    });
  } else if (caution) {
    gate = "caution";
    vote = "REDUCE_LOT";
    confidence = 75;
    flags.push({
      th: `ระวัง: ${portfolio.drawdownPct >= 6 ? `DD ${portfolio.drawdownPct.toFixed(1)}%` : `ความเสี่ยงข่าว ${snapshot.newsRisk.level}`} — ลดขนาดล็อต`,
      en: `Caution: ${portfolio.drawdownPct >= 6 ? `DD ${portfolio.drawdownPct.toFixed(1)}%` : `news risk ${snapshot.newsRisk.level}`} — reduce size`,
    });
  } else {
    gate = "pass";
    vote = "WAIT"; // neutral abstain — doesn't add to BUY/SELL count, but clears the gate
    confidence = 55;
    flags.push({
      th: `ผ่านเกณฑ์ความเสี่ยง · DD ${portfolio.drawdownPct.toFixed(1)}% · Margin ${portfolio.marginLevel.toFixed(0)}%`,
      en: `Risk checks pass · DD ${portfolio.drawdownPct.toFixed(1)}% · margin ${portfolio.marginLevel.toFixed(0)}%`,
    });
  }

  return {
    id: "risk",
    name: { th: "ผู้จัดการความเสี่ยง", en: "Risk Manager" },
    role: { th: "DD / Margin / Lot / ข่าว", en: "DD / Margin / Lot / News" },
    vote,
    confidence,
    score: 0,
    reasons: flags,
    gate,
  };
}

// ── Agent 6: News Filter (high-impact events) ────────────────────────────────
function newsAgent(ctx: CouncilContext): AgentOpinion {
  const nr = ctx.snapshot.newsRisk;
  const imminent = nr.warning;
  const elevated = nr.level === "high" || nr.level === "extreme";
  const vote: CouncilVote = imminent ? "REDUCE_LOT" : "WAIT";
  const confidence = imminent ? 90 : elevated ? 65 : nr.level === "medium" ? 50 : 35;
  return {
    id: "news",
    name: { th: "ตัวกรองข่าว", en: "News Filter" },
    role: { th: "ข่าวแรงก่อนเทรด", en: "High-impact events" },
    vote,
    confidence,
    score: 0,
    reasons: [
      {
        th: nr.nextEvent
          ? `ข่าวถัดไป: ${nr.nextEvent.name.th}${nr.minutesToNext != null ? ` ใน ${nr.minutesToNext} นาที` : ""} (ระดับ ${nr.level})${imminent ? " — ลดล็อต/หยุด" : ""}`
          : `ไม่มีข่าวแรงใกล้ ๆ (ระดับ ${nr.level})`,
        en: nr.nextEvent
          ? `Next: ${nr.nextEvent.name.en}${nr.minutesToNext != null ? ` in ${nr.minutesToNext}m` : ""} (${nr.level})${imminent ? " — reduce/stop" : ""}`
          : `No imminent high-impact news (${nr.level})`,
      },
    ],
  };
}

// ── Vote Engine (quorum + risk gate) ─────────────────────────────────────────

const DISCLAIMER: Bilingual = {
  th: "ผลโหวตจากสภา AI เป็นการวิเคราะห์เพื่อประกอบการตัดสินใจเท่านั้น ไม่ใช่คำแนะนำการลงทุน การเทรดมีความเสี่ยง",
  en: "The AI council vote is analysis to support your decision, not investment advice. Trading involves risk.",
};

const DECISION_TH: Record<CouncilDecision, string> = {
  BUY: "ซื้อ",
  SELL: "ขาย",
  WAIT: "รอ",
  REDUCE_LOT: "ลดล็อต",
  CLOSE: "ปิดสถานะ",
};

export function runCouncil(ctx: CouncilContext): CouncilResult {
  const risk = riskAgent(ctx);
  const agents: AgentOpinion[] = [
    trendAgent(ctx),
    momentumAgent(ctx),
    volatilityAgent(ctx),
    priceActionAgent(ctx),
    risk,
    newsAgent(ctx),
  ];

  const counts: Record<CouncilVote, number> = { BUY: 0, SELL: 0, WAIT: 0, REDUCE_LOT: 0, CLOSE: 0 };
  for (const a of agents) counts[a.vote]++;

  const buy = counts.BUY;
  const sell = counts.SELL;
  const riskPass = risk.gate === "pass";
  const met: "BUY" | "SELL" | null = buy >= THRESHOLD ? "BUY" : sell >= THRESHOLD ? "SELL" : null;
  const strongNews = ctx.snapshot.newsRisk.warning;

  // Apply the quorum rule with the Risk Manager gate layered on top.
  let decision: CouncilDecision;
  let overridden = false;
  if (risk.vote === "CLOSE") {
    // Emergency: drawdown / margin critical → close positions.
    decision = "CLOSE";
    overridden = met !== null;
  } else if (strongNews) {
    // Strong news imminent → reduce lot if there's a directional lean, else wait.
    decision = buy >= 3 || sell >= 3 ? "REDUCE_LOT" : "WAIT";
    overridden = met !== null;
  } else if (risk.gate === "block") {
    // Market closed / extreme volatility → stand aside.
    decision = "WAIT";
    overridden = met !== null;
  } else if (met === "BUY" && riskPass) {
    decision = "BUY";
  } else if (met === "SELL" && riskPass) {
    decision = "SELL";
  } else if (risk.gate === "caution" && met !== null) {
    // Quorum met but risk elevated → take it smaller.
    decision = "REDUCE_LOT";
    overridden = true;
  } else {
    // Not enough votes → no trade.
    decision = "WAIT";
  }

  // Confidence.
  let confidence: number;
  if (decision === "BUY" || decision === "SELL") {
    const side = decision;
    const voters = agents.filter((a) => a.vote === side);
    const avgConf = voters.length ? voters.reduce((s, a) => s + a.confidence, 0) / voters.length : 50;
    const cnt = side === "BUY" ? buy : sell;
    confidence = Math.round(clamp(avgConf * (0.55 + 0.45 * (cnt / 6)), 0, 99));
  } else if (decision === "CLOSE") {
    confidence = risk.confidence;
  } else if (decision === "REDUCE_LOT") {
    confidence = Math.round(clamp(60 + Math.max(buy, sell) * 4, 0, 85));
  } else {
    // WAIT — higher confidence the more agents actively said WAIT/blocked.
    confidence = Math.round(clamp(40 + counts.WAIT * 6, 0, 80));
  }

  const riskFlags = risk.reasons.filter(() => risk.gate !== "pass");

  const summary: Bilingual = {
    th: `สภา AI มีมติ "${DECISION_TH[decision]}" เชื่อมั่น ${confidence}% — โหวต ซื้อ ${buy}/6 · ขาย ${sell}/6 (ต้องการ ≥ ${THRESHOLD}) · Risk Manager: ${risk.gate === "pass" ? "ผ่าน" : risk.gate === "caution" ? "ระวัง" : "ยับยั้ง"}`,
    en: `AI council decision "${decision}" at ${confidence}% — votes BUY ${buy}/6 · SELL ${sell}/6 (need ≥ ${THRESHOLD}) · Risk Manager: ${risk.gate}`,
  };

  return {
    symbol: ctx.snapshot.symbol,
    price: ctx.snapshot.price,
    decision,
    confidence,
    counts,
    quorum: { threshold: THRESHOLD, buy, sell, riskPass, met },
    agents,
    riskFlags,
    overridden,
    summary,
    disclaimer: DISCLAIMER,
    timestamp: new Date().toISOString(),
  };
}
