// EA Code Generator — 16 strategies, 5 lot modes, 3 TP/SL types

export type Language  = "mql4" | "mql5";
export type Direction = "both" | "buy_only" | "sell_only";
export type LogicOp  = "AND" | "OR";
export type TpType   = "fixed" | "atr_mult" | "no_tp";
export type SlType   = "fixed" | "atr_mult" | "swing_hl";
export type LotMode  = "fixed" | "risk_pct" | "martingale" | "anti_martingale" | "grid";

// ── Strategy types ────────────────────────────────────────────────────────────

export type StrategyType =
  | "ema_cross" | "sma_cross" | "triple_ema" | "price_ema"
  | "parabolic_sar" | "adx_di"
  | "rsi" | "stoch_cross" | "macd" | "cci" | "williams_r" | "momentum"
  | "bb_bounce" | "bb_breakout" | "donchian"
  | "engulfing";

export type StrategyConfig =
  | { type: "ema_cross";     fastPeriod: number; slowPeriod: number }
  | { type: "sma_cross";     fastPeriod: number; slowPeriod: number }
  | { type: "triple_ema";    fast: number; mid: number; slow: number }
  | { type: "price_ema";     period: number }
  | { type: "parabolic_sar"; step: number; max: number }
  | { type: "adx_di";        period: number; minAdx: number }
  | { type: "rsi";           period: number; oversold: number; overbought: number }
  | { type: "stoch_cross";   kPeriod: number; dPeriod: number; slowing: number; oversold: number; overbought: number }
  | { type: "macd";          fast: number; slow: number; signal: number }
  | { type: "cci";           period: number; threshold: number }
  | { type: "williams_r";    period: number; oversold: number; overbought: number }
  | { type: "momentum";      period: number }
  | { type: "bb_bounce";     period: number; deviation: number }
  | { type: "bb_breakout";   period: number; deviation: number }
  | { type: "donchian";      period: number }
  | { type: "engulfing" };

export type StrategyCategory = "Trend" | "Oscillator" | "Volatility" | "Price Action";

export const STRATEGY_META: Record<StrategyType, { label: string; desc: string; category: StrategyCategory }> = {
  ema_cross:     { label: "EMA Cross",         desc: "Fast EMA ตัดขึ้น/ลง Slow EMA",                    category: "Trend" },
  sma_cross:     { label: "SMA Cross",         desc: "Fast SMA ตัดขึ้น/ลง Slow SMA",                    category: "Trend" },
  triple_ema:    { label: "Triple EMA",        desc: "Fast>Mid>Slow EMA เรียงตัวทิศทางเดียวกัน",         category: "Trend" },
  price_ema:     { label: "Price vs EMA",      desc: "ราคาทะลุขึ้น/ลงผ่าน EMA",                         category: "Trend" },
  parabolic_sar: { label: "Parabolic SAR",     desc: "SAR พลิกจากด้านบน→ล่าง (Buy) หรือ ล่าง→บน (Sell)",category: "Trend" },
  adx_di:        { label: "ADX + DI Cross",    desc: "+DI ตัด -DI เมื่อ ADX > MinADX (trend filter)",   category: "Trend" },
  rsi:           { label: "RSI OB/OS",         desc: "RSI ออกจาก Oversold / Overbought zone",            category: "Oscillator" },
  stoch_cross:   { label: "Stochastic Cross",  desc: "%K ตัด %D ใน OB/OS zone",                         category: "Oscillator" },
  macd:          { label: "MACD Cross",        desc: "MACD Line ตัด Signal Line",                        category: "Oscillator" },
  cci:           { label: "CCI",               desc: "CCI ออกจาก zone ±Threshold (เช่น ±100)",           category: "Oscillator" },
  williams_r:    { label: "Williams %R",       desc: "%R ออกจาก OB/OS zone (-80/-20)",                   category: "Oscillator" },
  momentum:      { label: "Momentum",          desc: "Momentum ตัดเส้น 100 ขึ้น (Buy) / ลง (Sell)",      category: "Oscillator" },
  bb_bounce:     { label: "BB Bounce",         desc: "ราคาแตะ Bollinger Lower/Upper แล้วเด้งกลับ",       category: "Volatility" },
  bb_breakout:   { label: "BB Breakout",       desc: "ราคาปิดทะลุ Upper/Lower Band (momentum breakout)", category: "Volatility" },
  donchian:      { label: "Donchian Breakout", desc: "ราคาทะลุ Highest High / Lowest Low ของ N bars",    category: "Volatility" },
  engulfing:     { label: "Engulfing",         desc: "Bullish/Bearish Engulfing candle (Price Action)",  category: "Price Action" },
};

export const STRATEGY_CATEGORIES: StrategyCategory[] = ["Trend", "Oscillator", "Volatility", "Price Action"];

export const STRATEGY_DEFAULTS: Record<StrategyType, StrategyConfig> = {
  ema_cross:     { type: "ema_cross",     fastPeriod: 9,  slowPeriod: 21 },
  sma_cross:     { type: "sma_cross",     fastPeriod: 20, slowPeriod: 50 },
  triple_ema:    { type: "triple_ema",    fast: 8, mid: 21, slow: 55 },
  price_ema:     { type: "price_ema",     period: 50 },
  parabolic_sar: { type: "parabolic_sar", step: 0.02, max: 0.2 },
  adx_di:        { type: "adx_di",        period: 14, minAdx: 25 },
  rsi:           { type: "rsi",           period: 14, oversold: 30, overbought: 70 },
  stoch_cross:   { type: "stoch_cross",   kPeriod: 5, dPeriod: 3, slowing: 3, oversold: 20, overbought: 80 },
  macd:          { type: "macd",          fast: 12, slow: 26, signal: 9 },
  cci:           { type: "cci",           period: 20, threshold: 100 },
  williams_r:    { type: "williams_r",    period: 14, oversold: -80, overbought: -20 },
  momentum:      { type: "momentum",      period: 14 },
  bb_bounce:     { type: "bb_bounce",     period: 20, deviation: 2 },
  bb_breakout:   { type: "bb_breakout",   period: 20, deviation: 2 },
  donchian:      { type: "donchian",      period: 20 },
  engulfing:     { type: "engulfing" },
};

// ── TP / SL ───────────────────────────────────────────────────────────────────

export interface TpConfig {
  type: TpType;
  points: number;
  atrMult: number;
  atrPeriod: number;
}

export interface SlConfig {
  type: SlType;
  points: number;
  atrMult: number;
  atrPeriod: number;
  swingLookback: number;
  swingBuffer: number;
}

// ── Lot management ────────────────────────────────────────────────────────────

export interface LotConfig {
  mode: LotMode;
  baseLot: number;
  riskPct: number;
  multiplier: number;
  maxOrders: number;
  gridStep: number;
  gridMaxOrders: number;
  gridTakeProfit: number;
}

export const LOT_MODE_META: Record<LotMode, { label: string; desc: string; color: string }> = {
  fixed:           { label: "Fixed Lot",         desc: "Lot size คงที่ทุก order",                              color: "text-gold" },
  risk_pct:        { label: "Risk %",            desc: "คำนวณ lot จาก % ของ balance ÷ SL distance",           color: "text-emerald-400" },
  martingale:      { label: "Martingale",        desc: "เพิ่ม lot × N หลังแพ้, reset หลังชนะ",                color: "text-red-400" },
  anti_martingale: { label: "Lot Plus (Anti-M)", desc: "เพิ่ม lot × N หลังชนะ, reset หลังแพ้",               color: "text-royal" },
  grid:            { label: "Grid Trading",      desc: "เปิด order ทุก X points, ปิดรวมเมื่อ avg+TP ถึงเป้า", color: "text-cyan-400" },
};

// ── Entry conditions ──────────────────────────────────────────────────────────

export interface EntryCondition {
  enabled: boolean;
  logic: LogicOp;
  strategy: StrategyConfig;
}

// ── Main config ───────────────────────────────────────────────────────────────

export interface EAConfig {
  name: string;
  language: Language;
  timeframe: string;
  magic: number;
  direction: Direction;
  conditions: [EntryCondition, EntryCondition, EntryCondition];
  tpConfig: TpConfig;
  slConfig: SlConfig;
  lotConfig: LotConfig;
  useTrailing: boolean;
  trailStart: number;
  trailStep: number;
}

export const TF_OPTIONS = [
  { value: "PERIOD_M1",  label: "M1"  },
  { value: "PERIOD_M5",  label: "M5"  },
  { value: "PERIOD_M15", label: "M15" },
  { value: "PERIOD_M30", label: "M30" },
  { value: "PERIOD_H1",  label: "H1"  },
  { value: "PERIOD_H4",  label: "H4"  },
  { value: "PERIOD_D1",  label: "D1"  },
];

export function defaultConfig(): EAConfig {
  return {
    name: "Gold EA",
    language: "mql4",
    timeframe: "PERIOD_H1",
    magic: 111001,
    direction: "both",
    conditions: [
      { enabled: true,  logic: "AND", strategy: { type: "ema_cross", fastPeriod: 9, slowPeriod: 21 } },
      { enabled: false, logic: "AND", strategy: { type: "rsi",       period: 14, oversold: 30, overbought: 70 } },
      { enabled: false, logic: "AND", strategy: { type: "macd",      fast: 12, slow: 26, signal: 9 } },
    ],
    tpConfig: { type: "fixed",   points: 500, atrMult: 2.0, atrPeriod: 14 },
    slConfig: { type: "fixed",   points: 300, atrMult: 1.5, atrPeriod: 14, swingLookback: 10, swingBuffer: 50 },
    lotConfig: { mode: "fixed", baseLot: 0.01, riskPct: 1.0, multiplier: 2.0, maxOrders: 5, gridStep: 300, gridMaxOrders: 5, gridTakeProfit: 600 },
    useTrailing: false, trailStart: 200, trailStep: 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════════

function headerComment(cfg: EAConfig, ext: string): string {
  const active = cfg.conditions.filter((c) => c.enabled);
  const labels = active.map((c) => STRATEGY_META[c.strategy.type].label).join(" + ");
  return `//+------------------------------------------------------------------+
//|  ${cfg.name}.${ext}
//|  Generated by Gold Intelligence OS · EA Profit Lab
//|  Strategy  : ${labels}
//|  Symbol    : XAUUSD  |  Timeframe : ${cfg.timeframe}
//|  Lot Mode  : ${LOT_MODE_META[cfg.lotConfig.mode].label}
//+------------------------------------------------------------------+`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MQL4 — Condition helpers
// ═══════════════════════════════════════════════════════════════════════════════

function mql4CndInputs(s: StrategyConfig, n: number): string {
  const x = `_${n}`;
  switch (s.type) {
    case "ema_cross":     return `input int    FastEMA${x}   = ${s.fastPeriod};  // Cond.${n} Fast EMA\ninput int    SlowEMA${x}   = ${s.slowPeriod};  // Cond.${n} Slow EMA`;
    case "sma_cross":     return `input int    FastSMA${x}   = ${s.fastPeriod};  // Cond.${n} Fast SMA\ninput int    SlowSMA${x}   = ${s.slowPeriod};  // Cond.${n} Slow SMA`;
    case "triple_ema":    return `input int    TE_Fast${x}   = ${s.fast};   // Cond.${n} Fast EMA\ninput int    TE_Mid${x}    = ${s.mid};   // Cond.${n} Mid EMA\ninput int    TE_Slow${x}   = ${s.slow};  // Cond.${n} Slow EMA`;
    case "price_ema":     return `input int    PrEMA${x}     = ${s.period};  // Cond.${n} EMA Period`;
    case "parabolic_sar": return `input double SAR_Step${x}  = ${s.step};  // Cond.${n} SAR Step\ninput double SAR_Max${x}   = ${s.max};   // Cond.${n} SAR Max`;
    case "adx_di":        return `input int    ADX_Per${x}   = ${s.period};  // Cond.${n} ADX Period\ninput int    ADX_Min${x}   = ${s.minAdx};  // Cond.${n} Min ADX strength`;
    case "rsi":           return `input int    RSI_Per${x}   = ${s.period};  // Cond.${n} RSI Period\ninput int    RSI_OS${x}    = ${s.oversold};  // Cond.${n} Oversold\ninput int    RSI_OB${x}    = ${s.overbought};  // Cond.${n} Overbought`;
    case "stoch_cross":   return `input int    SK_Per${x}    = ${s.kPeriod};   // Cond.${n} %K\ninput int    SD_Per${x}    = ${s.dPeriod};   // Cond.${n} %D\ninput int    SS_Per${x}    = ${s.slowing};   // Cond.${n} Slowing\ninput int    S_OS${x}      = ${s.oversold};  // Cond.${n} Oversold\ninput int    S_OB${x}      = ${s.overbought};  // Cond.${n} Overbought`;
    case "macd":          return `input int    MACD_F${x}    = ${s.fast};  // Cond.${n} Fast\ninput int    MACD_S${x}    = ${s.slow};  // Cond.${n} Slow\ninput int    MACD_Sg${x}   = ${s.signal};   // Cond.${n} Signal`;
    case "cci":           return `input int    CCI_Per${x}   = ${s.period};  // Cond.${n} Period\ninput int    CCI_Thr${x}   = ${s.threshold};  // Cond.${n} Threshold ±`;
    case "williams_r":    return `input int    WPR_Per${x}   = ${s.period};  // Cond.${n} Period\ninput int    WPR_OS${x}    = ${s.oversold};  // Cond.${n} OS level\ninput int    WPR_OB${x}    = ${s.overbought};   // Cond.${n} OB level`;
    case "momentum":      return `input int    MOM_Per${x}   = ${s.period};  // Cond.${n} Period`;
    case "bb_bounce":
    case "bb_breakout":   return `input int    BB_Per${x}    = ${s.period};  // Cond.${n} BB Period\ninput double BB_Dev${x}    = ${s.deviation};   // Cond.${n} Deviation`;
    case "donchian":      return `input int    DC_Per${x}    = ${s.period};  // Cond.${n} Donchian Period`;
    case "engulfing":     return `// Cond.${n}: Engulfing Pattern — no parameters`;
    default:              return "";
  }
}

function mql4CndSignal(s: StrategyConfig, n: number): { code: string; buy: string; sell: string } {
  const x = `_${n}`;
  switch (s.type) {
    case "ema_cross":
      return { code: `   double ef0${x}=iMA(NULL,0,FastEMA${x},0,MODE_EMA,PRICE_CLOSE,1),ef1${x}=iMA(NULL,0,FastEMA${x},0,MODE_EMA,PRICE_CLOSE,2);\n   double es0${x}=iMA(NULL,0,SlowEMA${x},0,MODE_EMA,PRICE_CLOSE,1),es1${x}=iMA(NULL,0,SlowEMA${x},0,MODE_EMA,PRICE_CLOSE,2);`,
        buy: `(ef1${x}<es1${x}&&ef0${x}>es0${x})`, sell: `(ef1${x}>es1${x}&&ef0${x}<es0${x})` };
    case "sma_cross":
      return { code: `   double sf0${x}=iMA(NULL,0,FastSMA${x},0,MODE_SMA,PRICE_CLOSE,1),sf1${x}=iMA(NULL,0,FastSMA${x},0,MODE_SMA,PRICE_CLOSE,2);\n   double ss0${x}=iMA(NULL,0,SlowSMA${x},0,MODE_SMA,PRICE_CLOSE,1),ss1${x}=iMA(NULL,0,SlowSMA${x},0,MODE_SMA,PRICE_CLOSE,2);`,
        buy: `(sf1${x}<ss1${x}&&sf0${x}>ss0${x})`, sell: `(sf1${x}>ss1${x}&&sf0${x}<ss0${x})` };
    case "triple_ema":
      return { code: `   double tf${x}=iMA(NULL,0,TE_Fast${x},0,MODE_EMA,PRICE_CLOSE,1);\n   double tm0${x}=iMA(NULL,0,TE_Mid${x},0,MODE_EMA,PRICE_CLOSE,1),tm1${x}=iMA(NULL,0,TE_Mid${x},0,MODE_EMA,PRICE_CLOSE,2);\n   double ts0${x}=iMA(NULL,0,TE_Slow${x},0,MODE_EMA,PRICE_CLOSE,1),ts1${x}=iMA(NULL,0,TE_Slow${x},0,MODE_EMA,PRICE_CLOSE,2);`,
        buy: `(tf${x}>tm0${x}&&tm1${x}<=ts1${x}&&tm0${x}>ts0${x})`, sell: `(tf${x}<tm0${x}&&tm1${x}>=ts1${x}&&tm0${x}<ts0${x})` };
    case "price_ema":
      return { code: `   double pe${x}=iMA(NULL,0,PrEMA${x},0,MODE_EMA,PRICE_CLOSE,1);`,
        buy: `(Close[2]<pe${x}&&Close[1]>pe${x})`, sell: `(Close[2]>pe${x}&&Close[1]<pe${x})` };
    case "parabolic_sar":
      return { code: `   double sar1${x}=iSAR(NULL,0,SAR_Step${x},SAR_Max${x},1),sar2${x}=iSAR(NULL,0,SAR_Step${x},SAR_Max${x},2);`,
        buy: `(sar2${x}>Close[2]&&sar1${x}<Close[1])`, sell: `(sar2${x}<Close[2]&&sar1${x}>Close[1])` };
    case "adx_di":
      return { code: `   double adx${x}=iADX(NULL,0,ADX_Per${x},PRICE_CLOSE,MODE_MAIN,1);\n   double pd0${x}=iADX(NULL,0,ADX_Per${x},PRICE_CLOSE,MODE_PLUSDI,1),pd1${x}=iADX(NULL,0,ADX_Per${x},PRICE_CLOSE,MODE_PLUSDI,2);\n   double md0${x}=iADX(NULL,0,ADX_Per${x},PRICE_CLOSE,MODE_MINUSDI,1),md1${x}=iADX(NULL,0,ADX_Per${x},PRICE_CLOSE,MODE_MINUSDI,2);`,
        buy: `(adx${x}>ADX_Min${x}&&pd1${x}<md1${x}&&pd0${x}>md0${x})`, sell: `(adx${x}>ADX_Min${x}&&pd1${x}>md1${x}&&pd0${x}<md0${x})` };
    case "rsi":
      return { code: `   double rsi0${x}=iRSI(NULL,0,RSI_Per${x},PRICE_CLOSE,1),rsi1${x}=iRSI(NULL,0,RSI_Per${x},PRICE_CLOSE,2);`,
        buy: `(rsi1${x}<RSI_OS${x}&&rsi0${x}>RSI_OS${x})`, sell: `(rsi1${x}>RSI_OB${x}&&rsi0${x}<RSI_OB${x})` };
    case "stoch_cross":
      return { code: `   double sk0${x}=iStochastic(NULL,0,SK_Per${x},SD_Per${x},SS_Per${x},MODE_SMA,0,MODE_MAIN,1),sk1${x}=iStochastic(NULL,0,SK_Per${x},SD_Per${x},SS_Per${x},MODE_SMA,0,MODE_MAIN,2);\n   double sd0${x}=iStochastic(NULL,0,SK_Per${x},SD_Per${x},SS_Per${x},MODE_SMA,0,MODE_SIGNAL,1),sd1${x}=iStochastic(NULL,0,SK_Per${x},SD_Per${x},SS_Per${x},MODE_SMA,0,MODE_SIGNAL,2);`,
        buy: `(sk1${x}<sd1${x}&&sk0${x}>sd0${x}&&sk0${x}<S_OS${x}+10)`, sell: `(sk1${x}>sd1${x}&&sk0${x}<sd0${x}&&sk0${x}>S_OB${x}-10)` };
    case "macd":
      return { code: `   double ml0${x}=iMACD(NULL,0,MACD_F${x},MACD_S${x},MACD_Sg${x},PRICE_CLOSE,MODE_MAIN,1),ml1${x}=iMACD(NULL,0,MACD_F${x},MACD_S${x},MACD_Sg${x},PRICE_CLOSE,MODE_MAIN,2);\n   double ms0${x}=iMACD(NULL,0,MACD_F${x},MACD_S${x},MACD_Sg${x},PRICE_CLOSE,MODE_SIGNAL,1),ms1${x}=iMACD(NULL,0,MACD_F${x},MACD_S${x},MACD_Sg${x},PRICE_CLOSE,MODE_SIGNAL,2);`,
        buy: `(ml1${x}<ms1${x}&&ml0${x}>ms0${x})`, sell: `(ml1${x}>ms1${x}&&ml0${x}<ms0${x})` };
    case "cci":
      return { code: `   double cci0${x}=iCCI(NULL,0,CCI_Per${x},PRICE_TYPICAL,1),cci1${x}=iCCI(NULL,0,CCI_Per${x},PRICE_TYPICAL,2);`,
        buy: `(cci1${x}<(-CCI_Thr${x})&&cci0${x}>(-CCI_Thr${x}))`, sell: `(cci1${x}>CCI_Thr${x}&&cci0${x}<CCI_Thr${x})` };
    case "williams_r":
      return { code: `   double wpr0${x}=iWPR(NULL,0,WPR_Per${x},1),wpr1${x}=iWPR(NULL,0,WPR_Per${x},2);`,
        buy: `(wpr1${x}<WPR_OS${x}&&wpr0${x}>WPR_OS${x})`, sell: `(wpr1${x}>WPR_OB${x}&&wpr0${x}<WPR_OB${x})` };
    case "momentum":
      return { code: `   double mom0${x}=iMomentum(NULL,0,MOM_Per${x},PRICE_CLOSE,1),mom1${x}=iMomentum(NULL,0,MOM_Per${x},PRICE_CLOSE,2);`,
        buy: `(mom1${x}<100&&mom0${x}>=100)`, sell: `(mom1${x}>100&&mom0${x}<=100)` };
    case "bb_bounce":
      return { code: `   double bbu${x}=iBands(NULL,0,BB_Per${x},BB_Dev${x},0,PRICE_CLOSE,MODE_UPPER,1),bbl${x}=iBands(NULL,0,BB_Per${x},BB_Dev${x},0,PRICE_CLOSE,MODE_LOWER,1);`,
        buy: `(Close[1]<=bbl${x})`, sell: `(Close[1]>=bbu${x})` };
    case "bb_breakout":
      return { code: `   double bbu2${x}=iBands(NULL,0,BB_Per${x},BB_Dev${x},0,PRICE_CLOSE,MODE_UPPER,2),bbu1${x}=iBands(NULL,0,BB_Per${x},BB_Dev${x},0,PRICE_CLOSE,MODE_UPPER,1);\n   double bbl2${x}=iBands(NULL,0,BB_Per${x},BB_Dev${x},0,PRICE_CLOSE,MODE_LOWER,2),bbl1${x}=iBands(NULL,0,BB_Per${x},BB_Dev${x},0,PRICE_CLOSE,MODE_LOWER,1);`,
        buy: `(Close[2]<=bbu2${x}&&Close[1]>bbu1${x})`, sell: `(Close[2]>=bbl2${x}&&Close[1]<bbl1${x})` };
    case "donchian":
      return { code: `   int dch${x}=iHighest(NULL,0,MODE_HIGH,DC_Per${x},2),dcl${x}=iLowest(NULL,0,MODE_LOW,DC_Per${x},2);\n   double dchi${x}=High[dch${x}],dclo${x}=Low[dcl${x}];`,
        buy: `(Close[1]>dchi${x})`, sell: `(Close[1]<dclo${x})` };
    case "engulfing":
      return { code: ``,
        buy: `(Close[2]<Open[2]&&Close[1]>Open[1]&&Open[1]<=Close[2]&&Close[1]>=Open[2])`,
        sell: `(Close[2]>Open[2]&&Close[1]<Open[1]&&Open[1]>=Close[2]&&Close[1]<=Open[2])` };
    default: return { code: "", buy: "false", sell: "false" };
  }
}

// ── MQL4 TP/SL helpers ────────────────────────────────────────────────────────

function mql4TpSlInputs(cfg: EAConfig): string {
  const { tpConfig: tp, slConfig: sl } = cfg;
  const out: string[] = [];
  if (tp.type === "fixed")    out.push(`input int    TP_Points   = ${tp.points};  // Take Profit (points)`);
  if (tp.type === "atr_mult") out.push(`input double TP_ATR_Mult = ${tp.atrMult};  // TP = X × ATR\ninput int    TP_ATR_Per  = ${tp.atrPeriod};`);
  if (sl.type === "fixed")    out.push(`input int    SL_Points   = ${sl.points};  // Stop Loss (points)`);
  if (sl.type === "atr_mult") out.push(`input double SL_ATR_Mult = ${sl.atrMult};  // SL = X × ATR\ninput int    SL_ATR_Per  = ${sl.atrPeriod};`);
  if (sl.type === "swing_hl") out.push(`input int    SwingLook   = ${sl.swingLookback};  // Swing lookback (bars)\ninput int    SwingBuf    = ${sl.swingBuffer};  // Buffer beyond swing (pts)`);
  return out.join("\n");
}

function mql4TpSlCalc(cfg: EAConfig, side: "buy" | "sell"): { tp: string; sl: string; extra: string } {
  const { tpConfig: tp, slConfig: sl } = cfg;
  const p = side === "buy" ? "Ask" : "Bid";
  const d = side === "buy" ? "+" : "-";
  const i = side === "buy" ? "-" : "+";
  let tpExpr = "0", slExpr = "0", extra = "";
  if (tp.type === "fixed")    tpExpr = `${p}${d}TP_Points*Point`;
  if (tp.type === "atr_mult") { extra += `   double atp=iATR(NULL,0,TP_ATR_Per,PRICE_CLOSE,1);\n`; tpExpr = `${p}${d}TP_ATR_Mult*atp`; }
  if (tp.type === "no_tp")    tpExpr = "0";
  if (sl.type === "fixed")    slExpr = `${p}${i}SL_Points*Point`;
  if (sl.type === "atr_mult") { extra += `   double asp=iATR(NULL,0,SL_ATR_Per,PRICE_CLOSE,1);\n`; slExpr = `${p}${i}SL_ATR_Mult*asp`; }
  if (sl.type === "swing_hl") {
    if (side === "buy")  { extra += `   int swb=iLowest(NULL,0,MODE_LOW,SwingLook,1);\n   double swV=Low[swb]-SwingBuf*Point;\n`;  slExpr = "swV"; }
    else                 { extra += `   int swb=iHighest(NULL,0,MODE_HIGH,SwingLook,1);\n   double swV=High[swb]+SwingBuf*Point;\n`; slExpr = "swV"; }
  }
  return { tp: tpExpr, sl: slExpr, extra };
}

// ── MQL4 Lot management ───────────────────────────────────────────────────────

function mql4LotInputs(cfg: EAConfig): string {
  const lc = cfg.lotConfig;
  const out = [`input double BaseLot     = ${lc.baseLot};  // Base lot size`];
  if (lc.mode === "risk_pct")        out.push(`input double RiskPct     = ${lc.riskPct};   // Risk % per trade`);
  if (lc.mode === "martingale")      out.push(`input double Multiplier  = ${lc.multiplier};   // Lot multiplier after loss\ninput int    MaxSeq      = ${lc.maxOrders};   // Max consecutive steps`);
  if (lc.mode === "anti_martingale") out.push(`input double Multiplier  = ${lc.multiplier};   // Lot multiplier after win\ninput int    MaxSeq      = ${lc.maxOrders};   // Max consecutive steps`);
  if (lc.mode === "grid")            out.push(`input int    GridStep    = ${lc.gridStep};  // Points between grid levels\ninput int    GridMaxOrd  = ${lc.gridMaxOrders};   // Max grid orders\ninput int    GridTP      = ${lc.gridTakeProfit};  // TP from avg entry (points)`);
  return out.join("\n");
}

function mql4CalcLotFn(lc: LotConfig): string {
  if (lc.mode === "fixed")
    return `double CalcLot() { return NormalizeDouble(BaseLot,2); }`;
  if (lc.mode === "risk_pct")
    return `double CalcLot() {\n   double sl=SL_Points*Point*MarketInfo(Symbol(),MODE_TICKVALUE)/Point;\n   if(sl<=0) return BaseLot;\n   return NormalizeDouble(MathMax(AccountBalance()*RiskPct/100.0/sl,MarketInfo(Symbol(),MODE_MINLOT)),2);\n}`;
  if (lc.mode === "martingale")
    return `double CalcLot() {\n   int n=0;\n   for(int i=OrdersHistoryTotal()-1;i>=0;i--) {\n      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY)) continue;\n      if(OrderMagicNumber()!=Magic||OrderSymbol()!=Symbol()) continue;\n      if(OrderProfit()+OrderSwap()+OrderCommission()<0) n++; else break;\n   }\n   return NormalizeDouble(BaseLot*MathPow(Multiplier,MathMin(n,MaxSeq-1)),2);\n}`;
  if (lc.mode === "anti_martingale")
    return `double CalcLot() {\n   int n=0;\n   for(int i=OrdersHistoryTotal()-1;i>=0;i--) {\n      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY)) continue;\n      if(OrderMagicNumber()!=Magic||OrderSymbol()!=Symbol()) continue;\n      if(OrderProfit()+OrderSwap()+OrderCommission()>0) n++; else break;\n   }\n   return NormalizeDouble(BaseLot*MathPow(Multiplier,MathMin(n,MaxSeq-1)),2);\n}`;
  return `double CalcLot() { return NormalizeDouble(BaseLot,2); }`;
}

// ── MQL4 Grid body ────────────────────────────────────────────────────────────

function mql4GridBody(cfg: EAConfig, sigCode: string, buyExpr: string, sellExpr: string): string {
  const bOpen  = cfg.direction !== "sell_only" ? "      if(buySignal)  OpenGridBuy(cntB);" : "";
  const sOpen  = cfg.direction !== "buy_only"  ? "      if(sellSignal) OpenGridSell(cntS);" : "";
  return `void OnTick() {
   static datetime last=0; if(Time[0]==last) return; last=Time[0];
${sigCode}
   bool buySignal=${buyExpr};
   bool sellSignal=${sellExpr};
   int cntB=CountByType(OP_BUY),cntS=CountByType(OP_SELL);
   // Initial entry
   if(cntB==0&&cntS==0) {
${bOpen}
${sOpen}
   }
   // Grid extension BUY
   if(cntB>0&&cntB<GridMaxOrd) {
      double lo=GetExtreme(OP_BUY,true);
      if(lo<DBL_MAX&&Ask<=lo-GridStep*Point) OpenGridBuy(cntB);
   }
   // Grid extension SELL
   if(cntS>0&&cntS<GridMaxOrd) {
      double hi=GetExtreme(OP_SELL,false);
      if(hi>0&&Bid>=hi+GridStep*Point) OpenGridSell(cntS);
   }
   CheckGridTP(OP_BUY); CheckGridTP(OP_SELL);
}

void CheckGridTP(int type) {
   int cnt=0; double avg=0;
   for(int i=OrdersTotal()-1;i>=0;i--) {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue;
      if(OrderMagicNumber()!=Magic||OrderSymbol()!=Symbol()||OrderType()!=type) continue;
      avg+=OrderOpenPrice(); cnt++;
   }
   if(cnt==0) return; avg/=cnt;
   bool hit=(type==OP_BUY)?(Bid>=avg+GridTP*Point):(Ask<=avg-GridTP*Point);
   if(hit) CloseAllByType(type);
}

void OpenGridBuy(int lv)  { OrderSend(Symbol(),OP_BUY, BaseLot,Ask,3,0,0,EA_Name+"_G"+lv,Magic,0,clrDodgerBlue); }
void OpenGridSell(int lv) { OrderSend(Symbol(),OP_SELL,BaseLot,Bid,3,0,0,EA_Name+"_G"+lv,Magic,0,clrOrangeRed); }

void CloseAllByType(int type) {
   for(int i=OrdersTotal()-1;i>=0;i--) {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue;
      if(OrderMagicNumber()!=Magic||OrderSymbol()!=Symbol()||OrderType()!=type) continue;
      OrderClose(OrderTicket(),OrderLots(),(type==OP_BUY)?Bid:Ask,3,clrGray);
   }
}
int CountByType(int type) {
   int c=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES))
         if(OrderMagicNumber()==Magic&&OrderSymbol()==Symbol()&&OrderType()==type) c++;
   return c;
}
double GetExtreme(int type,bool lowest) {
   double v=lowest?DBL_MAX:0;
   for(int i=OrdersTotal()-1;i>=0;i--) {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue;
      if(OrderMagicNumber()!=Magic||OrderSymbol()!=Symbol()||OrderType()!=type) continue;
      if(lowest&&OrderOpenPrice()<v) v=OrderOpenPrice();
      if(!lowest&&OrderOpenPrice()>v) v=OrderOpenPrice();
   }
   return v;
}`;
}

// ── MQL4 Standard body ────────────────────────────────────────────────────────

function mql4StandardBody(cfg: EAConfig, sigCode: string, buyExpr: string, sellExpr: string): string {
  const bc = mql4TpSlCalc(cfg, "buy");
  const sc = mql4TpSlCalc(cfg, "sell");
  const bOpen  = cfg.direction !== "sell_only" ? "      if(buySignal)  OpenBuy();" : "";
  const sOpen  = cfg.direction !== "buy_only"  ? "      if(sellSignal) OpenSell();" : "";
  const tCall  = cfg.useTrailing ? "\n   if(UseTrailing) ManageTrailing();" : "";
  const tFn = cfg.useTrailing ? `
void ManageTrailing() {
   for(int i=OrdersTotal()-1;i>=0;i--) {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue;
      if(OrderMagicNumber()!=Magic||OrderSymbol()!=Symbol()) continue;
      if(OrderType()==OP_BUY) {
         double nsl=Bid-TrailStep*Point;
         if(Bid-OrderOpenPrice()>=TrailStart*Point&&nsl>OrderStopLoss()+Point)
            OrderModify(OrderTicket(),OrderOpenPrice(),NormalizeDouble(nsl,Digits),OrderTakeProfit(),0,clrGreen);
      }
      if(OrderType()==OP_SELL) {
         double nsl=Ask+TrailStep*Point;
         if(OrderOpenPrice()-Ask>=TrailStart*Point&&(OrderStopLoss()==0||nsl<OrderStopLoss()-Point))
            OrderModify(OrderTicket(),OrderOpenPrice(),NormalizeDouble(nsl,Digits),OrderTakeProfit(),0,clrRed);
      }
   }
}` : "";
  return `void OnTick() {
   static datetime last=0; if(Time[0]==last) return; last=Time[0];
${sigCode}
   bool buySignal=${buyExpr};
   bool sellSignal=${sellExpr};
   if(CountOrders()==0) {
${bOpen}
${sOpen}
   }${tCall}
}

void OpenBuy() {
${bc.extra}   double lot=CalcLot();
   double sl=NormalizeDouble(${bc.sl},Digits),tp=NormalizeDouble(${bc.tp},Digits);
   int t=OrderSend(Symbol(),OP_BUY,lot,Ask,3,sl,tp,EA_Name,Magic,0,clrDodgerBlue);
   if(t<0) Print("Buy err:",GetLastError());
}
void OpenSell() {
${sc.extra}   double lot=CalcLot();
   double sl=NormalizeDouble(${sc.sl},Digits),tp=NormalizeDouble(${sc.tp},Digits);
   int t=OrderSend(Symbol(),OP_SELL,lot,Bid,3,sl,tp,EA_Name,Magic,0,clrOrangeRed);
   if(t<0) Print("Sell err:",GetLastError());
}
int CountOrders() {
   int c=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES))
         if(OrderMagicNumber()==Magic&&OrderSymbol()==Symbol()) c++;
   return c;
}
${tFn}`;
}

// ── MQL4 full generator ───────────────────────────────────────────────────────

function generateMQL4(cfg: EAConfig): string {
  const active = cfg.conditions.map((c, i) => ({ ...c, n: i + 1 })).filter((c) => c.enabled);
  if (!active.length) return "// No conditions enabled — enable at least one condition.";

  const isGrid = cfg.lotConfig.mode === "grid";
  const condInputs = active.map((c) => mql4CndInputs(c.strategy, c.n)).join("\n");
  const tpslStr = isGrid ? "" : mql4TpSlInputs(cfg);
  const lotStr  = mql4LotInputs(cfg);
  const trailStr = !isGrid && cfg.useTrailing
    ? `input bool   UseTrailing = true;\ninput int    TrailStart  = ${cfg.trailStart};\ninput int    TrailStep   = ${cfg.trailStep};` : "";

  const sigs = active.map((c) => ({ ...mql4CndSignal(c.strategy, c.n), logic: c.logic }));
  const sigCode = sigs.map((s) => s.code).filter(Boolean).join("\n");
  let buyExpr  = sigs[0].buy;
  let sellExpr = sigs[0].sell;
  for (let i = 1; i < sigs.length; i++) {
    const op = sigs[i].logic === "AND" ? "&&" : "||";
    buyExpr  = `(${buyExpr}${op}${sigs[i].buy})`;
    sellExpr = `(${sellExpr}${op}${sigs[i].sell})`;
  }

  const lotFn = isGrid ? "" : mql4CalcLotFn(cfg.lotConfig);
  const body  = isGrid
    ? mql4GridBody(cfg, sigCode, buyExpr, sellExpr)
    : mql4StandardBody(cfg, sigCode, buyExpr, sellExpr);

  return `${headerComment(cfg, "mq4")}
#property copyright "EA Profit Lab"
#property version   "1.00"
#property strict

input string EA_Name     = "${cfg.name}";
input int    Magic       = ${cfg.magic};
//--- Entry Conditions
${condInputs}
//--- Lot Management: ${LOT_MODE_META[cfg.lotConfig.mode].label}
${lotStr}
${tpslStr ? `//--- TP / SL\n${tpslStr}` : ""}
${trailStr}

int OnInit()  { Print("=== ",EA_Name," started ==="); return INIT_SUCCEEDED; }
void OnDeinit(const int reason) { Print("=== ",EA_Name," stopped ==="); }

${lotFn}
${body}
//+------------------------------------------------------------------+`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MQL5 Code Generation
// ═══════════════════════════════════════════════════════════════════════════════

function mql5CndHandle(s: StrategyConfig, n: number): { decl: string; init: string; release: string } {
  const x = `_${n}`;
  switch (s.type) {
    case "ema_cross":
      return { decl:`int hEF${x},hES${x};`, init:`   hEF${x}=iMA(_Symbol,0,FastEMA${x},0,MODE_EMA,PRICE_CLOSE); hES${x}=iMA(_Symbol,0,SlowEMA${x},0,MODE_EMA,PRICE_CLOSE);\n   if(hEF${x}==INVALID_HANDLE||hES${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hEF${x}); IndicatorRelease(hES${x});` };
    case "sma_cross":
      return { decl:`int hSF${x},hSS${x};`, init:`   hSF${x}=iMA(_Symbol,0,FastSMA${x},0,MODE_SMA,PRICE_CLOSE); hSS${x}=iMA(_Symbol,0,SlowSMA${x},0,MODE_SMA,PRICE_CLOSE);\n   if(hSF${x}==INVALID_HANDLE||hSS${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hSF${x}); IndicatorRelease(hSS${x});` };
    case "triple_ema":
      return { decl:`int hTF${x},hTM${x},hTS${x};`, init:`   hTF${x}=iMA(_Symbol,0,TE_Fast${x},0,MODE_EMA,PRICE_CLOSE); hTM${x}=iMA(_Symbol,0,TE_Mid${x},0,MODE_EMA,PRICE_CLOSE); hTS${x}=iMA(_Symbol,0,TE_Slow${x},0,MODE_EMA,PRICE_CLOSE);\n   if(hTF${x}==INVALID_HANDLE||hTM${x}==INVALID_HANDLE||hTS${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hTF${x}); IndicatorRelease(hTM${x}); IndicatorRelease(hTS${x});` };
    case "price_ema":
      return { decl:`int hPE${x};`, init:`   hPE${x}=iMA(_Symbol,0,PrEMA${x},0,MODE_EMA,PRICE_CLOSE); if(hPE${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hPE${x});` };
    case "parabolic_sar":
      return { decl:`int hSAR${x};`, init:`   hSAR${x}=iSAR(_Symbol,0,SAR_Step${x},SAR_Max${x}); if(hSAR${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hSAR${x});` };
    case "adx_di":
      return { decl:`int hADX${x};`, init:`   hADX${x}=iADX(_Symbol,0,ADX_Per${x}); if(hADX${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hADX${x});` };
    case "rsi":
      return { decl:`int hRSI${x};`, init:`   hRSI${x}=iRSI(_Symbol,0,RSI_Per${x},PRICE_CLOSE); if(hRSI${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hRSI${x});` };
    case "stoch_cross":
      return { decl:`int hST${x};`, init:`   hST${x}=iStochastic(_Symbol,0,SK_Per${x},SD_Per${x},SS_Per${x},MODE_SMA,STO_LOWHIGH); if(hST${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hST${x});` };
    case "macd":
      return { decl:`int hMACD${x};`, init:`   hMACD${x}=iMACD(_Symbol,0,MACD_F${x},MACD_S${x},MACD_Sg${x},PRICE_CLOSE); if(hMACD${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hMACD${x});` };
    case "cci":
      return { decl:`int hCCI${x};`, init:`   hCCI${x}=iCCI(_Symbol,0,CCI_Per${x},PRICE_TYPICAL); if(hCCI${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hCCI${x});` };
    case "williams_r":
      return { decl:`int hWPR${x};`, init:`   hWPR${x}=iWPR(_Symbol,0,WPR_Per${x}); if(hWPR${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hWPR${x});` };
    case "momentum":
      return { decl:`int hMOM${x};`, init:`   hMOM${x}=iMomentum(_Symbol,0,MOM_Per${x},PRICE_CLOSE); if(hMOM${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hMOM${x});` };
    case "bb_bounce": case "bb_breakout":
      return { decl:`int hBB${x};`, init:`   hBB${x}=iBands(_Symbol,0,BB_Per${x},0,BB_Dev${x},PRICE_CLOSE); if(hBB${x}==INVALID_HANDLE) return INIT_FAILED;`, release:`   IndicatorRelease(hBB${x});` };
    default: return { decl:"", init:"", release:"" };
  }
}

function mql5CndSignal(s: StrategyConfig, n: number): { code: string; buy: string; sell: string } {
  const x = `_${n}`;
  switch (s.type) {
    case "ema_cross":
      return { code:`   double ef${x}[2],es${x}[2]; ArraySetAsSeries(ef${x},true); ArraySetAsSeries(es${x},true); CopyBuffer(hEF${x},0,1,2,ef${x}); CopyBuffer(hES${x},0,1,2,es${x});`,
        buy:`(ef${x}[1]<es${x}[1]&&ef${x}[0]>es${x}[0])`, sell:`(ef${x}[1]>es${x}[1]&&ef${x}[0]<es${x}[0])` };
    case "sma_cross":
      return { code:`   double sf${x}[2],ss${x}[2]; ArraySetAsSeries(sf${x},true); ArraySetAsSeries(ss${x},true); CopyBuffer(hSF${x},0,1,2,sf${x}); CopyBuffer(hSS${x},0,1,2,ss${x});`,
        buy:`(sf${x}[1]<ss${x}[1]&&sf${x}[0]>ss${x}[0])`, sell:`(sf${x}[1]>ss${x}[1]&&sf${x}[0]<ss${x}[0])` };
    case "triple_ema":
      return { code:`   double tf${x}[1],tm${x}[2],ts${x}[2]; ArraySetAsSeries(tf${x},true); ArraySetAsSeries(tm${x},true); ArraySetAsSeries(ts${x},true);\n   CopyBuffer(hTF${x},0,1,1,tf${x}); CopyBuffer(hTM${x},0,1,2,tm${x}); CopyBuffer(hTS${x},0,1,2,ts${x});`,
        buy:`(tf${x}[0]>tm${x}[0]&&tm${x}[1]<=ts${x}[1]&&tm${x}[0]>ts${x}[0])`, sell:`(tf${x}[0]<tm${x}[0]&&tm${x}[1]>=ts${x}[1]&&tm${x}[0]<ts${x}[0])` };
    case "price_ema":
      return { code:`   double pe${x}[1],pc${x}[2]; ArraySetAsSeries(pe${x},true); ArraySetAsSeries(pc${x},true); CopyBuffer(hPE${x},0,1,1,pe${x}); CopyClose(_Symbol,0,1,2,pc${x});`,
        buy:`(pc${x}[1]<pe${x}[0]&&pc${x}[0]>pe${x}[0])`, sell:`(pc${x}[1]>pe${x}[0]&&pc${x}[0]<pe${x}[0])` };
    case "parabolic_sar":
      return { code:`   double sar${x}[2],cls${x}[2]; ArraySetAsSeries(sar${x},true); ArraySetAsSeries(cls${x},true); CopyBuffer(hSAR${x},0,1,2,sar${x}); CopyClose(_Symbol,0,1,2,cls${x});`,
        buy:`(sar${x}[1]>cls${x}[1]&&sar${x}[0]<cls${x}[0])`, sell:`(sar${x}[1]<cls${x}[1]&&sar${x}[0]>cls${x}[0])` };
    case "adx_di":
      return { code:`   double adx${x}[1],pd${x}[2],md${x}[2]; ArraySetAsSeries(adx${x},true); ArraySetAsSeries(pd${x},true); ArraySetAsSeries(md${x},true);\n   CopyBuffer(hADX${x},0,1,1,adx${x}); CopyBuffer(hADX${x},1,1,2,pd${x}); CopyBuffer(hADX${x},2,1,2,md${x});`,
        buy:`(adx${x}[0]>ADX_Min${x}&&pd${x}[1]<md${x}[1]&&pd${x}[0]>md${x}[0])`, sell:`(adx${x}[0]>ADX_Min${x}&&pd${x}[1]>md${x}[1]&&pd${x}[0]<md${x}[0])` };
    case "rsi":
      return { code:`   double r${x}[2]; ArraySetAsSeries(r${x},true); CopyBuffer(hRSI${x},0,1,2,r${x});`,
        buy:`(r${x}[1]<RSI_OS${x}&&r${x}[0]>RSI_OS${x})`, sell:`(r${x}[1]>RSI_OB${x}&&r${x}[0]<RSI_OB${x})` };
    case "stoch_cross":
      return { code:`   double sk${x}[2],sd${x}[2]; ArraySetAsSeries(sk${x},true); ArraySetAsSeries(sd${x},true); CopyBuffer(hST${x},0,1,2,sk${x}); CopyBuffer(hST${x},1,1,2,sd${x});`,
        buy:`(sk${x}[1]<sd${x}[1]&&sk${x}[0]>sd${x}[0]&&sk${x}[0]<S_OS${x}+10)`, sell:`(sk${x}[1]>sd${x}[1]&&sk${x}[0]<sd${x}[0]&&sk${x}[0]>S_OB${x}-10)` };
    case "macd":
      return { code:`   double ml${x}[2],ms${x}[2]; ArraySetAsSeries(ml${x},true); ArraySetAsSeries(ms${x},true); CopyBuffer(hMACD${x},0,1,2,ml${x}); CopyBuffer(hMACD${x},1,1,2,ms${x});`,
        buy:`(ml${x}[1]<ms${x}[1]&&ml${x}[0]>ms${x}[0])`, sell:`(ml${x}[1]>ms${x}[1]&&ml${x}[0]<ms${x}[0])` };
    case "cci":
      return { code:`   double cci${x}[2]; ArraySetAsSeries(cci${x},true); CopyBuffer(hCCI${x},0,1,2,cci${x});`,
        buy:`(cci${x}[1]<(-CCI_Thr${x})&&cci${x}[0]>(-CCI_Thr${x}))`, sell:`(cci${x}[1]>CCI_Thr${x}&&cci${x}[0]<CCI_Thr${x})` };
    case "williams_r":
      return { code:`   double wpr${x}[2]; ArraySetAsSeries(wpr${x},true); CopyBuffer(hWPR${x},0,1,2,wpr${x});`,
        buy:`(wpr${x}[1]<WPR_OS${x}&&wpr${x}[0]>WPR_OS${x})`, sell:`(wpr${x}[1]>WPR_OB${x}&&wpr${x}[0]<WPR_OB${x})` };
    case "momentum":
      return { code:`   double mom${x}[2]; ArraySetAsSeries(mom${x},true); CopyBuffer(hMOM${x},0,1,2,mom${x});`,
        buy:`(mom${x}[1]<100&&mom${x}[0]>=100)`, sell:`(mom${x}[1]>100&&mom${x}[0]<=100)` };
    case "bb_bounce":
      return { code:`   double bbu${x}[1],bbl${x}[1],bbc${x}[1]; CopyBuffer(hBB${x},1,1,1,bbu${x}); CopyBuffer(hBB${x},2,1,1,bbl${x}); CopyClose(_Symbol,0,1,1,bbc${x});`,
        buy:`(bbc${x}[0]<=bbl${x}[0])`, sell:`(bbc${x}[0]>=bbu${x}[0])` };
    case "bb_breakout":
      return { code:`   double bbu2${x}[1],bbu1${x}[1],bbl2${x}[1],bbl1${x}[1],cls2${x}[1],cls1${x}[1];\n   CopyBuffer(hBB${x},1,2,1,bbu2${x}); CopyBuffer(hBB${x},1,1,1,bbu1${x}); CopyBuffer(hBB${x},2,2,1,bbl2${x}); CopyBuffer(hBB${x},2,1,1,bbl1${x});\n   CopyClose(_Symbol,0,2,1,cls2${x}); CopyClose(_Symbol,0,1,1,cls1${x});`,
        buy:`(cls2${x}[0]<=bbu2${x}[0]&&cls1${x}[0]>bbu1${x}[0])`, sell:`(cls2${x}[0]>=bbl2${x}[0]&&cls1${x}[0]<bbl1${x}[0])` };
    case "donchian":
      return { code:`   double dhi${x}[],dlo${x}[],dls${x}[1];\n   ArrayResize(dhi${x},DC_Per${x}); ArrayResize(dlo${x},DC_Per${x});\n   CopyHigh(_Symbol,0,2,DC_Per${x},dhi${x}); CopyLow(_Symbol,0,2,DC_Per${x},dlo${x}); CopyClose(_Symbol,0,1,1,dls${x});\n   double dch${x}=dhi${x}[ArrayMaximum(dhi${x})],dcl${x}=dlo${x}[ArrayMinimum(dlo${x})];`,
        buy:`(dls${x}[0]>dch${x})`, sell:`(dls${x}[0]<dcl${x})` };
    case "engulfing":
      return { code:`   double op${x}[2],cl${x}[2]; ArraySetAsSeries(op${x},true); ArraySetAsSeries(cl${x},true); CopyOpen(_Symbol,0,1,2,op${x}); CopyClose(_Symbol,0,1,2,cl${x});`,
        buy:`(cl${x}[1]<op${x}[1]&&cl${x}[0]>op${x}[0]&&op${x}[0]<=cl${x}[1]&&cl${x}[0]>=op${x}[1])`,
        sell:`(cl${x}[1]>op${x}[1]&&cl${x}[0]<op${x}[0]&&op${x}[0]>=cl${x}[1]&&cl${x}[0]<=op${x}[1])` };
    default: return { code:"", buy:"false", sell:"false" };
  }
}

function mql5CalcLotFn(lc: LotConfig): string {
  if (lc.mode === "fixed")
    return `double CalcLot() { return NormalizeDouble(BaseLot,2); }`;
  if (lc.mode === "risk_pct")
    return `double CalcLot() {\n   double bal=AccountInfoDouble(ACCOUNT_BALANCE);\n   double tv=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE);\n   double ts=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);\n   double slV=(ts>0)?(SL_Points*_Point/ts*tv):1;\n   if(slV<=0) return BaseLot;\n   return NormalizeDouble(MathMax(bal*RiskPct/100.0/slV,SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN)),2);\n}`;
  if (lc.mode === "martingale")
    return `double CalcLot() {\n   int n=0; HistorySelect(TimeCurrent()-30*86400,TimeCurrent());\n   for(int i=(int)HistoryDealsTotal()-1;i>=0;i--) {\n      ulong tk=HistoryDealGetTicket(i);\n      if(HistoryDealGetString(tk,DEAL_SYMBOL)!=_Symbol||HistoryDealGetInteger(tk,DEAL_MAGIC)!=Magic) continue;\n      if(HistoryDealGetDouble(tk,DEAL_PROFIT)<0) n++; else break;\n   }\n   return NormalizeDouble(BaseLot*MathPow(Multiplier,MathMin(n,MaxSeq-1)),2);\n}`;
  if (lc.mode === "anti_martingale")
    return `double CalcLot() {\n   int n=0; HistorySelect(TimeCurrent()-30*86400,TimeCurrent());\n   for(int i=(int)HistoryDealsTotal()-1;i>=0;i--) {\n      ulong tk=HistoryDealGetTicket(i);\n      if(HistoryDealGetString(tk,DEAL_SYMBOL)!=_Symbol||HistoryDealGetInteger(tk,DEAL_MAGIC)!=Magic) continue;\n      if(HistoryDealGetDouble(tk,DEAL_PROFIT)>0) n++; else break;\n   }\n   return NormalizeDouble(BaseLot*MathPow(Multiplier,MathMin(n,MaxSeq-1)),2);\n}`;
  return `double CalcLot() { return NormalizeDouble(BaseLot,2); }`;
}

function generateMQL5(cfg: EAConfig): string {
  const active = cfg.conditions.map((c, i) => ({ ...c, n: i + 1 })).filter((c) => c.enabled);
  if (!active.length) return "// No conditions enabled.";

  const isGrid = cfg.lotConfig.mode === "grid";
  const handles = active.map((c) => mql5CndHandle(c.strategy, c.n));
  const sigs    = active.map((c) => ({ ...mql5CndSignal(c.strategy, c.n), logic: c.logic }));
  const sigCode = sigs.map((s) => s.code).filter(Boolean).join("\n");

  let buyExpr  = sigs[0].buy;
  let sellExpr = sigs[0].sell;
  for (let i = 1; i < sigs.length; i++) {
    const op = sigs[i].logic === "AND" ? "&&" : "||";
    buyExpr  = `(${buyExpr}${op}${sigs[i].buy})`;
    sellExpr = `(${sellExpr}${op}${sigs[i].sell})`;
  }

  const { tpConfig: tp, slConfig: sl, lotConfig: lc } = cfg;
  const condInputs = active.map((c) => mql4CndInputs(c.strategy, c.n)).join("\n");
  const tpslStr = isGrid ? "" : mql4TpSlInputs(cfg);
  const lotStr  = mql4LotInputs(cfg);
  const trailStr = !isGrid && cfg.useTrailing ? `input bool UseTrailing=true;\ninput int TrailStart=${cfg.trailStart};\ninput int TrailStep=${cfg.trailStep};` : "";

  const atrD = [tp.type==="atr_mult"?"int hAtrTP;":"",sl.type==="atr_mult"?"int hAtrSL;":""].filter(Boolean).join("\n");
  const atrI = [tp.type==="atr_mult"?`   hAtrTP=iATR(_Symbol,0,TP_ATR_Per); if(hAtrTP==INVALID_HANDLE) return INIT_FAILED;`:"",sl.type==="atr_mult"?`   hAtrSL=iATR(_Symbol,0,SL_ATR_Per); if(hAtrSL==INVALID_HANDLE) return INIT_FAILED;`:""].filter(Boolean).join("\n");
  const atrR = [tp.type==="atr_mult"?"   IndicatorRelease(hAtrTP);":"",sl.type==="atr_mult"?"   IndicatorRelease(hAtrSL);":""].filter(Boolean).join("\n");

  const openFn = (side: "buy" | "sell") => {
    const px = side==="buy"?"SymbolInfoDouble(_Symbol,SYMBOL_ASK)":"SymbolInfoDouble(_Symbol,SYMBOL_BID)";
    const d = side==="buy"?"+":"-"; const inv = side==="buy"?"-":"+";
    let tpE="0",slE="0",ex=`   double px=${px};\n`;
    if(tp.type==="fixed")    tpE=`px${d}TP_Points*_Point`;
    if(tp.type==="atr_mult"){ex+=`   double at[1]; CopyBuffer(hAtrTP,0,1,1,at);\n`; tpE=`px${d}TP_ATR_Mult*at[0]`;}
    if(tp.type==="no_tp")    tpE="0";
    if(sl.type==="fixed")    slE=`px${inv}SL_Points*_Point`;
    if(sl.type==="atr_mult"){ex+=`   double as[1]; CopyBuffer(hAtrSL,0,1,1,as);\n`; slE=`px${inv}SL_ATR_Mult*as[0]`;}
    if(sl.type==="swing_hl"){
      ex+=side==="buy"
        ?`   double lo[]; CopyLow(_Symbol,0,1,SwingLook,lo); double swV=lo[ArrayMinimum(lo)]-SwingBuf*_Point;\n`
        :`   double hi[]; CopyHigh(_Symbol,0,1,SwingLook,hi); double swV=hi[ArrayMaximum(hi)]+SwingBuf*_Point;\n`;
      slE="swV";
    }
    const fn=side==="buy"?"Buy":"Sell";
    return `void Open${fn}() {\n${ex}   double lot=CalcLot();\n   trade.${fn}(lot,_Symbol,px,NormalizeDouble(${slE},_Digits),NormalizeDouble(${tpE},_Digits),EA_Name);\n}`;
  };

  const bOpen  = cfg.direction!=="sell_only"?"      if(buySignal)  OpenBuy();":"";
  const sOpen  = cfg.direction!=="buy_only" ?"      if(sellSignal) OpenSell();":"";
  const tCall  = !isGrid&&cfg.useTrailing?"\n   if(UseTrailing) ManageTrailing();":"";

  const tFn = !isGrid&&cfg.useTrailing?`
void ManageTrailing() {
   for(int i=PositionsTotal()-1;i>=0;i--) {
      ulong tk=PositionGetTicket(i);
      if(tk<=0||PositionGetInteger(POSITION_MAGIC)!=Magic||PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      double op=PositionGetDouble(POSITION_PRICE_OPEN),csl=PositionGetDouble(POSITION_SL),ctp=PositionGetDouble(POSITION_TP);
      if(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY) {
         double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID),nsl=bid-TrailStep*_Point;
         if(bid-op>=TrailStart*_Point&&nsl>csl+_Point) trade.PositionModify(tk,NormalizeDouble(nsl,_Digits),ctp);
      } else {
         double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK),nsl=ask+TrailStep*_Point;
         if(op-ask>=TrailStart*_Point&&(csl==0||nsl<csl-_Point)) trade.PositionModify(tk,NormalizeDouble(nsl,_Digits),ctp);
      }
   }
}` :"";

  return `${headerComment(cfg, "mq5")}
#property copyright "EA Profit Lab"
#property version   "1.00"
#include <Trade\\Trade.mqh>
CTrade trade;

input string EA_Name = "${cfg.name}";
input int    Magic   = ${cfg.magic};
//--- Entry Conditions
${condInputs}
//--- Lot Management: ${LOT_MODE_META[lc.mode].label}
${lotStr}
${tpslStr?`//--- TP / SL\n${tpslStr}`:""}
${trailStr}

//--- Handles
${handles.map(h=>h.decl).filter(Boolean).join("\n")}
${atrD}

int OnInit() {
${handles.map(h=>h.init).filter(Boolean).join("\n")}
${atrI}
   trade.SetExpertMagicNumber(Magic);
   return INIT_SUCCEEDED;
}

void OnTick() {
   static datetime last=0;
   datetime cur=iTime(_Symbol,PERIOD_CURRENT,0);
   if(cur==last) return; last=cur;
${sigCode}
   bool buySignal=${buyExpr};
   bool sellSignal=${sellExpr};
   if(CountPos()==0) {
${bOpen}
${sOpen}
   }${tCall}
}

${isGrid?"":mql5CalcLotFn(lc)}
${isGrid?"":openFn("buy")}
${isGrid?"":openFn("sell")}

int CountPos() {
   int c=0;
   for(int i=PositionsTotal()-1;i>=0;i--) {
      ulong tk=PositionGetTicket(i);
      if(tk>0&&PositionGetInteger(POSITION_MAGIC)==Magic&&PositionGetString(POSITION_SYMBOL)==_Symbol) c++;
   }
   return c;
}
${tFn}

void OnDeinit(const int reason) {
${handles.map(h=>h.release).filter(Boolean).join("\n")}
${atrR}
}
//+------------------------------------------------------------------+`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateCode(cfg: EAConfig): string {
  return cfg.language === "mql4" ? generateMQL4(cfg) : generateMQL5(cfg);
}

export function getFileExtension(lang: Language): string {
  return lang === "mql4" ? "mq4" : "mq5";
}
