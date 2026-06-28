// Intermarket Correlation engine (Module 7). Correlates gold (XAUUSD/GC=F) daily
// returns with a basket of related instruments, classifies each as supportive or
// pressure for gold, and flags divergences. Server-side, no AI.

import type { Bilingual, CorrelationInstrument, IntermarketCorrelation } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

interface Instrument {
  key: string; // i18n key
  symbol: string; // Yahoo symbol
  weight: number; // importance in the basket
}

// Expected typical relationship is learned from the realised correlation, not
// hardcoded — but weights reflect how much each driver usually matters to gold.
const INSTRUMENTS: Instrument[] = [
  { key: "ins_dxy", symbol: "DX-Y.NYB", weight: 3 },
  { key: "ins_us10y", symbol: "^TNX", weight: 3 },
  { key: "ins_us2y", symbol: "2YY=F", weight: 2 },
  { key: "ins_silver", symbol: "SI=F", weight: 2 },
  { key: "ins_oil", symbol: "CL=F", weight: 1 },
  { key: "ins_btc", symbol: "BTC-USD", weight: 1 },
  { key: "ins_nasdaq", symbol: "^IXIC", weight: 1 },
  { key: "ins_sp500", symbol: "^GSPC", weight: 1 },
  { key: "ins_vix", symbol: "^VIX", weight: 2 },
  { key: "ins_usdjpy", symbol: "JPY=X", weight: 2 },
  { key: "ins_eurusd", symbol: "EURUSD=X", weight: 1.5 },
];

interface Series {
  // day-bucket -> close, for date alignment across instruments
  byDay: Map<number, number>;
  closes: number[]; // chronological
}

const cache = new Map<string, { series: Series; at: number }>();
const TTL = 30 * 60_000; // 30 min (daily data)

async function fetchSeries(symbol: string): Promise<Series | null> {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < TTL) return cached.series;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    if (!ts.length || !closes.length) return null;
    const byDay = new Map<number, number>();
    const chrono: number[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (c == null) continue;
      byDay.set(Math.floor(ts[i] / 86400), c);
      chrono.push(c);
    }
    const series: Series = { byDay, closes: chrono };
    cache.set(symbol, { series, at: Date.now() });
    return series;
  } catch {
    return null;
  }
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a1 = x[i] - mx;
    const b1 = y[i] - my;
    num += a1 * b1;
    dx += a1 * a1;
    dy += b1 * b1;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

// Daily returns from date-aligned closes between gold and the instrument.
function alignedReturns(gold: Series, other: Series): { g: number[]; o: number[] } {
  const days = [...gold.byDay.keys()].filter((d) => other.byDay.has(d)).sort((a, b) => a - b);
  const g: number[] = [];
  const o: number[] = [];
  for (let i = 1; i < days.length; i++) {
    const gPrev = gold.byDay.get(days[i - 1])!;
    const gCur = gold.byDay.get(days[i])!;
    const oPrev = other.byDay.get(days[i - 1])!;
    const oCur = other.byDay.get(days[i])!;
    if (gPrev && oPrev) {
      g.push((gCur - gPrev) / gPrev);
      o.push((oCur - oPrev) / oPrev);
    }
  }
  // Use the most recent ~40 returns.
  return { g: g.slice(-40), o: o.slice(-40) };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export async function buildIntermarketCorrelation(): Promise<IntermarketCorrelation> {
  const gold = await fetchSeries("GC=F");
  if (!gold || gold.closes.length < 10) throw new Error("no gold data");

  const goldChangePct =
    gold.closes.length >= 2
      ? ((gold.closes[gold.closes.length - 1] - gold.closes[gold.closes.length - 2]) / gold.closes[gold.closes.length - 2]) * 100
      : 0;

  const results = await Promise.all(
    INSTRUMENTS.map(async (ins): Promise<CorrelationInstrument & { weight: number }> => {
      const s = await fetchSeries(ins.symbol);
      if (!s || s.closes.length < 6) {
        return { key: ins.key, symbol: ins.symbol, price: 0, changePct: 0, correlation: 0, impact: "neutral", strength: 0, available: false, weight: ins.weight };
      }
      const { g, o } = alignedReturns(gold, s);
      const corr = pearson(g, o);
      const last = s.closes[s.closes.length - 1];
      const prev = s.closes[s.closes.length - 2];
      const changePct = prev ? ((last - prev) / prev) * 100 : 0;
      // Contribution to gold = correlation × the instrument's recent move.
      const contribution = corr * changePct;
      const impact: CorrelationInstrument["impact"] =
        Math.abs(contribution) < 0.05 ? "neutral" : contribution > 0 ? "supportive" : "pressure";
      const strength = Math.round(clamp(Math.abs(corr) * Math.min(Math.abs(changePct) * 25, 100), 0, 100));
      return {
        key: ins.key,
        symbol: ins.symbol,
        price: +last.toFixed(last < 10 ? 4 : 2),
        changePct: +changePct.toFixed(2),
        correlation: +corr.toFixed(2),
        impact,
        strength,
        available: true,
        weight: ins.weight,
      };
    })
  );

  // Weighted net: sum(correlation × change × weight) → support score.
  let net = 0;
  let wsum = 0;
  for (const r of results) {
    if (!r.available) continue;
    net += r.correlation * r.changePct * r.weight;
    wsum += r.weight;
  }
  const avgContribution = wsum ? net / wsum : 0;
  // Map roughly to 0-100 (×40 sensitivity), 50 = neutral.
  const goldSupportScore = Math.round(clamp(50 + avgContribution * 40, 0, 100));
  const netBias = goldSupportScore > 55 ? "supportive" : goldSupportScore < 45 ? "pressure" : "neutral";

  const instruments: CorrelationInstrument[] = results.map(({ weight, ...rest }) => rest);
  const supportive = instruments
    .filter((i) => i.available && i.impact === "supportive")
    .sort((a, b) => b.strength - a.strength);
  const pressure = instruments
    .filter((i) => i.available && i.impact === "pressure")
    .sort((a, b) => b.strength - a.strength);

  // Divergence: a strong driver (|corr|>=0.5) whose recent move pushes gold the
  // OPPOSITE way to gold's own recent move — a tension worth flagging.
  const divergences: { key: string; note: Bilingual }[] = [];
  for (const r of results) {
    if (!r.available || Math.abs(r.correlation) < 0.5 || Math.abs(r.changePct) < 0.2) continue;
    const impliedGold = r.correlation * r.changePct; // expected gold direction from this driver
    if (Math.sign(impliedGold) !== 0 && Math.sign(impliedGold) !== Math.sign(goldChangePct) && Math.abs(goldChangePct) > 0.1) {
      divergences.push({
        key: r.key,
        note: {
          th: `${r.symbol} กำลังส่งสัญญาณสวนทางกับการเคลื่อนไหวของทองคำ (corr ${r.correlation})`,
          en: `${r.symbol} is pulling gold the opposite way to its current move (corr ${r.correlation}).`,
        },
      });
    }
  }

  return {
    symbol: "XAUUSD",
    source: "Yahoo Finance",
    goldChangePct: +goldChangePct.toFixed(2),
    goldSupportScore,
    netBias,
    supportive,
    pressure,
    instruments,
    divergences: divergences.slice(0, 4),
    timestamp: new Date().toISOString(),
  };
}
