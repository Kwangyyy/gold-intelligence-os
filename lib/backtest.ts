// Backtesting engine — runs indicator-based strategies on OHLC history

export interface OHLC {
  time: number;   // unix seconds
  open: number; high: number; low: number; close: number;
}

export type BacktestStrategyType =
  | "ema_cross" | "sma_cross" | "triple_ema" | "price_ema"
  | "rsi" | "stoch" | "macd" | "cci" | "momentum"
  | "bb_bounce" | "bb_breakout" | "parabolic_sar";

export type BacktestDirection = "both" | "buy_only" | "sell_only";
export type BacktestLotMode   = "fixed" | "martingale" | "anti_martingale";
export type BacktestLogicOp   = "AND" | "OR";

// Shared strategy params — used by both BacktestConfig (cond 1) and BacktestExtraCond (cond 2-3)
export interface BacktestStrategyParams {
  strategy: BacktestStrategyType;
  fastPeriod: number; slowPeriod: number; midPeriod: number;
  rsiPeriod: number; rsiOS: number; rsiOB: number;
  macdFast: number; macdSlow: number; macdSignal: number;
  stochK: number; stochD: number; stochSlowing: number; stochOS: number; stochOB: number;
  cciPeriod: number; cciThreshold: number;
  momentumPeriod: number;
  bbPeriod: number; bbDev: number;
  sarStep: number; sarMax: number;
}

export interface BacktestExtraCond extends BacktestStrategyParams {
  enabled: boolean;
  logic: BacktestLogicOp;
}

export interface BacktestConfig extends BacktestStrategyParams {
  // Trade settings
  direction: BacktestDirection;
  baseLot: number;
  slPoints: number;    // in price dollars (e.g., 3.00 = $3 = 300 pips)
  tpPoints: number;
  lotMode: BacktestLotMode;
  lotMultiplier: number;
  maxLotSteps: number;
  initialBalance: number;
  // Trading costs (optional — default to realistic XAUUSD values). Applied per
  // round-trip so backtests aren't optimistic. spread/slippage are in price $,
  // commission is $ per lot round-trip.
  spreadPoints?: number;
  commissionPerLot?: number;
  slippagePoints?: number;
  // Extra conditions (optional — disabled by default)
  cond2: BacktestExtraCond;
  cond3: BacktestExtraCond;
}

// XAUUSD: 1 lot = 100 oz, so a $1 price move = $100 P/L per lot. A $0.30 spread
// costs $30 per lot round-trip.
export const DEFAULT_SPREAD = 0.3;
export const DEFAULT_COMMISSION_PER_LOT = 0; // most retail XAUUSD is spread-only
export const DEFAULT_SLIPPAGE = 0.1;

// Round-trip cost in USD for a trade of `lot` lots.
export function tradeCost(cfg: BacktestConfig, lot: number): number {
  const spread = cfg.spreadPoints ?? DEFAULT_SPREAD;
  const slip = cfg.slippagePoints ?? DEFAULT_SLIPPAGE;
  const comm = cfg.commissionPerLot ?? DEFAULT_COMMISSION_PER_LOT;
  return (spread + slip) * lot * 100 + comm * lot;
}

export interface BacktestTrade {
  idx: number;
  time: number;
  direction: "buy" | "sell";
  entry: number;
  exit: number;
  sl: number;
  tp: number;
  lot: number;
  pnl: number;         // USD
  exitReason: "tp" | "sl" | "end";
  exitTime: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  equity: number[];           // equity[i] = balance after trade i
  balanceCurve: { time: number; balance: number }[];
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;         // percentage
  sharpeRatio: number;
  totalTrades: number;
  wins: number;
  losses: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  maxConsecLosses: number;
}

export function defaultCondParams(strategy: BacktestStrategyType = "rsi"): BacktestStrategyParams {
  return {
    strategy,
    fastPeriod: 9, slowPeriod: 21, midPeriod: 50,
    rsiPeriod: 14, rsiOS: 30, rsiOB: 70,
    macdFast: 12, macdSlow: 26, macdSignal: 9,
    stochK: 5, stochD: 3, stochSlowing: 3, stochOS: 20, stochOB: 80,
    cciPeriod: 20, cciThreshold: 100,
    momentumPeriod: 14,
    bbPeriod: 20, bbDev: 2,
    sarStep: 0.02, sarMax: 0.2,
  };
}

export function defaultExtraCond(strategy: BacktestStrategyType = "rsi"): BacktestExtraCond {
  return { enabled: false, logic: "AND", ...defaultCondParams(strategy) };
}

export function defaultBacktestConfig(): BacktestConfig {
  return {
    ...defaultCondParams("ema_cross"),
    direction: "both",
    baseLot: 0.1,
    slPoints: 5.0,
    tpPoints: 10.0,
    lotMode: "fixed",
    lotMultiplier: 2.0,
    maxLotSteps: 4,
    initialBalance: 10000,
    spreadPoints: DEFAULT_SPREAD,
    commissionPerLot: DEFAULT_COMMISSION_PER_LOT,
    slippagePoints: DEFAULT_SLIPPAGE,
    cond2: defaultExtraCond("rsi"),
    cond3: defaultExtraCond("macd"),
  };
}

// ── Indicator functions ───────────────────────────────────────────────────────

export function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return values.map(() => NaN);
  const k = 2 / (period + 1);
  const result: number[] = new Array(period - 1).fill(NaN);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

export function calcSMA(values: number[], period: number): number[] {
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    return values.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
  });
}

export function calcRSI(values: number[], period: number): number[] {
  if (values.length <= period) return values.map(() => NaN);
  const result: number[] = new Array(period).fill(NaN);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

export function calcMACD(values: number[], fast: number, slow: number, signal: number) {
  const emaFast = calcEMA(values, fast);
  const emaSlow = calcEMA(values, slow);
  const macdLine = emaFast.map((f, i) => (isNaN(f) || isNaN(emaSlow[i])) ? NaN : f - emaSlow[i]);
  const validStart = macdLine.findIndex((v) => !isNaN(v));
  const signalLine: number[] = new Array(validStart + signal - 1).fill(NaN);
  if (validStart >= 0) {
    const macdValid = macdLine.slice(validStart);
    const sigCalc = calcEMA(macdValid, signal);
    sigCalc.forEach((v) => signalLine.push(v));
  }
  return { macd: macdLine, signal: signalLine };
}

export function calcBB(values: number[], period: number, devMult: number) {
  const mid = calcSMA(values, period);
  const upper = mid.map((m, i) => {
    if (isNaN(m)) return NaN;
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return m + devMult * std;
  });
  const lower = mid.map((m, i) => {
    if (isNaN(m)) return NaN;
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return m - devMult * std;
  });
  return { upper, mid, lower };
}

export function calcStoch(highs: number[], lows: number[], closes: number[], k: number, d: number) {
  const rawK = closes.map((c, i) => {
    if (i < k - 1) return NaN;
    const h = Math.max(...highs.slice(i - k + 1, i + 1));
    const l = Math.min(...lows.slice(i - k + 1, i + 1));
    return h === l ? 50 : ((c - l) / (h - l)) * 100;
  });
  const pctK = calcSMA(rawK.map(v => isNaN(v) ? 0 : v), 3).map((v, i) => isNaN(rawK[i]) ? NaN : v);
  const pctD = calcSMA(pctK.map(v => isNaN(v) ? 0 : v), d).map((v, i) => isNaN(pctK[i]) ? NaN : v);
  return { k: pctK, d: pctD };
}

export function calcCCI(highs: number[], lows: number[], closes: number[], period: number): number[] {
  return closes.map((_, i) => {
    if (i < period - 1) return NaN;
    const slice = closes.slice(i - period + 1, i + 1);
    const typical = closes.slice(i - period + 1, i + 1).map((c, j) => (c + highs[i - period + 1 + j] + lows[i - period + 1 + j]) / 3);
    const mean = typical.reduce((a, b) => a + b) / period;
    const meanDev = typical.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    const tp = (closes[i] + highs[i] + lows[i]) / 3;
    return meanDev === 0 ? 0 : (tp - mean) / (0.015 * meanDev);
  });
}

export function calcMomentum(values: number[], period: number): number[] {
  return values.map((v, i) => i < period ? NaN : (v / values[i - period]) * 100);
}

export function calcSAR(highs: number[], lows: number[], step: number, max: number): number[] {
  const n = highs.length;
  const sar: number[] = new Array(n).fill(NaN);
  if (n < 2) return sar;
  let bull = true;
  let sarVal = lows[0];
  let ep = highs[0];
  let af = step;
  sar[0] = sarVal;
  for (let i = 1; i < n; i++) {
    const prevSar = sarVal;
    sarVal = prevSar + af * (ep - prevSar);
    if (bull) {
      sarVal = Math.min(sarVal, lows[i - 1], i > 1 ? lows[i - 2] : lows[i - 1]);
      if (lows[i] < sarVal) { bull = false; sarVal = ep; ep = lows[i]; af = step; }
      else { if (highs[i] > ep) { ep = highs[i]; af = Math.min(af + step, max); } }
    } else {
      sarVal = Math.max(sarVal, highs[i - 1], i > 1 ? highs[i - 2] : highs[i - 1]);
      if (highs[i] > sarVal) { bull = true; sarVal = ep; ep = highs[i]; af = step; }
      else { if (lows[i] < ep) { ep = lows[i]; af = Math.min(af + step, max); } }
    }
    sar[i] = sarVal;
  }
  return sar;
}

// ── Signal generators ─────────────────────────────────────────────────────────

type Signal = "buy" | "sell" | null;

function combineSignals(base: Signal[], extra: Signal[], logic: BacktestLogicOp): Signal[] {
  return base.map((b, i) => {
    const e = extra[i];
    if (logic === "AND") {
      if (b === null || e === null || b !== e) return null;
      return b;
    }
    // OR: either fires (cond1 takes priority)
    return b !== null ? b : e;
  });
}

function computeSignals(ohlc: OHLC[], p: BacktestStrategyParams): Signal[] {
  const closes = ohlc.map((b) => b.close);
  const highs  = ohlc.map((b) => b.high);
  const lows   = ohlc.map((b) => b.low);
  const n = ohlc.length;

  switch (p.strategy) {
    case "ema_cross": {
      const f = calcEMA(closes, p.fastPeriod);
      const s = calcEMA(closes, p.slowPeriod);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(f[i]) || isNaN(s[i]) || isNaN(f[i-1]) || isNaN(s[i-1])) return null;
        if (f[i-1] < s[i-1] && f[i] > s[i]) return "buy";
        if (f[i-1] > s[i-1] && f[i] < s[i]) return "sell";
        return null;
      });
    }
    case "sma_cross": {
      const f = calcSMA(closes, p.fastPeriod);
      const s = calcSMA(closes, p.slowPeriod);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(f[i]) || isNaN(s[i])) return null;
        if (f[i-1] < s[i-1] && f[i] > s[i]) return "buy";
        if (f[i-1] > s[i-1] && f[i] < s[i]) return "sell";
        return null;
      });
    }
    case "triple_ema": {
      const f = calcEMA(closes, p.fastPeriod);
      const m = calcEMA(closes, p.midPeriod);
      const s = calcEMA(closes, p.slowPeriod);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(f[i]) || isNaN(m[i]) || isNaN(s[i])) return null;
        if (f[i] > m[i] && m[i-1] <= s[i-1] && m[i] > s[i]) return "buy";
        if (f[i] < m[i] && m[i-1] >= s[i-1] && m[i] < s[i]) return "sell";
        return null;
      });
    }
    case "price_ema": {
      const e = calcEMA(closes, p.fastPeriod);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(e[i])) return null;
        if (closes[i-1] < e[i] && closes[i] > e[i]) return "buy";
        if (closes[i-1] > e[i] && closes[i] < e[i]) return "sell";
        return null;
      });
    }
    case "rsi": {
      const r = calcRSI(closes, p.rsiPeriod);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(r[i]) || isNaN(r[i-1])) return null;
        if (r[i-1] < p.rsiOS && r[i] >= p.rsiOS) return "buy";
        if (r[i-1] > p.rsiOB && r[i] <= p.rsiOB) return "sell";
        return null;
      });
    }
    case "macd": {
      const { macd, signal: sig } = calcMACD(closes, p.macdFast, p.macdSlow, p.macdSignal);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(macd[i]) || isNaN(sig[i])) return null;
        if (macd[i-1] < sig[i-1] && macd[i] > sig[i]) return "buy";
        if (macd[i-1] > sig[i-1] && macd[i] < sig[i]) return "sell";
        return null;
      });
    }
    case "stoch": {
      const { k, d } = calcStoch(highs, lows, closes, p.stochK, p.stochD);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(k[i]) || isNaN(d[i])) return null;
        if (k[i-1] < d[i-1] && k[i] > d[i] && k[i] < p.stochOS + 10) return "buy";
        if (k[i-1] > d[i-1] && k[i] < d[i] && k[i] > p.stochOB - 10) return "sell";
        return null;
      });
    }
    case "cci": {
      const c = calcCCI(highs, lows, closes, p.cciPeriod);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(c[i])) return null;
        if (c[i-1] < -p.cciThreshold && c[i] >= -p.cciThreshold) return "buy";
        if (c[i-1] > p.cciThreshold  && c[i] <= p.cciThreshold)  return "sell";
        return null;
      });
    }
    case "momentum": {
      const m = calcMomentum(closes, p.momentumPeriod);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(m[i])) return null;
        if (m[i-1] < 100 && m[i] >= 100) return "buy";
        if (m[i-1] > 100 && m[i] <= 100) return "sell";
        return null;
      });
    }
    case "bb_bounce": {
      const { upper, lower } = calcBB(closes, p.bbPeriod, p.bbDev);
      return ohlc.map((_, i) => {
        if (isNaN(upper[i])) return null;
        if (closes[i] <= lower[i]) return "buy";
        if (closes[i] >= upper[i]) return "sell";
        return null;
      });
    }
    case "bb_breakout": {
      const { upper, lower } = calcBB(closes, p.bbPeriod, p.bbDev);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(upper[i])) return null;
        if (closes[i-1] <= upper[i-1] && closes[i] > upper[i]) return "buy";
        if (closes[i-1] >= lower[i-1] && closes[i] < lower[i]) return "sell";
        return null;
      });
    }
    case "parabolic_sar": {
      const sar = calcSAR(highs, lows, p.sarStep, p.sarMax);
      return ohlc.map((_, i) => {
        if (i < 1 || isNaN(sar[i])) return null;
        if (sar[i-1] > closes[i-1] && sar[i] < closes[i]) return "buy";
        if (sar[i-1] < closes[i-1] && sar[i] > closes[i]) return "sell";
        return null;
      });
    }
    default: return new Array(n).fill(null);
  }
}

function signals(ohlc: OHLC[], cfg: BacktestConfig): Signal[] {
  let sigs = computeSignals(ohlc, cfg);
  if (cfg.cond2.enabled) sigs = combineSignals(sigs, computeSignals(ohlc, cfg.cond2), cfg.cond2.logic);
  if (cfg.cond3.enabled) sigs = combineSignals(sigs, computeSignals(ohlc, cfg.cond3), cfg.cond3.logic);
  return sigs;
}

// ── Backtest runner ───────────────────────────────────────────────────────────

export function runBacktest(ohlc: OHLC[], cfg: BacktestConfig): BacktestResult {
  if (ohlc.length < 30) return emptyResult(cfg.initialBalance);

  const sigs = signals(ohlc, cfg);
  const trades: BacktestTrade[] = [];
  let balance = cfg.initialBalance;
  let peakBalance = balance;
  let maxDD = 0;
  const balanceCurve: { time: number; balance: number }[] = [{ time: ohlc[0].time, balance }];
  let consecLosses = 0;
  let maxConsecLosses = 0;
  let curConsecLosses = 0;

  // Lot sizing helpers
  let lotHistogram: boolean[] = []; // true=win, false=loss
  function getLot(): number {
    const base = cfg.baseLot;
    if (cfg.lotMode === "fixed") return base;
    const recentResults = [...lotHistogram].reverse();
    let streak = 0;
    for (const r of recentResults) {
      if (cfg.lotMode === "martingale"      && !r) streak++;
      else if (cfg.lotMode === "anti_martingale" && r)  streak++;
      else break;
    }
    return Math.min(base * Math.pow(cfg.lotMultiplier, Math.min(streak, cfg.maxLotSteps - 1)), base * Math.pow(cfg.lotMultiplier, cfg.maxLotSteps - 1));
  }

  let openTrade: BacktestTrade | null = null;

  for (let i = 1; i < ohlc.length; i++) {
    const bar = ohlc[i];

    // Check if open trade hits SL/TP (use high/low of current bar)
    if (openTrade) {
      let closed = false;
      let pnl = 0;
      let reason: "tp" | "sl" = "sl";

      if (openTrade.direction === "buy") {
        if (bar.low <= openTrade.sl) {
          pnl = (openTrade.sl - openTrade.entry) * openTrade.lot * 100;
          reason = "sl";
          closed = true;
        } else if (bar.high >= openTrade.tp) {
          pnl = (openTrade.tp - openTrade.entry) * openTrade.lot * 100;
          reason = "tp";
          closed = true;
        }
      } else {
        if (bar.high >= openTrade.sl) {
          pnl = (openTrade.entry - openTrade.sl) * openTrade.lot * 100;
          reason = "sl";
          closed = true;
        } else if (bar.low <= openTrade.tp) {
          pnl = (openTrade.entry - openTrade.tp) * openTrade.lot * 100;
          reason = "tp";
          closed = true;
        }
      }

      if (closed) {
        const exitPrice = reason === "tp" ? openTrade.tp : openTrade.sl;
        pnl -= tradeCost(cfg, openTrade.lot); // spread + commission + slippage
        openTrade.exit = exitPrice;
        openTrade.pnl = pnl;
        openTrade.exitReason = reason;
        openTrade.exitTime = bar.time;
        trades.push(openTrade);
        balance += pnl;
        balanceCurve.push({ time: bar.time, balance });
        peakBalance = Math.max(peakBalance, balance);
        const dd = (peakBalance - balance) / peakBalance * 100;
        maxDD = Math.max(maxDD, dd);
        const won = pnl > 0;
        lotHistogram.push(won);
        if (!won) { curConsecLosses++; maxConsecLosses = Math.max(maxConsecLosses, curConsecLosses); }
        else curConsecLosses = 0;
        openTrade = null;
      }
    }

    // Open new trade on signal (only one at a time)
    if (!openTrade) {
      const sig = sigs[i];
      const canBuy  = sig === "buy"  && cfg.direction !== "sell_only";
      const canSell = sig === "sell" && cfg.direction !== "buy_only";

      if (canBuy || canSell) {
        const dir = canBuy ? "buy" : "sell";
        const entry = bar.close;
        const lot = getLot();
        const sl = dir === "buy" ? entry - cfg.slPoints : entry + cfg.slPoints;
        const tp = dir === "buy" ? entry + cfg.tpPoints : entry - cfg.tpPoints;
        openTrade = { idx: i, time: bar.time, direction: dir, entry, exit: 0, sl, tp, lot, pnl: 0, exitReason: "end", exitTime: 0 };
      }
    }
  }

  // Close any remaining open trade at last close
  if (openTrade) {
    const last = ohlc[ohlc.length - 1];
    const gross = openTrade.direction === "buy"
      ? (last.close - openTrade.entry) * openTrade.lot * 100
      : (openTrade.entry - last.close) * openTrade.lot * 100;
    const pnl = gross - tradeCost(cfg, openTrade.lot);
    openTrade.exit = last.close;
    openTrade.pnl = pnl;
    openTrade.exitReason = "end";
    openTrade.exitTime = last.time;
    trades.push(openTrade);
    balance += pnl;
    balanceCurve.push({ time: last.time, balance });
  }

  // Compute stats
  const wins   = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const avgWin  = wins.length   > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss  / losses.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  // Sharpe (annualized approximation from daily returns)
  const returns = balanceCurve.slice(1).map((p, i) =>
    balanceCurve[i].balance > 0 ? (p.balance - balanceCurve[i].balance) / balanceCurve[i].balance : 0
  );
  const meanR = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const stdR  = Math.sqrt(returns.reduce((a, b) => a + (b - meanR) ** 2, 0) / (returns.length || 1));
  const sharpeRatio = stdR > 0 ? (meanR / stdR) * Math.sqrt(252) : 0;

  peakBalance = cfg.initialBalance;
  let maxDDFinal = 0;
  let runBalance = cfg.initialBalance;
  for (const t of trades) {
    runBalance += t.pnl;
    peakBalance = Math.max(peakBalance, runBalance);
    maxDDFinal = Math.max(maxDDFinal, (peakBalance - runBalance) / peakBalance * 100);
  }

  return {
    trades,
    equity: balanceCurve.map((b) => b.balance),
    balanceCurve,
    totalPnl,
    winRate,
    profitFactor,
    maxDrawdown: maxDDFinal,
    sharpeRatio,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    avgWin,
    avgLoss,
    expectancy,
    maxConsecLosses,
  };
}

function emptyResult(bal: number): BacktestResult {
  return { trades:[], equity:[bal], balanceCurve:[{time:0,balance:bal}],
    totalPnl:0, winRate:0, profitFactor:0, maxDrawdown:0, sharpeRatio:0,
    totalTrades:0, wins:0, losses:0, avgWin:0, avgLoss:0, expectancy:0, maxConsecLosses:0 };
}
