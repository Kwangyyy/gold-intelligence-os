// Smart Money Concept engine (Module 4). Detects structure (BOS/CHoCH),
// order blocks, fair value gaps, liquidity pools & sweeps, and premium/discount,
// then derives an SMC bias and key levels. Server-side, no AI.

import { fetchCandlesForTf } from "./timeframes";
import type { Candle } from "./indicators";
import type {
  Bilingual,
  FairValueGap,
  LiquidityPool,
  OrderBlock,
  SmcAnalysis,
  SmcBias,
  StructureEvent,
  TimeframeCode,
} from "./types";

interface Pivot {
  kind: "H" | "L";
  price: number;
  index: number;
}

const round2 = (n: number) => +n.toFixed(2);

// Fractal pivots: a high/low more extreme than `lb` neighbours on each side.
function pivots(candles: Candle[], lb = 2): Pivot[] {
  const out: Pivot[] = [];
  for (let i = lb; i < candles.length - lb; i++) {
    let isH = true;
    let isL = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isH = false;
      if (candles[j].low <= candles[i].low) isL = false;
    }
    if (isH) out.push({ kind: "H", price: candles[i].high, index: i });
    if (isL) out.push({ kind: "L", price: candles[i].low, index: i });
  }
  return out.sort((a, b) => a.index - b.index);
}

// Structure events: comparing consecutive same-type pivots.
// Higher-high break in a downtrend = CHoCH; in an uptrend = BOS (and vice versa).
function structure(pv: Pivot[]): { events: StructureEvent[]; trend: SmcBias } {
  const events: StructureEvent[] = [];
  let prevHigh: number | null = null;
  let prevLow: number | null = null;
  let trend: SmcBias = "neutral";
  for (const p of pv) {
    if (p.kind === "H") {
      if (prevHigh != null && p.price > prevHigh) {
        events.push({ type: trend === "bearish" ? "CHoCH" : "BOS", direction: "bullish", level: round2(prevHigh) });
        trend = "bullish";
      }
      prevHigh = p.price;
    } else {
      if (prevLow != null && p.price < prevLow) {
        events.push({ type: trend === "bullish" ? "CHoCH" : "BOS", direction: "bearish", level: round2(prevLow) });
        trend = "bearish";
      }
      prevLow = p.price;
    }
  }
  return { events, trend };
}

// Order blocks: the last opposite candle before the impulse that broke structure.
function orderBlocks(candles: Candle[], pv: Pivot[]): OrderBlock[] {
  const obs: OrderBlock[] = [];
  // Use the most recent up to 12 pivots as break anchors.
  for (const p of pv.slice(-12)) {
    if (p.kind === "H") {
      // bullish impulse broke a high → find last bearish candle before index p.index
      for (let i = p.index; i > Math.max(0, p.index - 12); i--) {
        if (candles[i].close < candles[i].open) {
          const top = candles[i].high;
          const bottom = candles[i].low;
          const mitigated = candles.slice(i + 1).some((c) => c.low <= top && c.high >= bottom && c.low < bottom + (top - bottom));
          obs.push({ kind: "bullish", top: round2(top), bottom: round2(bottom), mitigated });
          break;
        }
      }
    } else {
      for (let i = p.index; i > Math.max(0, p.index - 12); i--) {
        if (candles[i].close > candles[i].open) {
          const top = candles[i].high;
          const bottom = candles[i].low;
          const mitigated = candles.slice(i + 1).some((c) => c.high >= bottom && c.low <= top);
          obs.push({ kind: "bearish", top: round2(top), bottom: round2(bottom), mitigated });
          break;
        }
      }
    }
  }
  // De-dup by zone, keep most recent few, prefer relevance to current price.
  const seen = new Set<string>();
  const unique = obs.filter((o) => {
    const k = `${o.kind}-${o.top}-${o.bottom}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.slice(-6).reverse();
}

// Fair value gaps: 3-candle imbalance.
function fvgs(candles: Candle[]): FairValueGap[] {
  const out: FairValueGap[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const a = candles[i - 1];
    const c = candles[i + 1];
    if (a.high < c.low) {
      const top = c.low;
      const bottom = a.high;
      const filled = candles.slice(i + 2).some((x) => x.low <= bottom);
      out.push({ kind: "bullish", top: round2(top), bottom: round2(bottom), filled });
    } else if (a.low > c.high) {
      const top = a.low;
      const bottom = c.high;
      const filled = candles.slice(i + 2).some((x) => x.high >= top);
      out.push({ kind: "bearish", top: round2(top), bottom: round2(bottom), filled });
    }
  }
  // Most recent, prefer unfilled.
  return out.slice(-8).reverse().sort((a, b) => Number(a.filled) - Number(b.filled)).slice(0, 6);
}

// Liquidity pools from equal highs/lows (clustered swing extremes).
function liquidity(candles: Candle[], pv: Pivot[]): LiquidityPool[] {
  const price = candles[candles.length - 1].close;
  const tol = price * 0.0012;
  const highs = pv.filter((p) => p.kind === "H").map((p) => p.price);
  const lows = pv.filter((p) => p.kind === "L").map((p) => p.price);

  const clusterLevels = (vals: number[]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const groups: number[][] = [];
    for (const v of sorted) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(v - g[g.length - 1]) <= tol) g.push(v);
      else groups.push([v]);
    }
    // Prefer clusters of >=2 (equal highs/lows = real liquidity), else singles.
    return groups.map((g) => ({ level: g.reduce((s, x) => s + x, 0) / g.length, count: g.length }));
  };

  const pools: LiquidityPool[] = [];

  // A level is swept only if price pierced beyond it and then CLOSED back across
  // it afterwards (sweep + reversal) — not merely touched at some point.
  const sweptBuyside = (level: number) => {
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].high > level + tol) {
        if (candles.slice(i + 1).some((c) => c.close < level)) return true;
      }
    }
    return false;
  };
  const sweptSellside = (level: number) => {
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].low < level - tol) {
        if (candles.slice(i + 1).some((c) => c.close > level)) return true;
      }
    }
    return false;
  };

  for (const { level } of clusterLevels(highs)) {
    if (level <= price) continue; // buyside is above price
    pools.push({ side: "buyside", price: round2(level), swept: sweptBuyside(level) });
  }
  for (const { level } of clusterLevels(lows)) {
    if (level >= price) continue;
    pools.push({ side: "sellside", price: round2(level), swept: sweptSellside(level) });
  }
  // Nearest to price first.
  pools.sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price));
  return pools.slice(0, 6);
}

export async function buildSmc(tf: TimeframeCode): Promise<SmcAnalysis> {
  const all = await fetchCandlesForTf(tf);
  if (all.length < 60) throw new Error(`insufficient candles for ${tf}`);
  const candles = all.slice(-300);
  const price = candles[candles.length - 1].close;

  const pv = pivots(candles, 2);
  const { events, trend } = structure(pv);
  const bias = trend;

  const obs = orderBlocks(candles, pv);
  const gaps = fvgs(candles);
  const pools = liquidity(candles, pv);

  // Dealing range = most recent swing high & low → premium/discount.
  const recentHighs = pv.filter((p) => p.kind === "H").slice(-5).map((p) => p.price);
  const recentLows = pv.filter((p) => p.kind === "L").slice(-5).map((p) => p.price);
  const rangeHigh = recentHighs.length ? Math.max(...recentHighs) : Math.max(...candles.map((c) => c.high));
  const rangeLow = recentLows.length ? Math.min(...recentLows) : Math.min(...candles.map((c) => c.low));
  const span = rangeHigh - rangeLow || 1;
  const position = Math.round(((price - rangeLow) / span) * 100);
  const zone = position > 55 ? "premium" : position < 45 ? "discount" : "equilibrium";

  // Key order block: most recent unmitigated OB aligned with bias.
  const keyOrderBlock =
    obs.find((o) => !o.mitigated && (bias === "neutral" || o.kind === bias)) ?? obs[0] ?? null;

  // Liquidity target = nearest pool in the direction of bias.
  const buyside = pools.filter((p) => p.side === "buyside" && !p.swept).sort((a, b) => a.price - b.price);
  const sellside = pools.filter((p) => p.side === "sellside" && !p.swept).sort((a, b) => b.price - a.price);
  const liquidityTarget =
    bias === "bullish" ? buyside[0] ?? null : bias === "bearish" ? sellside[0] ?? null : null;

  // Invalidation: break of the protected swing against the bias.
  const lastSwingLow = pv.filter((p) => p.kind === "L").slice(-1)[0]?.price ?? null;
  const lastSwingHigh = pv.filter((p) => p.kind === "H").slice(-1)[0]?.price ?? null;
  const invalidation =
    bias === "bullish" ? (lastSwingLow != null ? round2(lastSwingLow) : null) : bias === "bearish" ? (lastSwingHigh != null ? round2(lastSwingHigh) : null) : null;

  // Possible sweep: nearest unswept liquidity pool either side.
  const possibleSweep = pools.find((p) => !p.swept) ?? null;

  const lastEvent = events[events.length - 1];
  const reason = buildReason(bias, zone, lastEvent, liquidityTarget);

  return {
    symbol: "XAUUSD",
    source: "Yahoo Finance · COMEX GC=F",
    tf,
    price: round2(price),
    bias,
    premiumDiscount: { position: Math.max(0, Math.min(100, position)), zone, rangeHigh: round2(rangeHigh), rangeLow: round2(rangeLow) },
    keyOrderBlock,
    liquidityTarget: liquidityTarget ? { side: liquidityTarget.side, price: liquidityTarget.price } : null,
    invalidation,
    possibleSweep: possibleSweep ? { side: possibleSweep.side, price: possibleSweep.price } : null,
    orderBlocks: obs,
    fvgs: gaps,
    liquidity: pools,
    events: events.slice(-6).reverse(),
    reason,
    timestamp: new Date().toISOString(),
    candles: candles.slice(-80).map((c) => ({ o: round2(c.open), h: round2(c.high), l: round2(c.low), c: round2(c.close) })),
  };
}

function buildReason(
  bias: SmcBias,
  zone: "premium" | "discount" | "equilibrium",
  lastEvent: StructureEvent | undefined,
  target: LiquidityPool | null,
): Bilingual {
  const biasTh = bias === "bullish" ? "ขาขึ้น" : bias === "bearish" ? "ขาลง" : "เป็นกลาง";
  const biasEn = bias;
  const zoneTh = zone === "premium" ? "โซนพรีเมียม (แพง)" : zone === "discount" ? "โซนดิสเคานต์ (ถูก)" : "บริเวณสมดุล";
  const zoneEn = zone;
  const evTh = lastEvent ? `ล่าสุดเกิด ${lastEvent.type} ฝั่ง${lastEvent.direction === "bullish" ? "ขาขึ้น" : "ขาลง"} ที่ ${lastEvent.level}` : "ยังไม่มีสัญญาณโครงสร้างชัดเจน";
  const evEn = lastEvent ? `latest ${lastEvent.type} (${lastEvent.direction}) at ${lastEvent.level}` : "no clear structure shift yet";
  const tgtTh = target ? ` เป้าสภาพคล่องถัดไปอยู่ที่ ${target.price}` : "";
  const tgtEn = target ? ` Next liquidity target around ${target.price}.` : "";
  return {
    th: `โครงสร้าง SMC เป็น${biasTh} ราคาอยู่ใน${zoneTh} โดย${evTh}.${tgtTh}`,
    en: `SMC structure is ${biasEn}; price is in the ${zoneEn} zone with ${evEn}.${tgtEn}`,
  };
}
