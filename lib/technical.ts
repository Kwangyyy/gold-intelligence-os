// Technical Intelligence engine (Module 3). Computes the full indicator suite on
// a single timeframe, derives sub-scores, reversal risk, breakout probability,
// an overall 0-100 technical score, and a signal. Server-side only.
//
// Sub-scores blend many indicators; reversal-risk and breakout-probability are
// transparent heuristics (documented inline), not guarantees.

import {
  adxFull,
  atr as calcAtr,
  bollinger,
  cci as calcCci,
  donchian,
  ema,
  fibRetracement,
  ichimoku,
  keltner,
  macd as calcMacd,
  momentum as calcMomentum,
  parabolicSar,
  pivotPoints,
  roc as calcRoc,
  rsi as calcRsi,
  sma,
  stochastic,
  superTrend,
  vwap,
  type Candle,
} from "./indicators";
import { fetchCandlesForTf } from "./timeframes";
import type {
  IndicatorCategory,
  IndicatorReading,
  IndSignal,
  TechnicalScore,
  TfSignal,
  TimeframeCode,
} from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const f = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// A vote in [-1, 1] toward bull(+)/bear(-), plus its display reading.
interface Voted {
  reading: IndicatorReading;
  vote: number;
}

function sig(vote: number): IndSignal {
  if (vote > 0.15) return "bull";
  if (vote < -0.15) return "bear";
  return "neutral";
}

function maReading(key: string, price: number, ma: number | null): Voted {
  const vote = ma == null ? 0 : price > ma ? 1 : -1;
  return { reading: { key, value: f(ma), signal: sig(vote) }, vote };
}

export async function buildTechnicalScore(tf: TimeframeCode): Promise<TechnicalScore> {
  const candles: Candle[] = await fetchCandlesForTf(tf);
  if (candles.length < 60) throw new Error(`Not enough candles for ${tf}`);

  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];

  // ---- TREND ----
  const trend: Voted[] = [];
  trend.push(maReading("ind_ema20", price, ema(closes, 20)));
  trend.push(maReading("ind_ema50", price, ema(closes, 50)));
  trend.push(maReading("ind_ema100", price, ema(closes, 100)));
  trend.push(maReading("ind_ema200", price, ema(closes, 200)));
  trend.push(maReading("ind_sma20", price, sma(closes, 20)));

  const macdRes = calcMacd(closes);
  {
    const vote = macdRes ? (macdRes.histogram > 0 ? 1 : -1) : 0;
    trend.push({
      reading: {
        key: "ind_macd",
        value: macdRes ? f(macdRes.macd) : "—",
        detail: macdRes ? `signal ${f(macdRes.signal)} · hist ${f(macdRes.histogram)}` : undefined,
        signal: sig(vote),
      },
      vote,
    });
  }

  const adxR = adxFull(candles, 14);
  {
    const directional = adxR ? (adxR.plusDI > adxR.minusDI ? 1 : -1) : 0;
    const strong = adxR ? adxR.adx >= 20 : false;
    const vote = strong ? directional : 0;
    trend.push({
      reading: {
        key: "ind_adx",
        value: adxR ? f(adxR.adx, 1) : "—",
        detail: adxR ? `+DI ${f(adxR.plusDI, 1)} · -DI ${f(adxR.minusDI, 1)}` : undefined,
        signal: sig(vote),
      },
      vote,
    });
  }

  const st = superTrend(candles, 10, 3);
  {
    const vote = st ? (st.rising ? 1 : -1) : 0;
    trend.push({ reading: { key: "ind_supertrend", value: f(st?.value ?? null), signal: sig(vote) }, vote });
  }

  const psar = parabolicSar(candles);
  {
    const vote = psar ? (psar.rising ? 1 : -1) : 0;
    trend.push({ reading: { key: "ind_psar", value: f(psar?.value ?? null), signal: sig(vote) }, vote });
  }

  const ichi = ichimoku(candles);
  {
    const vote = ichi ? (ichi.priceAboveCloud ? 1 : ichi.priceBelowCloud ? -1 : 0) : 0;
    trend.push({
      reading: {
        key: "ind_ichimoku",
        value: ichi ? (ichi.priceAboveCloud ? "Above cloud" : ichi.priceBelowCloud ? "Below cloud" : "In cloud") : "—",
        detail: ichi ? `tenkan ${f(ichi.tenkan)} · kijun ${f(ichi.kijun)}` : undefined,
        signal: sig(vote),
      },
      vote,
    });
  }

  // Rolling VWAP over a recent window (a 6-month cumulative VWAP is meaningless).
  const vw = vwap(candles.slice(-30));
  {
    const vote = vw == null ? 0 : price > vw ? 1 : -1;
    trend.push({ reading: { key: "ind_vwap", value: vw == null ? "—" : f(vw), signal: sig(vote) }, vote });
  }

  // ---- MOMENTUM ----
  const momentumArr: Voted[] = [];
  const rsiVal = calcRsi(closes, 14);
  {
    const vote = rsiVal == null ? 0 : clamp((rsiVal - 50) / 15, -1, 1);
    momentumArr.push({ reading: { key: "ind_rsi", value: f(rsiVal, 1), signal: sig(vote) }, vote });
  }
  const stoch = stochastic(candles);
  {
    const vote = stoch ? clamp((stoch.k - 50) / 40, -1, 1) * (stoch.k > stoch.d ? 1 : 0.6) : 0;
    momentumArr.push({
      reading: {
        key: "ind_stoch",
        value: stoch ? `${f(stoch.k, 1)} / ${f(stoch.d, 1)}` : "—",
        signal: sig(vote),
      },
      vote,
    });
  }
  const cciVal = calcCci(candles, 20);
  {
    const vote = cciVal == null ? 0 : clamp(cciVal / 100, -1, 1);
    momentumArr.push({ reading: { key: "ind_cci", value: f(cciVal, 0), signal: sig(vote) }, vote });
  }
  const momVal = calcMomentum(closes, 10);
  {
    const vote = momVal == null ? 0 : momVal > 0 ? 1 : -1;
    momentumArr.push({ reading: { key: "ind_momentum", value: f(momVal), signal: sig(vote) }, vote });
  }
  const rocVal = calcRoc(closes, 12);
  {
    const vote = rocVal == null ? 0 : clamp(rocVal / 2, -1, 1);
    momentumArr.push({ reading: { key: "ind_roc", value: rocVal == null ? "—" : `${f(rocVal)}%`, signal: sig(vote) }, vote });
  }

  // ---- VOLATILITY (level/structure, not direction) ----
  const bb = bollinger(closes, 20, 2);
  const atrVal = calcAtr(candles, 14);
  const kelt = keltner(candles, 20, 10, 2);
  const bbWidthPct = bb ? bb.width * 100 : 0;
  const atrPct = atrVal != null ? (atrVal / price) * 100 : 0;

  const volatility: IndicatorReading[] = [
    {
      key: "ind_bollinger",
      value: bb ? `${f(bbWidthPct, 2)}% width` : "—",
      detail: bb ? `upper ${f(bb.upper)} · lower ${f(bb.lower)}` : undefined,
      signal: bb ? (price > bb.upper ? "bull" : price < bb.lower ? "bear" : "neutral") : "neutral",
    },
    {
      key: "ind_atr",
      value: atrVal != null ? `${f(atrVal)} (${f(atrPct, 2)}%)` : "—",
      signal: "neutral",
    },
    {
      key: "ind_keltner",
      value: kelt ? `${f(kelt.upper)} / ${f(kelt.lower)}` : "—",
      signal: kelt ? (price > kelt.upper ? "bull" : price < kelt.lower ? "bear" : "neutral") : "neutral",
    },
  ];

  // ---- LEVELS ----
  const prev = candles[candles.length - 2];
  const piv = prev ? pivotPoints(prev.high, prev.low, prev.close) : null;
  const don = donchian(candles, 20);
  const fib = fibRetracement(candles, 100);

  const levels: IndicatorReading[] = [
    {
      key: "ind_pivot",
      value: piv ? f(piv.pivot) : "—",
      detail: piv ? `R1 ${f(piv.r1)} · S1 ${f(piv.s1)}` : undefined,
      signal: piv ? (price > piv.pivot ? "bull" : "bear") : "neutral",
    },
    {
      key: "ind_donchian",
      value: don ? `${f(don.upper)} / ${f(don.lower)}` : "—",
      signal: don
        ? price >= don.upper - (don.upper - don.lower) * 0.1
          ? "bull"
          : price <= don.lower + (don.upper - don.lower) * 0.1
            ? "bear"
            : "neutral"
        : "neutral",
    },
    {
      key: "ind_fib",
      value: fib ? `${f(fib.high)} → ${f(fib.low)}` : "—",
      detail: fib ? `0.618 ${f(fib.levels[4].price)} · 0.5 ${f(fib.levels[3].price)}` : undefined,
      signal: fib ? (price > fib.levels[3].price ? "bull" : "bear") : "neutral",
    },
  ];

  // ---- scores ----
  const avg = (arr: Voted[]) => (arr.length ? arr.reduce((s, v) => s + v.vote, 0) / arr.length : 0);
  const trendScore = Math.round(clamp(50 + avg(trend) * 50, 0, 100));
  const momentumScore = Math.round(clamp(50 + avg(momentumArr) * 50, 0, 100));
  const volatilityScore = Math.round(clamp((bbWidthPct / 4) * 100, 0, 100));
  const technicalScore = Math.round(0.55 * trendScore + 0.45 * momentumScore);

  // Reversal risk: overbought/oversold + band breaches + trend/momentum divergence.
  let reversal = 0;
  if (rsiVal != null && (rsiVal > 70 || rsiVal < 30)) reversal += 30;
  if (stoch && (stoch.k > 80 || stoch.k < 20)) reversal += 20;
  if (cciVal != null && Math.abs(cciVal) > 100) reversal += 15;
  if (bb && (price > bb.upper || price < bb.lower)) reversal += 20;
  if (Math.sign(trendScore - 50) !== 0 && Math.sign(trendScore - 50) !== Math.sign(momentumScore - 50)) reversal += 15;
  const reversalRisk = clamp(reversal, 0, 100);

  // Breakout probability: BB squeeze (narrow width / inside Keltner) + low ADX + Donchian proximity.
  let breakout = clamp(1 - bbWidthPct / 4, 0, 1) * 50;
  if (bb && kelt && bb.upper < kelt.upper && bb.lower > kelt.lower) breakout += 25; // squeeze
  if (adxR && adxR.adx < 20) breakout += 15;
  if (don) {
    const span = don.upper - don.lower;
    if (span > 0 && (price >= don.upper - span * 0.1 || price <= don.lower + span * 0.1)) breakout += 10;
  }
  const breakoutProbability = Math.round(clamp(breakout, 0, 100));

  let signal: TfSignal;
  if (technicalScore >= 70) signal = "strong_buy";
  else if (technicalScore >= 58) signal = "buy";
  else if (technicalScore <= 30) signal = "strong_sell";
  else if (technicalScore <= 42) signal = "sell";
  else signal = "wait";

  const indicators: Record<IndicatorCategory, IndicatorReading[]> = {
    trend: trend.map((v) => v.reading),
    momentum: momentumArr.map((v) => v.reading),
    volatility,
    levels,
  };

  return {
    symbol: "XAUUSD",
    source: "Yahoo Finance · COMEX GC=F",
    tf,
    price: +price.toFixed(2),
    technicalScore,
    trendScore,
    momentumScore,
    volatilityScore,
    reversalRisk,
    breakoutProbability,
    signal,
    indicators,
    timestamp: new Date().toISOString(),
  };
}
