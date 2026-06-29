import { NextResponse } from "next/server";
import { SYMBOLS, type SymbolCategory } from "@/lib/symbolConfig";
import { fetchCandlesByTicker } from "@/lib/timeframes";
import {
  emaSeries, rsi, macd, bollinger,
  stochastic, cci, momentum, roc,
  parabolicSar, superTrend, adxFull, sma,
  type Candle,
} from "@/lib/indicators";

export const dynamic = "force-dynamic";

export interface MultiScanRow {
  id: string;
  label: string;
  icon: string;
  category: SymbolCategory;
  price: number;
  changePct: number;
  h1Score: number;
  h1Bias: "buy" | "sell" | "neutral";
  h4Score: number;
  h4Bias: "buy" | "sell" | "neutral";
  d1Score: number;
  d1Bias: "buy" | "sell" | "neutral";
  overallScore: number;
  overallBias: "buy" | "sell" | "neutral";
  bullCount: number;
  bearCount: number;
  error?: boolean;
}

// Per-symbol result cache (5 min TTL)
const CACHE = new Map<string, { row: MultiScanRow; at: number }>();
const TTL = 5 * 60_000;

type Bias = "buy" | "sell" | "neutral";

function scanCandles(candles: Candle[]): { score: number; bias: Bias; bull: number; bear: number } {
  if (candles.length < 30) return { score: 50, bias: "neutral", bull: 0, bear: 0 };
  const closes = candles.map(c => c.close);
  const price  = closes.at(-1)!;
  let bull = 0, bear = 0;

  // EMA 20/50
  const e20 = emaSeries(closes, 20).at(-1) ?? price;
  const e50 = emaSeries(closes, 50).at(-1) ?? price;
  if (e20 > e50) bull++; else if (e20 < e50) bear++;

  // SMA 200
  const s200 = sma(closes, 200);
  if (s200 != null) { if (price > s200) bull++; else bear++; }

  // SuperTrend
  const st = superTrend(candles, 10, 3);
  if (st) { if (st.rising) bull++; else bear++; }

  // PSAR
  const ps = parabolicSar(candles);
  if (ps) { if (ps.rising) bull++; else bear++; }

  // RSI
  const r = rsi(closes, 14);
  if (r != null) {
    if (r < 30 || r > 50) bull++;
    if (r > 70 || r < 50) bear++;
    // net: oversold = bull, overbought = bear
    if (r < 30) { bull++; }
    else if (r > 70) { bear++; }
    else if (r > 50) bull++; else bear++;
  }

  // MACD
  const m = macd(closes, 12, 26, 9);
  if (m) { if (m.histogram > 0) bull++; else bear++; }

  // Stochastic
  const sk = stochastic(candles, 14, 3);
  if (sk) { if (sk.k < 20 || sk.k > sk.d) bull++; else bear++; }

  // CCI
  const c = cci(candles, 20);
  if (c != null) { if (c > 0) bull++; else bear++; }

  // Momentum
  const mo = momentum(closes, 10);
  if (mo != null) { if (mo > 0) bull++; else bear++; }

  // ROC
  const rc = roc(closes, 12);
  if (rc != null) { if (rc > 0) bull++; else bear++; }

  // Bollinger
  const bb = bollinger(closes, 20, 2);
  if (bb) {
    const pos = bb.upper - bb.lower > 0 ? ((price - bb.lower) / (bb.upper - bb.lower)) * 100 : 50;
    if (pos < 20) bull++; else if (pos > 80) bear++; else if (pos < 50) bull++; else bear++;
  }

  // ADX direction
  const af = adxFull(candles, 14);
  if (af && af.adx > 25) { if (af.plusDI > af.minusDI) bull++; else bear++; }

  const total = bull + bear || 1;
  const score = Math.round(((bull - bear) / total) * 50 + 50);
  const bias: Bias = score > 55 ? "buy" : score < 45 ? "sell" : "neutral";
  return { score, bias, bull, bear };
}

// aggregate 60m candles → 4h candles
function agg4h(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += 4) {
    const g = candles.slice(i, i + 4);
    if (!g.length) break;
    out.push({ open: g[0].open, high: Math.max(...g.map(c => c.high)), low: Math.min(...g.map(c => c.low)), close: g.at(-1)!.close });
  }
  return out;
}

async function scanSymbol(sym: typeof SYMBOLS[0]): Promise<MultiScanRow> {
  const cached = CACHE.get(sym.id);
  if (cached && Date.now() - cached.at < TTL) return cached.row;

  try {
    // H1 and H4 share same fetch; D1 separate
    const [h1raw, d1raw] = await Promise.all([
      fetchCandlesByTicker(sym.yahooTicker, "60m", "6mo"),
      fetchCandlesByTicker(sym.yahooTicker, "1d", "2y"),
    ]);

    const h1Candles = h1raw.slice(-120);
    const h4Candles = agg4h(h1raw).slice(-80);
    const d1Candles = d1raw.slice(-200);

    const h1 = scanCandles(h1Candles);
    const h4 = scanCandles(h4Candles);
    const d1 = scanCandles(d1Candles);

    // Weighted overall: D1 ×2.5, H4 ×2, H1 ×1.5
    const wScore = (d1.score * 2.5 + h4.score * 2 + h1.score * 1.5) / 6;
    const overallScore = Math.round(wScore);
    const overallBias: Bias = overallScore > 55 ? "buy" : overallScore < 45 ? "sell" : "neutral";

    // Price + change from last D1 candles
    const price   = d1Candles.at(-1)?.close ?? 0;
    const prevClose = d1Candles.at(-2)?.close ?? price;
    const changePct = prevClose > 0 ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0;

    const row: MultiScanRow = {
      id: sym.id, label: sym.label, icon: sym.icon, category: sym.category,
      price, changePct,
      h1Score: h1.score, h1Bias: h1.bias,
      h4Score: h4.score, h4Bias: h4.bias,
      d1Score: d1.score, d1Bias: d1.bias,
      overallScore, overallBias,
      bullCount: h1.bull + h4.bull + d1.bull,
      bearCount: h1.bear + h4.bear + d1.bear,
    };
    CACHE.set(sym.id, { row, at: Date.now() });
    return row;
  } catch {
    return {
      id: sym.id, label: sym.label, icon: sym.icon, category: sym.category,
      price: 0, changePct: 0,
      h1Score: 50, h1Bias: "neutral", h4Score: 50, h4Bias: "neutral",
      d1Score: 50, d1Bias: "neutral", overallScore: 50, overallBias: "neutral",
      bullCount: 0, bearCount: 0, error: true,
    };
  }
}

// Concurrency-limited batch runner
async function runBatch<T>(tasks: (() => Promise<T>)[], concurrency = 6): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = await Promise.all(tasks.slice(i, i + concurrency).map(t => t()));
    results.push(...batch);
  }
  return results;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const catParam = searchParams.get("cat"); // comma-separated categories
  const cats = catParam ? new Set(catParam.split(",") as SymbolCategory[]) : null;

  const targets = cats ? SYMBOLS.filter(s => cats.has(s.category)) : SYMBOLS;
  const tasks = targets.map(sym => () => scanSymbol(sym));
  const rows = await runBatch(tasks, 6);

  // Sort: strongest signal first (furthest from 50)
  rows.sort((a, b) => Math.abs(b.overallScore - 50) - Math.abs(a.overallScore - 50));

  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
