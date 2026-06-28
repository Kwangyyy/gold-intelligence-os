// Shared types for the Market Overview Dashboard (Module 1).
// The API route returns a single MarketSnapshot; the UI renders it.

export type MarketCondition =
  | "strong_bullish"
  | "bullish"
  | "sideway"
  | "bearish"
  | "strong_bearish"
  | "high_volatility"
  | "low_liquidity";

export type VolatilityStatus = "low" | "normal" | "elevated" | "extreme";

export type RecommendationLabel =
  | "strong_buy"
  | "buy"
  | "buy_on_pullback"
  | "wait"
  | "sell_on_rally"
  | "sell"
  | "strong_sell"
  | "no_trade"
  | "high_news_risk";

export type RiskLevel = "low" | "medium" | "high" | "extreme";

export type TradingSession =
  | "sydney"
  | "tokyo"
  | "london"
  | "newyork"
  | "london_newyork_overlap"
  | "closed";

export type NewsImpact = "low" | "medium" | "high";

// AI output follows the PRD §12 "AI Output Standard".
// Text fields carry both languages so the UI can switch instantly.
export interface Bilingual {
  th: string;
  en: string;
}

export interface AiRecommendation {
  label: RecommendationLabel;
  confidence: number; // 0-100
  riskLevel: RiskLevel;
  mainReasons: Bilingual[];
  oppositeRisk: Bilingual;
  invalidation: Bilingual;
  suggestedAction: Bilingual;
  disclaimer: Bilingual;
}

export interface NewsEventSnapshot {
  name: Bilingual;
  country: string;
  impact: NewsImpact;
  // ISO timestamp of the event
  time: string;
  forecast?: string;
  previous?: string;
  // AI-generated "why this matters for gold" (Gemini); undefined if unavailable
  impactAnalysis?: Bilingual;
}

export interface NewsRisk {
  level: RiskLevel;
  // Minutes until the next high-impact event (null if none upcoming today)
  minutesToNext: number | null;
  nextEvent: NewsEventSnapshot | null;
  // PRD §12: warning if a strong event is within 30 minutes
  warning: boolean;
}

export interface SessionInfo {
  current: TradingSession;
  // Minutes until London / New York open (0 if already open)
  minutesToLondonOpen: number;
  minutesToNewYorkOpen: number;
  londonOpen: boolean;
  newYorkOpen: boolean;
}

// --- Module 2: Multi-Timeframe Analysis -----------------------------------
export type TimeframeCode = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1" | "MN";

export type TfTrend = "bullish" | "bearish" | "neutral";
export type TfSignal = "strong_buy" | "buy" | "wait" | "sell" | "strong_sell";
export type EmaStatus = "strong_up" | "up" | "mixed" | "down" | "strong_down" | "na";
export type MacdState = "bull" | "bear" | "neutral";

export interface TimeframeRow {
  tf: TimeframeCode;
  available: boolean;
  trend: TfTrend;
  emaStatus: EmaStatus;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  macdHistogram: number | null;
  macdState: MacdState;
  adx: number | null;
  atr: number | null;
  structure: TfTrend;
  signal: TfSignal;
  confidence: number; // 0-100
}

export interface MultiTimeframe {
  symbol: string;
  source: string;
  rows: TimeframeRow[];
  overall: {
    // Reuses RecommendationLabel vocabulary so the UI can translate it.
    bias: RecommendationLabel;
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
    explanation: Bilingual;
  };
  timestamp: string;
}

// --- Modules 13 & 14: Portfolio / EA Monitor (simulated) -------------------
export interface OpenPosition {
  ea: string;
  direction: "buy" | "sell";
  lots: number;
  entry: number;
  current: number;
  floating: number;
}

export interface EaStat {
  name: string;
  status: "running" | "paused";
  currentGrid: number;
  winRate: number; // %
  profitFactor: number;
  recoveryFactor: number;
  todayProfit: number;
}

export type HealthLabel = "healthy" | "watch" | "risky" | "critical";

export interface PortfolioSnapshot {
  simulated: true;
  symbol: string;
  balance: number;
  equity: number;
  floatingPL: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number; // %
  drawdownPct: number;
  todayProfit: number;
  weeklyProfit: number;
  monthlyProfit: number;
  lotExposure: number;
  netDirection: "long" | "short" | "flat";
  positions: OpenPosition[];
  eas: EaStat[];
  equityCurve: number[]; // recent daily equity points
  healthScore: number; // 0-100
  healthLabel: HealthLabel;
  timestamp: string;
}

// --- Module 11: Trading Plan ----------------------------------------------
export interface TradePlan {
  symbol: string;
  source: string;
  price: number;
  atr: number;
  direction: "long" | "short" | "none";
  bias: RecommendationLabel;
  confidence: number;
  entryZone: { low: number; high: number } | null;
  stopLoss: number | null;
  takeProfits: number[]; // TP1, TP2, TP3
  riskReward: number | null; // to TP2
  invalidation: number | null;
  newsWarning: boolean;
  reason: Bilingual;
  alternative: Bilingual;
  timestamp: string;
}

// --- Module 7: Intermarket Correlation ------------------------------------
export interface CorrelationInstrument {
  key: string; // i18n key, e.g. "ins_dxy"
  symbol: string;
  price: number;
  changePct: number; // recent daily change %
  correlation: number; // -1..1 of daily returns vs gold
  impact: "supportive" | "pressure" | "neutral";
  strength: number; // 0-100 contribution magnitude
  available: boolean;
}

export interface IntermarketCorrelation {
  symbol: string;
  source: string;
  goldChangePct: number;
  goldSupportScore: number; // 0-100 (50 = neutral)
  netBias: "supportive" | "pressure" | "neutral";
  supportive: CorrelationInstrument[];
  pressure: CorrelationInstrument[];
  instruments: CorrelationInstrument[];
  divergences: { key: string; note: Bilingual }[];
  timestamp: string;
}

// --- Module 4: Smart Money Concept ----------------------------------------
export type SmcBias = "bullish" | "bearish" | "neutral";

export interface OrderBlock {
  kind: "bullish" | "bearish";
  top: number;
  bottom: number;
  mitigated: boolean;
}

export interface FairValueGap {
  kind: "bullish" | "bearish";
  top: number;
  bottom: number;
  filled: boolean;
}

export interface LiquidityPool {
  side: "buyside" | "sellside"; // buyside = above price (equal highs), sellside = below
  price: number;
  swept: boolean;
}

export interface StructureEvent {
  type: "BOS" | "CHoCH";
  direction: "bullish" | "bearish";
  level: number;
}

export interface SmcAnalysis {
  symbol: string;
  source: string;
  tf: TimeframeCode;
  price: number;
  bias: SmcBias;
  premiumDiscount: {
    position: number; // 0 (discount/low) .. 100 (premium/high)
    zone: "premium" | "discount" | "equilibrium";
    rangeHigh: number;
    rangeLow: number;
  };
  keyOrderBlock: OrderBlock | null;
  liquidityTarget: { side: "buyside" | "sellside"; price: number } | null;
  invalidation: number | null;
  possibleSweep: { side: "buyside" | "sellside"; price: number } | null;
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  liquidity: LiquidityPool[];
  events: StructureEvent[];
  reason: Bilingual;
  timestamp: string;
  candles: Array<{ o: number; h: number; l: number; c: number }>;
}

// --- Module 5: Support & Resistance ---------------------------------------
export interface SRLevel {
  price: number;
  side: "support" | "resistance";
  sources: string[]; // i18n source keys (e.g. "src_pivot")
  strength: number; // 0-100 relative confluence strength
  distancePct: number; // % distance from current price
}

export interface SupportResistance {
  symbol: string;
  source: string;
  price: number; // current reference price
  resistances: SRLevel[]; // nearest-first above price (R1..R3)
  supports: SRLevel[]; // nearest-first below price (S1..S3)
  keyLevel: { price: number; side: "support" | "resistance"; sources: string[]; reason: Bilingual } | null;
  timestamp: string;
}

// --- Module 3: Technical Intelligence -------------------------------------
export type IndSignal = "bull" | "bear" | "neutral";
export type IndicatorCategory = "trend" | "momentum" | "volatility" | "levels";

export interface IndicatorReading {
  key: string; // i18n key, e.g. "ind_rsi"
  value: string; // pre-formatted display value
  detail?: string; // optional secondary line (e.g. level prices)
  signal: IndSignal;
}

export interface TechnicalScore {
  symbol: string;
  source: string;
  tf: TimeframeCode;
  price: number;
  technicalScore: number; // 0-100 (50 neutral)
  trendScore: number; // 0-100
  momentumScore: number; // 0-100
  volatilityScore: number; // 0-100 (level of volatility, not direction)
  reversalRisk: number; // 0-100
  breakoutProbability: number; // 0-100
  signal: TfSignal;
  indicators: Record<IndicatorCategory, IndicatorReading[]>;
  timestamp: string;
}

export interface MarketSnapshot {
  symbol: string; // "XAUUSD"
  source: string; // price data source label
  isLive: boolean; // false when serving fallback price data
  aiSource: "gemini" | "fallback"; // whether the AI fields came from Gemini or the rule-based stub

  // --- Real fields (from price feed) ---
  price: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  change: number; // price - previousClose
  changePercent: number;
  dailyRange: number; // high - low

  // --- Derived / mocked ---
  spread: number; // simulated (mock)
  atr: number; // computed from intraday or estimated
  volatilityStatus: VolatilityStatus;
  marketCondition: MarketCondition;
  marketScore: number; // 0-100

  session: SessionInfo;
  recommendation: AiRecommendation;
  newsRisk: NewsRisk;

  timestamp: string; // ISO time this snapshot was produced
}
