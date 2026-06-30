// Gemini (Google AI Studio) integration. Server-side only — never import from
// client components. Uses the REST generateContent endpoint with structured
// JSON output so the model returns data that maps directly onto our types.

import type {
  AiRecommendation,
  Bilingual,
  NewsEventSnapshot,
  RecommendationLabel,
  RiskLevel,
} from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_KEY = process.env.GEMINI_API_KEY || "";

export const geminiEnabled = () => API_KEY.length > 0;

// Disclaimer wording is fixed on our side for compliance — never model-generated.
const PRD_DISCLAIMER: Bilingual = {
  th: "ข้อมูลนี้เป็นการวิเคราะห์เพื่อประกอบการตัดสินใจ ไม่ใช่การรับประกันผลกำไร การลงทุนมีความเสี่ยง โปรดศึกษาข้อมูลก่อนตัดสินใจ",
  en: "This is analysis to support your decision, not a guarantee of profit. Trading involves risk — do your own research before deciding.",
};

const RECO_LABELS: RecommendationLabel[] = [
  "strong_buy",
  "buy",
  "buy_on_pullback",
  "wait",
  "sell_on_rally",
  "sell",
  "strong_sell",
  "no_trade",
  "high_news_risk",
];

const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "extreme"];

interface GeminiSchema {
  type: string;
  [k: string]: unknown;
}

// Low-level call: prompt + responseSchema -> parsed JSON object.
// Retries up to 2× on 503/429 (transient overload) with 1.5s backoff.
async function generateJson<T>(prompt: string, schema: GeminiSchema, signal?: AbortSignal): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.3,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const MAX_TRIES = 3;
  let lastErr = "";
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json" },
      body,
      signal,
      cache: "no-store",
    });
    if (res.status === 503 || res.status === 429) {
      lastErr = `Gemini ${res.status}`;
      continue; // retry
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no content");
    return JSON.parse(text) as T;
  }
  throw new Error(`${lastErr} — model overloaded, all retries exhausted`);
}

// --- Conversational chat (Module 16: AI Chat Copilot) ----------------------
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_RULES = `You are the AI Copilot of "Gold Intelligence OS", an XAUUSD (gold) analysis platform.
Answer the user's question using the LIVE SYSTEM DATA provided below.

Rules:
- Base answers on the system data. If something isn't in the data, say you don't have it — do not invent numbers.
- Separate fact from opinion: state the data (fact), then your interpretation (opinion).
- Risk-first: always mention the relevant risk. NEVER promise or imply guaranteed profit; do not use words like "guaranteed", "sure win", "can't lose", "100% safe", "get rich".
- Reply in the SAME language the user used (Thai or English). Be concise and practical.
- End with a one-line risk reminder that this is analysis, not financial advice.`;

// Free-text chat grounded in the current platform data.
export async function chatWithContext(
  messages: ChatMessage[],
  contextText: string,
  signal?: AbortSignal
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${CHAT_RULES}\n\n=== LIVE SYSTEM DATA ===\n${contextText}` }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.5, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return text.trim();
}

const BILINGUAL_SCHEMA = {
  type: "OBJECT",
  properties: { th: { type: "STRING" }, en: { type: "STRING" } },
  required: ["th", "en"],
};

const RECO_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    label: { type: "STRING", enum: RECO_LABELS },
    confidence: { type: "INTEGER" },
    riskLevel: { type: "STRING", enum: RISK_LEVELS },
    mainReasons: { type: "ARRAY", items: BILINGUAL_SCHEMA },
    oppositeRisk: BILINGUAL_SCHEMA,
    invalidation: BILINGUAL_SCHEMA,
    suggestedAction: BILINGUAL_SCHEMA,
  },
  required: ["label", "confidence", "riskLevel", "mainReasons", "oppositeRisk", "invalidation", "suggestedAction"],
};

export interface RecommendationInput {
  price: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  changePercent: number;
  atr: number;
  dailyRange: number;
  volatilityStatus: string;
  marketCondition: string;
  marketScore: number;
  session: string;
  newsRiskLevel: string;
  nextEvent?: { name: string; minutesToNext: number | null } | null;
}

const clampInt = (n: unknown, lo: number, hi: number, fb: number) => {
  const v = typeof n === "number" ? Math.round(n) : NaN;
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fb;
};

// Produces the full PRD §12 recommendation from live market data via Gemini.
export async function generateRecommendation(
  input: RecommendationInput,
  signal?: AbortSignal
): Promise<AiRecommendation> {
  const prompt = `You are the Chief Investment Officer of a gold (XAUUSD) trading desk.
Analyze ONLY the data below and produce a structured trading view.

Market data (JSON):
${JSON.stringify(input, null, 2)}

Rules:
- "label" MUST be one of: ${RECO_LABELS.join(", ")}.
- "confidence" is an integer 0-100 reflecting how decisive the data is.
- Provide 2-4 concise "mainReasons", each referencing the ACTUAL numbers above.
- Always include an honest "oppositeRisk" (what could make this view wrong) and a concrete "invalidation" level/condition (use the high/low/price numbers).
- "suggestedAction" must be practical and risk-aware.
- If a high-impact event is within ~30 minutes, prefer "high_news_risk".
- Risk-first: NEVER promise or imply guaranteed profit. Do NOT use phrases like "guaranteed", "sure profit", "can't lose", "100% safe", "get rich".
- Write every "th" field in natural Thai and every "en" field in natural English. Keep each field to 1-2 sentences.
This is analysis, not financial advice.`;

  const raw = await generateJson<{
    label: string;
    confidence: number;
    riskLevel: string;
    mainReasons: Bilingual[];
    oppositeRisk: Bilingual;
    invalidation: Bilingual;
    suggestedAction: Bilingual;
  }>(prompt, RECO_SCHEMA, signal);

  const label = (RECO_LABELS.includes(raw.label as RecommendationLabel)
    ? raw.label
    : "wait") as RecommendationLabel;
  const riskLevel = (RISK_LEVELS.includes(raw.riskLevel as RiskLevel)
    ? raw.riskLevel
    : "medium") as RiskLevel;

  const reasons = Array.isArray(raw.mainReasons) ? raw.mainReasons.slice(0, 4) : [];

  return {
    label,
    confidence: clampInt(raw.confidence, 0, 100, 50),
    riskLevel,
    mainReasons: reasons.length ? reasons : [{ th: "ข้อมูลไม่เพียงพอ", en: "Insufficient data" }],
    oppositeRisk: raw.oppositeRisk ?? { th: "—", en: "—" },
    invalidation: raw.invalidation ?? { th: "—", en: "—" },
    suggestedAction: raw.suggestedAction ?? { th: "—", en: "—" },
    disclaimer: PRD_DISCLAIMER,
  };
}

// Produces an AI analysis of a calendar event's impact on gold.
export async function generateCalendarGoldImpact(
  event: { title: string; country: string; impact: string; forecast?: string; previous?: string },
  signal?: AbortSignal
): Promise<Bilingual> {
  const prompt = `You are a macro analyst for a gold (XAUUSD) trading desk.
Explain in 1-2 sentences how the economic event below could affect gold prices.
Focus on the USD / Fed / yields / risk-sentiment linkage.
Be specific about direction bias (bullish/bearish for gold) given the forecast vs previous.
Never guarantee outcomes.

Event: ${event.title}
Country: ${event.country}
Impact: ${event.impact}
Forecast: ${event.forecast ?? "n/a"}
Previous: ${event.previous ?? "n/a"}

Write "th" in concise Thai and "en" in concise English.`;

  return generateJson<Bilingual>(prompt, BILINGUAL_SCHEMA, signal);
}

// ── Daily Brief ───────────────────────────────────────────────────────────────

export interface BriefSection {
  id: string;
  icon: string;
  title: string;
  titleTh: string;
  content: string;
  contentTh: string;
}

export interface DailyBrief {
  date: string;
  headline: string;
  headlineTh: string;
  summary: string;
  summaryTh: string;
  bias: "bullish" | "bearish" | "neutral";
  confidence: "high" | "medium" | "low";
  sections: BriefSection[];
  price: number;
  change: number;
  changePct: number;
  generatedAt: string;
}

export interface BriefInput {
  date: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  sma20: number;
  rsi14: number;
  atr: number;
  session: string;
  events: { title: string; country: string; impact: string; forecast?: string; previous?: string }[];
  supports: number[];
  resistances: number[];
}

const BRIEF_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    headline:   { type: "STRING" },
    headlineTh: { type: "STRING" },
    summary:    { type: "STRING" },
    summaryTh:  { type: "STRING" },
    bias:       { type: "STRING", enum: ["bullish", "bearish", "neutral"] },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id:        { type: "STRING" },
          icon:      { type: "STRING" },
          title:     { type: "STRING" },
          titleTh:   { type: "STRING" },
          content:   { type: "STRING" },
          contentTh: { type: "STRING" },
        },
        required: ["id","icon","title","titleTh","content","contentTh"],
      },
    },
  },
  required: ["headline","headlineTh","summary","summaryTh","bias","confidence","sections"],
};

function ruleBasedBrief(input: BriefInput): DailyBrief {
  const trendUp   = input.price > input.sma20;
  const bias: DailyBrief["bias"] = input.changePct > 0.3 ? "bullish" : input.changePct < -0.3 ? "bearish" : "neutral";
  const rsiStatus = input.rsi14 > 70 ? "Overbought" : input.rsi14 < 30 ? "Oversold" : "Neutral";
  const rsiStatusTh = input.rsi14 > 70 ? "ซื้อมากเกินไป" : input.rsi14 < 30 ? "ขายมากเกินไป" : "เป็นกลาง";
  const dirEn = input.change >= 0 ? "up" : "down";
  const dirTh = input.change >= 0 ? "ขึ้น" : "ลง";
  const sup = input.supports[0] ?? input.price - input.atr * 1.5;
  const res = input.resistances[0] ?? input.price + input.atr * 1.5;

  const evtList = input.events.length > 0
    ? input.events.map((e) => `${e.title} (${e.country})`).join(", ")
    : "ไม่มีเหตุการณ์สำคัญ / no major events";

  return {
    headline:   `Gold ${dirEn} ${Math.abs(input.changePct).toFixed(2)}% — ${trendUp ? "Above" : "Below"} 20-day SMA`,
    headlineTh: `ทองคำ${dirTh} ${Math.abs(input.changePct).toFixed(2)}% — ${trendUp ? "เหนือ" : "ต่ำกว่า"} SMA 20 วัน`,
    summary:    `Gold trades at $${input.price.toFixed(2)}, ${dirEn} ${Math.abs(input.changePct).toFixed(2)}% today. RSI(14) at ${input.rsi14.toFixed(1)} (${rsiStatus}), price is ${trendUp ? "above" : "below"} the 20-day SMA — bias leans ${bias}.`,
    summaryTh:  `ทองคำเทรดที่ $${input.price.toFixed(2)} ${dirTh} ${Math.abs(input.changePct).toFixed(2)}% วันนี้ RSI(14) ที่ ${input.rsi14.toFixed(1)} (${rsiStatusTh}) ราคาอยู่${trendUp ? "เหนือ" : "ต่ำกว่า"} SMA 20 วัน — แนวโน้มเอียงไปทาง${bias === "bullish" ? "ขาขึ้น" : bias === "bearish" ? "ขาลง" : "กลาง"}`,
    bias,
    confidence: "medium",
    sections: [
      { id: "overview", icon: "📊", title: "Market Overview", titleTh: "ภาพรวมตลาด",
        content: `Gold is trading at $${input.price.toFixed(2)} during the ${input.session}, ${dirEn} $${Math.abs(input.change).toFixed(2)} (${Math.abs(input.changePct).toFixed(2)}%) on the day. Day range: $${input.low.toFixed(2)} — $${input.high.toFixed(2)}.`,
        contentTh: `ทองคำเทรดที่ $${input.price.toFixed(2)} ในช่วง ${input.session} ${dirTh} $${Math.abs(input.change).toFixed(2)} (${Math.abs(input.changePct).toFixed(2)}%) ของวัน ช่วงราคาวันนี้: $${input.low.toFixed(2)} — $${input.high.toFixed(2)}` },
      { id: "technical", icon: "📈", title: "Technical Analysis", titleTh: "วิเคราะห์เทคนิค",
        content: `RSI(14) is at ${input.rsi14.toFixed(1)} (${rsiStatus}). Price is ${trendUp ? "above" : "below"} the SMA(20) at $${input.sma20.toFixed(2)} — a ${trendUp ? "bullish" : "bearish"} signal. ATR(14) of $${input.atr.toFixed(2)} indicates ${input.atr > 20 ? "elevated" : "normal"} volatility.`,
        contentTh: `RSI(14) อยู่ที่ ${input.rsi14.toFixed(1)} (${rsiStatusTh}) ราคาอยู่${trendUp ? "เหนือ" : "ต่ำกว่า"} SMA(20) ที่ $${input.sma20.toFixed(2)} ซึ่งเป็นสัญญาณ${trendUp ? "ขาขึ้น" : "ขาลง"} ATR(14) ที่ $${input.atr.toFixed(2)} บ่งชี้ความผันผวน${input.atr > 20 ? "สูง" : "ปกติ"}` },
      { id: "events", icon: "📅", title: "Key Events Today", titleTh: "เหตุการณ์สำคัญ",
        content: `Today's calendar: ${evtList}.`,
        contentTh: `ปฏิทินวันนี้: ${evtList}` },
      { id: "strategy", icon: "🎯", title: "Trading Strategy", titleTh: "กลยุทธ์การเทรด",
        content: `Bias leans ${bias}. Watch for reaction near support $${sup.toFixed(2)} and resistance $${res.toFixed(2)}. Use tight risk management given current volatility (ATR $${input.atr.toFixed(2)}).`,
        contentTh: `แนวโน้มเอียงไปทาง${bias === "bullish" ? "ขาขึ้น" : bias === "bearish" ? "ขาลง" : "กลาง"} จับตาปฏิกิริยาราคาใกล้แนวรับ $${sup.toFixed(2)} และแนวต้าน $${res.toFixed(2)} บริหารความเสี่ยงให้รัดกุมเนื่องจากความผันผวนปัจจุบัน (ATR $${input.atr.toFixed(2)})` },
      { id: "risks", icon: "⚠️", title: "Risk Factors", titleTh: "ปัจจัยความเสี่ยง",
        content: `A reversal from ${trendUp ? "support" : "resistance"} levels could invalidate the current bias. Unexpected news or shifts in broader market sentiment can move gold quickly.`,
        contentTh: `การกลับตัวจาก${trendUp ? "แนวรับ" : "แนวต้าน"} อาจทำให้แนวโน้มปัจจุบันเปลี่ยนไป ข่าวที่ไม่คาดคิดหรือการเปลี่ยนแปลงอารมณ์ตลาดอาจทำให้ราคาทองคำเคลื่อนไหวอย่างรวดเร็ว` },
      { id: "watchlist", icon: "🔍", title: "Price Levels to Watch", titleTh: "ระดับราคาที่ต้องจับตา",
        content: `Key support at $${sup.toFixed(2)}, resistance at $${res.toFixed(2)}. A break of either level could signal the next directional move.`,
        contentTh: `แนวรับสำคัญที่ $${sup.toFixed(2)} แนวต้านที่ $${res.toFixed(2)} การทะลุระดับใดระดับหนึ่งอาจส่งสัญญาณการเคลื่อนไหวครั้งต่อไป` },
    ],
    price: input.price,
    change: input.change,
    changePct: input.changePct,
    date: input.date,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateDailyBrief(input: BriefInput, signal?: AbortSignal): Promise<DailyBrief> {
  if (!API_KEY) return ruleBasedBrief(input);

  const evtList = input.events.length > 0
    ? input.events.map((e) => `• ${e.title} (${e.country}, ${e.impact}) — Forecast: ${e.forecast ?? "n/a"} | Prev: ${e.previous ?? "n/a"}`).join("\n")
    : "• No major scheduled events";

  const trendDir = input.price > input.sma20 ? "ABOVE" : "BELOW";
  const rsiStatus = input.rsi14 > 70 ? "Overbought" : input.rsi14 < 30 ? "Oversold" : "Neutral";

  const prompt = `You are the Chief Gold Market Analyst at a professional trading firm.
Write a comprehensive, actionable Daily Gold Market Brief for traders.

=== LIVE MARKET DATA (${input.date}) ===
Price      : $${input.price.toFixed(2)}
Change     : ${input.change >= 0 ? "+" : ""}$${input.change.toFixed(2)} (${input.changePct >= 0 ? "+" : ""}${input.changePct.toFixed(2)}%)
Day Range  : $${input.low.toFixed(2)} — $${input.high.toFixed(2)}
ATR(14)    : $${input.atr.toFixed(2)}
SMA(20)    : $${input.sma20.toFixed(2)} → price is ${trendDir} 20-day avg
RSI(14)    : ${input.rsi14.toFixed(1)} (${rsiStatus})
Session    : ${input.session}

Key Support    : ${input.supports.map((s) => "$" + s.toFixed(2)).join(", ") || "—"}
Key Resistance : ${input.resistances.map((r) => "$" + r.toFixed(2)).join(", ") || "—"}

Today's Events:
${evtList}

=== INSTRUCTIONS ===
Generate 6 sections:
1. id:"overview"   icon:"📊" title:"Market Overview"       titleTh:"ภาพรวมตลาด"
2. id:"technical"  icon:"📈" title:"Technical Analysis"    titleTh:"วิเคราะห์เทคนิค"
3. id:"events"     icon:"📅" title:"Key Events Today"      titleTh:"เหตุการณ์สำคัญ"
4. id:"strategy"   icon:"🎯" title:"Trading Strategy"      titleTh:"กลยุทธ์การเทรด"
5. id:"risks"      icon:"⚠️"  title:"Risk Factors"         titleTh:"ปัจจัยความเสี่ยง"
6. id:"watchlist"  icon:"🔍" title:"Price Levels to Watch" titleTh:"ระดับราคาที่ต้องจับตา"

Rules:
- Each section: 3-5 sentences, specific and data-driven, not generic
- content in English, contentTh in professional Thai
- headline: punchy 10-word max headline summarising today's key theme
- summary: 2-3 sentences covering the main outlook
- bias: overall gold bias for the session
- NEVER promise guaranteed profits. Include risk perspective in strategy section.`;

  let raw: Omit<DailyBrief,"price"|"change"|"changePct"|"generatedAt"|"date">;
  try {
    raw = await generateJson<Omit<DailyBrief,"price"|"change"|"changePct"|"generatedAt"|"date">>(
      prompt, BRIEF_SCHEMA, signal
    );
  } catch {
    // Gemini unavailable (overload/rate-limit) — fall back so the Brief page still works
    return ruleBasedBrief(input);
  }

  return {
    ...raw,
    price: input.price,
    change: input.change,
    changePct: input.changePct,
    date: input.date,
    generatedAt: new Date().toISOString(),
  };
}

// ── Trade Setup (Paper Trader AI Coach) ─────────────────────────────────────

export interface TradeSetup {
  direction:      "buy" | "sell" | "wait";
  confidence:     number;
  setupType:      string;
  entry:          number;
  sl:             number;
  tp1:            number;
  tp2:            number | null;
  tp3:            number | null;
  rr1:            number;
  rr2:            number | null;
  rr3:            number | null;
  biasTh:         string;
  biasEn:         string;
  reasoningTh:    string[];
  risksTh:        string[];
  invalidationTh: string;
}

const STRATEGY_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    direction:     { type: "string" },
    confidence:    { type: "number" },
    setupType:     { type: "string" },
    entry:         { type: "number" },
    sl:            { type: "number" },
    tp1:           { type: "number" },
    tp2:           { type: "number" },
    tp3:           { type: "number" },
    rr1:           { type: "number" },
    rr2:           { type: "number" },
    rr3:           { type: "number" },
    biasTh:        { type: "string" },
    biasEn:        { type: "string" },
    reasoningTh:   { type: "array", items: { type: "string" } },
    risksTh:       { type: "array", items: { type: "string" } },
    invalidationTh:{ type: "string" },
  },
  required: [
    "direction","confidence","setupType","entry","sl","tp1","tp2","tp3",
    "rr1","rr2","rr3","biasTh","biasEn","reasoningTh","risksTh","invalidationTh",
  ],
};

interface RawTradeSetup {
  direction: string; confidence: number; setupType: string;
  entry: number; sl: number; tp1: number; tp2: number; tp3: number;
  rr1: number; rr2: number; rr3: number;
  biasTh: string; biasEn: string;
  reasoningTh: string[]; risksTh: string[]; invalidationTh: string;
}

function ruleBasedSetup(input: {
  price: number; ema20: number; ema50: number; rsi: number; macdHist: number; atr: number;
}): TradeSetup {
  const { price: p, ema20, ema50, rsi: rsiV, macdHist, atr: atrV } = input;
  const bullish = p > ema20 && ema20 > ema50 && macdHist > 0;
  const bearish = p < ema20 && ema20 < ema50 && macdHist < 0;
  if (!bullish && !bearish) {
    return {
      direction: "wait", confidence: 40, setupType: "Sideways / No Clear Signal",
      entry: p, sl: 0, tp1: 0, tp2: null, tp3: null, rr1: 0, rr2: null, rr3: null,
      biasTh: "ตลาดกำลังออกข้าง ยังไม่มีสัญญาณที่ชัดเจน แนะนำให้รอก่อน",
      biasEn: "Sideways market — no clear signal, wait for confirmation.",
      reasoningTh: ["EMA20 และ EMA50 ยังไม่ Cross กันอย่างชัดเจน", `RSI ${rsiV.toFixed(1)} อยู่ในโซน Neutral ยังไม่สุดขีด`, "MACD Histogram ยังอ่อนแอ ไม่มีโมเมนตัมชัดเจน"],
      risksTh: ["การเข้าเทรดในช่วง Sideways มีความเสี่ยงสูงจาก Whipsaw", "รอ Breakout ที่ชัดเจนก่อนเสมอ"],
      invalidationTh: "รอจนกว่า EMA20 จะ Cross EMA50 พร้อม Volume ยืนยัน",
    };
  }
  const dir = bullish ? "buy" : "sell";
  const slD = atrV * 1.5;
  const sl  = dir === "buy" ? p - slD : p + slD;
  const tp1 = dir === "buy" ? p + slD * 1.8 : p - slD * 1.8;
  const tp2 = dir === "buy" ? p + slD * 3.0 : p - slD * 3.0;
  const tp3 = dir === "buy" ? p + slD * 4.5 : p - slD * 4.5;
  return {
    direction: dir, confidence: 65,
    setupType: dir === "buy" ? "EMA Bullish Trend-Following" : "EMA Bearish Trend-Following",
    entry: +p.toFixed(2), sl: +sl.toFixed(2),
    tp1: +tp1.toFixed(2), tp2: +tp2.toFixed(2), tp3: +tp3.toFixed(2),
    rr1: 1.8, rr2: 3.0, rr3: 4.5,
    biasTh: dir === "buy"
      ? `ทองคำมีแนวโน้มขาขึ้น EMA20 ($${ema20.toFixed(0)}) อยู่เหนือ EMA50 ($${ema50.toFixed(0)})`
      : `ทองคำมีแนวโน้มขาลง EMA20 ($${ema20.toFixed(0)}) อยู่ต่ำกว่า EMA50 ($${ema50.toFixed(0)})`,
    biasEn: dir === "buy"
      ? `Bullish — EMA20 above EMA50, positive MACD`
      : `Bearish — EMA20 below EMA50, negative MACD`,
    reasoningTh: [
      `ราคา $${p.toFixed(2)} อยู่${dir === "buy" ? "เหนือ" : "ต่ำกว่า"} EMA20 ($${ema20.toFixed(2)}) ยืนยันทิศทาง`,
      `EMA20 ${dir === "buy" ? "เหนือ" : "ต่ำกว่า"} EMA50 ($${ema50.toFixed(2)}) แสดง Trend ระยะกลาง`,
      `MACD Histogram ${macdHist > 0 ? "เป็นบวก" : "เป็นลบ"} (${macdHist.toFixed(2)}) สนับสนุนโมเมนตัม${dir === "buy" ? "ขาขึ้น" : "ขาลง"}`,
      `RSI ${rsiV.toFixed(1)} ยังไม่ Overbought/Oversold มีพื้นที่เคลื่อนที่`,
    ],
    risksTh: [
      `หากราคาหลุด SL $${sl.toFixed(2)} ให้ออกจากออเดอร์ทันที`,
      "ข่าว USD สำคัญ (NFP, CPI, FOMC) อาจพลิกทิศทางได้",
    ],
    invalidationTh: `Setup ล้มเหลวหากราคา${dir === "buy" ? "หลุดต่ำกว่า" : "ขึ้นเกิน"} $${sl.toFixed(2)}`,
  };
}

export async function generateTradeStrategy(input: {
  price: number; ema20: number; ema50: number;
  rsi: number; macdHist: number; atr: number;
  support: number[]; resistance: number[];
  recentCandles: { h: number; l: number; c: number }[];
}): Promise<TradeSetup> {
  if (!API_KEY) return ruleBasedSetup(input);

  const barSummary = input.recentCandles.slice(-6)
    .map(c => `H:${c.h.toFixed(1)} L:${c.l.toFixed(1)} C:${c.c.toFixed(1)}`).join(" | ");
  const pVsEma = input.price > input.ema20 ? "ABOVE EMA20 (bullish)" : "BELOW EMA20 (bearish)";
  const emaRel = input.ema20 > input.ema50 ? "EMA20 > EMA50 (bullish)" : "EMA20 < EMA50 (bearish)";

  const prompt = `You are a professional XAUUSD gold technical analyst. Generate a specific trade setup.

MARKET DATA — H1 Timeframe:
Price: $${input.price.toFixed(2)} — ${pVsEma}
EMA20: $${input.ema20.toFixed(2)} | EMA50: $${input.ema50.toFixed(2)} — ${emaRel}
RSI(14): ${input.rsi.toFixed(1)}${input.rsi > 70 ? " (overbought — caution for buy)" : input.rsi < 30 ? " (oversold — caution for sell)" : ""}
MACD Histogram: ${input.macdHist > 0 ? "+" : ""}${input.macdHist.toFixed(2)}${input.macdHist > 0 ? " (bullish momentum)" : " (bearish momentum)"}
ATR(14): $${input.atr.toFixed(2)} (average volatility per H1 bar)

KEY LEVELS:
Support: ${input.support.map(s => "$" + s.toFixed(1)).join(", ")}
Resistance: ${input.resistance.map(r => "$" + r.toFixed(1)).join(", ")}

RECENT 6 H1 BARS (oldest → newest):
${barSummary}

RULES — follow exactly:
• direction "buy" or "sell" only if confidence >= 58, otherwise "wait"
• BUY: sl MUST be below entry; tp1/tp2/tp3 MUST be above entry
• SELL: sl MUST be above entry; tp1/tp2/tp3 MUST be below entry
• sl distance = 1.2–2.0 × ATR, placed near logical key level
• tp1 = 1.5–2× sl distance; tp2 = 2.5–3.5× sl distance; tp3 = 4–6× sl distance
• Use 0 for tp2, tp3, rr2, rr3 when direction is "wait"
• rr1/rr2/rr3 = reward ÷ risk (e.g. 1.8, 3.0, 4.5)
• reasoningTh: exactly 4 Thai bullets with specific price levels
• risksTh: exactly 3 Thai risk bullets with specific prices
• biasTh: 1 Thai sentence with actual numbers
• setupType: name in English (e.g. "OB Retest", "EMA Pullback", "RSI Divergence Reversal")
• All prices must be realistic near the current price of $${input.price.toFixed(2)}`;

  let raw: RawTradeSetup;
  try {
    raw = await generateJson<RawTradeSetup>(prompt, STRATEGY_SCHEMA);
  } catch {
    // Gemini unavailable — use rule-based fallback so Paper Trader still works
    return ruleBasedSetup(input);
  }
  return {
    direction:      (raw.direction as "buy" | "sell" | "wait") || "wait",
    confidence:     Math.min(100, Math.max(0, raw.confidence || 50)),
    setupType:      raw.setupType || "Unknown",
    entry:          raw.entry || input.price,
    sl:             raw.sl || 0,
    tp1:            raw.tp1 || 0,
    tp2:            (raw.tp2 > 0) ? raw.tp2 : null,
    tp3:            (raw.tp3 > 0) ? raw.tp3 : null,
    rr1:            raw.rr1 || 0,
    rr2:            (raw.rr2 > 0) ? raw.rr2 : null,
    rr3:            (raw.rr3 > 0) ? raw.rr3 : null,
    biasTh:         raw.biasTh || "",
    biasEn:         raw.biasEn || "",
    reasoningTh:    raw.reasoningTh || [],
    risksTh:        raw.risksTh || [],
    invalidationTh: raw.invalidationTh || "",
  };
}

// ── Gold News Sentiment ───────────────────────────────────────────────────────

export interface NewsItemAnalysis {
  index:     number;
  sentiment: "bullish" | "bearish" | "neutral";
  impact:    number;       // 1-3
  summaryTh: string;
  reason:    string;
}

export interface NewsBatchResult {
  analyses:    NewsItemAnalysis[];
  overallScore: number;     // 0-100
  aiSummaryEn: string;
  aiSummaryTh: string;
}

const NEWS_BATCH_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    analyses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index:     { type: "number" },
          sentiment: { type: "string" },
          impact:    { type: "number" },
          summaryTh: { type: "string" },
          reason:    { type: "string" },
        },
        required: ["index","sentiment","impact","summaryTh","reason"],
      },
    },
    overallScore: { type: "number" },
    aiSummaryEn:  { type: "string" },
    aiSummaryTh:  { type: "string" },
  },
  required: ["analyses","overallScore","aiSummaryEn","aiSummaryTh"],
};

function keywordSentiment(headlines: string[]): NewsBatchResult {
  const BULL = ["surge","rally","rise","gain","high","safe haven","geopolit","tension","war","inflation","cpi","rate cut","dovish","weaker dollar","weakness","fed pause","fear"];
  const BEAR = ["fall","drop","decline","plunge","rate hike","hawkish","dollar strength","risk-on","equities rally","lower","calm","ease"];
  const analyses: NewsItemAnalysis[] = headlines.map((h, i) => {
    const lower = h.toLowerCase();
    const b = BULL.filter(w => lower.includes(w)).length;
    const s = BEAR.filter(w => lower.includes(w)).length;
    const sentiment = b > s ? "bullish" : s > b ? "bearish" : "neutral";
    return { index: i, sentiment, impact: 2, summaryTh: h.slice(0, 80), reason: `${b} bullish / ${s} bearish keywords` };
  });
  const bulls = analyses.filter(a => a.sentiment === "bullish").length;
  const bears = analyses.filter(a => a.sentiment === "bearish").length;
  const total = analyses.length || 1;
  return {
    analyses,
    overallScore: Math.round(((bulls - bears) / total) * 30 + 50),
    aiSummaryEn: "Keyword-based analysis (Gemini not configured). Configure GEMINI_API_KEY for AI sentiment.",
    aiSummaryTh: "วิเคราะห์จาก keyword เท่านั้น ตั้งค่า GEMINI_API_KEY เพื่อใช้ AI วิเคราะห์",
  };
}

export async function analyzeNewsSentiment(headlines: string[]): Promise<NewsBatchResult> {
  if (!API_KEY || headlines.length === 0) return keywordSentiment(headlines);

  const numbered = headlines.map((h, i) => `${i}. ${h}`).join("\n");
  const prompt = `You are a professional gold market analyst. Analyze these ${headlines.length} headlines for their impact on XAUUSD gold price.

HEADLINES:
${numbered}

For EACH headline return:
- index: headline number (0-based, exact)
- sentiment: "bullish" (positive for gold) / "bearish" (negative for gold) / "neutral"
- impact: 1 (low), 2 (medium), 3 (high) based on potential price movement
- summaryTh: 1 concise Thai sentence — what this means for gold price specifically
- reason: 1 English sentence — why bullish/bearish/neutral

KEY RULES:
• USD weakness / Fed rate cuts / dovish → bullish gold
• Geopolitical tension / war / sanctions → bullish gold (safe haven)
• High inflation / CPI beat → bullish gold
• USD strength / Fed hawkish / rate hikes → bearish gold
• Risk-on / equity rally / calm markets → bearish gold
• Vague economic data with unclear direction → neutral

ALSO provide:
- overallScore: 0–100 sentiment score (0=extremely bearish, 50=neutral, 100=extremely bullish). Weight high-impact news 3×, medium 2×, low 1×.
- aiSummaryEn: 2–3 sentence English narrative of overall gold market sentiment from these headlines
- aiSummaryTh: same in Thai, mention specific events that matter most`;

  try {
    return await generateJson<NewsBatchResult>(prompt, NEWS_BATCH_SCHEMA);
  } catch {
    return keywordSentiment(headlines);
  }
}

// Produces a plain-language "why this matters for gold" for the next event.
export async function generateNewsImpact(
  event: NewsEventSnapshot,
  signal?: AbortSignal
): Promise<Bilingual> {
  const prompt = `You are a macro analyst. In plain language, explain how the upcoming
economic event below could affect the price of gold (XAUUSD). Consider the typical
USD / Fed / yields linkage. Keep it to 1-2 sentences. Do not give guaranteed outcomes.

Event: ${event.name.en}
Country: ${event.country}
Impact: ${event.impact}
Forecast: ${event.forecast ?? "n/a"}
Previous: ${event.previous ?? "n/a"}

Write "th" in Thai and "en" in English.`;

  return generateJson<Bilingual>(prompt, BILINGUAL_SCHEMA, signal);
}

// ── Journal AI Review ─────────────────────────────────────────────────────────

export interface JournalAnalysis {
  rating: number;
  strengths: string[];
  weaknesses: string[];
  bestSetup: string;
  recommendations: string[];
  summaryTh: string;
  summaryEn: string;
}

export interface JournalTradeSummary {
  totalClosed: number;
  winRate: number;
  totalPnL: number;
  avgRR: number;
  profitFactor: number;
  bySetup: Record<string, { trades: number; wins: number; pnl: number }>;
  byDirection: {
    buy:  { trades: number; wins: number; pnl: number };
    sell: { trades: number; wins: number; pnl: number };
  };
  recentNotes: string[];
}

const JOURNAL_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    rating:          { type: "NUMBER" },
    strengths:       { type: "ARRAY", items: { type: "STRING" } },
    weaknesses:      { type: "ARRAY", items: { type: "STRING" } },
    bestSetup:       { type: "STRING" },
    recommendations: { type: "ARRAY", items: { type: "STRING" } },
    summaryTh:       { type: "STRING" },
    summaryEn:       { type: "STRING" },
  },
  required: ["rating","strengths","weaknesses","bestSetup","recommendations","summaryTh","summaryEn"],
};

export async function analyzeJournalTrades(s: JournalTradeSummary): Promise<JournalAnalysis> {
  if (!API_KEY) return ruleBasedJournalAnalysis(s);

  const bySetupStr = Object.entries(s.bySetup)
    .map(([k, d]) => `${k}: ${d.trades}T ${d.wins}W PnL$${d.pnl.toFixed(0)}`)
    .join("; ");

  const prompt = `You are an expert XAUUSD trading coach reviewing a trader's journal.

STATISTICS:
Total closed: ${s.totalClosed} | Win rate: ${s.winRate.toFixed(1)}% | Total P&L: $${s.totalPnL.toFixed(2)}
Avg R:R: 1:${s.avgRR.toFixed(2)} | Profit factor: ${s.profitFactor.toFixed(2)}
By setup: ${bySetupStr}
Buy: ${s.byDirection.buy.trades}T ${s.byDirection.buy.wins}W $${s.byDirection.buy.pnl.toFixed(0)}
Sell: ${s.byDirection.sell.trades}T ${s.byDirection.sell.wins}W $${s.byDirection.sell.pnl.toFixed(0)}
Recent notes: ${s.recentNotes.slice(0, 5).join(" | ") || "none"}

Analyse the trader performance:
- rating: 1-10, strict and honest
- 3 concrete strengths (Thai language)
- 3 specific weaknesses to fix (Thai language)
- bestSetup: which setup type performed best
- 3-5 actionable recommendations (Thai language)
- summaryTh: 2-3 sentences in Thai
- summaryEn: 2-3 sentences in English
Do NOT promise profits. Focus on process and edge improvement.`;

  try {
    return await generateJson<JournalAnalysis>(prompt, JOURNAL_SCHEMA);
  } catch {
    return ruleBasedJournalAnalysis(s);
  }
}

function ruleBasedJournalAnalysis(s: JournalTradeSummary): JournalAnalysis {
  const pfScore = Math.min(4, (s.profitFactor / 2) * 4);
  const rrScore = Math.min(3, (s.avgRR / 2) * 3);
  const wrScore = Math.min(3, (s.winRate / 60) * 3);
  const rating  = Math.max(1, Math.min(10, Math.round(pfScore + rrScore + wrScore)));

  const bestSetup = Object.entries(s.bySetup)
    .filter(([, d]) => d.trades >= 2)
    .sort(([, a], [, b]) => (b.pnl / b.trades) - (a.pnl / a.trades))[0]?.[0] ?? "—";

  return {
    rating,
    strengths: [
      s.winRate >= 50    ? "Win rate เกิน 50% — มีความสม่ำเสมอในการอ่านทิศทาง" : "มีความพยายามบันทึกไม้อย่างครบถ้วน",
      s.avgRR >= 1.5     ? "R:R เฉลี่ยดีกว่า 1:1.5 — ตั้ง TP ได้เหมาะสม"      : "มีการกำหนด SL ทุกไม้",
      s.profitFactor > 1 ? "Profit Factor > 1 — กลยุทธ์มี edge เชิงบวก"         : "มีข้อมูลเพียงพอสำหรับวิเคราะห์",
    ],
    weaknesses: [
      s.winRate < 45     ? "Win rate ต่ำกว่า 45% — ควรทบทวนเงื่อนไขเข้า"      : "ควรเพิ่มจำนวนตัวอย่างการเทรด",
      s.avgRR < 1.5      ? "R:R เฉลี่ยต่ำกว่า 1:1.5 — TP อาจใกล้เกินไป"      : "ระวัง overtrading ช่วง sideways",
      s.profitFactor < 1 ? "Profit Factor < 1 — ขาดทุนสุทธิ ต้องปรับ setup"  : "ควรบันทึกเหตุผลให้ละเอียดขึ้น",
    ],
    bestSetup,
    recommendations: [
      "Focus เฉพาะ setup ที่มี P&L เป็นบวกและมีจำนวน trades เพียงพอ",
      "กำหนด R:R ขั้นต่ำ 1:1.5 ก่อนเปิดทุกไม้",
      "บันทึก note เหตุผล entry/exit ทุกครั้งเพื่อ review pattern",
      s.totalPnL < 0 ? "ฝึกใน Paper Trader ให้ profitable 2 สัปดาห์ก่อนกลับมา real" : "เพิ่ม lot อย่างค่อยเป็นค่อยไปเมื่อมั่นใจใน edge",
    ],
    summaryTh: `จาก ${s.totalClosed} ไม้ที่ปิดแล้ว Win rate ${s.winRate.toFixed(1)}% Profit Factor ${s.profitFactor.toFixed(2)} คะแนนรวม ${rating}/10`,
    summaryEn: `From ${s.totalClosed} closed trades: win rate ${s.winRate.toFixed(1)}%, profit factor ${s.profitFactor.toFixed(2)}. Overall score ${rating}/10.`,
  };
}
