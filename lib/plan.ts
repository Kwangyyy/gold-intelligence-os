// Trading Plan generator (Module 11). Composes a concrete, actionable plan from
// the AI recommendation, support/resistance levels, and ATR. Pure given inputs.

import type { Bilingual, MarketSnapshot, RecommendationLabel, SupportResistance, TradePlan } from "./types";

const r2 = (n: number) => +n.toFixed(2);

const LONG_LABELS: RecommendationLabel[] = ["buy", "strong_buy", "buy_on_pullback"];
const SHORT_LABELS: RecommendationLabel[] = ["sell", "strong_sell", "sell_on_rally"];

export function buildTradePlan(market: MarketSnapshot, levels: SupportResistance | null): TradePlan {
  const price = market.price;
  const atr = market.atr || price * 0.01;
  const bias = market.recommendation.label;
  const newsWarning = market.newsRisk.warning;

  const direction: TradePlan["direction"] = LONG_LABELS.includes(bias)
    ? "long"
    : SHORT_LABELS.includes(bias)
      ? "short"
      : "none";

  // No-trade plans (wait / no_trade / high_news_risk).
  if (direction === "none") {
    return {
      symbol: market.symbol,
      source: market.source,
      price,
      atr: r2(atr),
      direction: "none",
      bias,
      confidence: market.recommendation.confidence,
      entryZone: null,
      stopLoss: null,
      takeProfits: [],
      riskReward: null,
      invalidation: null,
      newsWarning,
      reason: noTradeReason(bias, newsWarning),
      alternative: {
        th: "รอให้ราคาเลือกทางชัดเจน แล้วค่อยวางแผนเข้าใหม่ตามแนวรับแนวต้าน",
        en: "Wait for a clear break, then plan an entry around the key S/R levels.",
      },
      timestamp: new Date().toISOString(),
    };
  }

  const supports = levels?.supports?.map((l) => l.price) ?? [];
  const resistances = levels?.resistances?.map((l) => l.price) ?? [];
  const pullback = bias === "buy_on_pullback" || bias === "sell_on_rally";

  let entryZone: { low: number; high: number };
  let stopLoss: number;
  let takeProfits: number[];

  if (direction === "long") {
    const nearSup = supports[0] ?? price - atr;
    // Pullback longs wait down at support; momentum longs enter near price.
    entryZone = pullback
      ? { low: r2(nearSup), high: r2(Math.min(price, nearSup + 0.4 * atr)) }
      : { low: r2(price - 0.3 * atr), high: r2(price + 0.1 * atr) };
    stopLoss = r2(Math.min(nearSup, entryZone.low) - 0.5 * atr);
    // Targets: real resistances above, else ATR ladder.
    const ups = resistances.filter((x) => x > price).sort((a, b) => a - b);
    takeProfits = [ups[0] ?? price + atr, ups[1] ?? price + 2 * atr, ups[2] ?? price + 3 * atr].map(r2);
  } else {
    const nearRes = resistances[0] ?? price + atr;
    entryZone = pullback
      ? { low: r2(Math.max(price, nearRes - 0.4 * atr)), high: r2(nearRes) }
      : { low: r2(price - 0.1 * atr), high: r2(price + 0.3 * atr) };
    stopLoss = r2(Math.max(nearRes, entryZone.high) + 0.5 * atr);
    const downs = resistances.length || supports.length ? supports.filter((x) => x < price).sort((a, b) => b - a) : [];
    takeProfits = [downs[0] ?? price - atr, downs[1] ?? price - 2 * atr, downs[2] ?? price - 3 * atr].map(r2);
  }

  const entryMid = (entryZone.low + entryZone.high) / 2;
  const riskPerUnit = Math.abs(entryMid - stopLoss);
  const tp2 = takeProfits[1];
  const riskReward = riskPerUnit > 0 ? r2(Math.abs(tp2 - entryMid) / riskPerUnit) : null;
  const invalidation = stopLoss;

  return {
    symbol: market.symbol,
    source: market.source,
    price,
    atr: r2(atr),
    direction,
    bias,
    confidence: market.recommendation.confidence,
    entryZone,
    stopLoss,
    takeProfits,
    riskReward,
    invalidation,
    newsWarning,
    reason: planReason(market, direction),
    alternative:
      direction === "long"
        ? { th: `หากราคาหลุด ${stopLoss} แผนซื้อใช้ไม่ได้ ให้พลิกมามองฝั่งขายตามแนวรับถัดไป`, en: `If price closes below ${stopLoss}, the long is invalid — flip to watching the downside toward the next support.` }
        : { th: `หากราคายืนเหนือ ${stopLoss} แผนขายใช้ไม่ได้ ให้พลิกมามองฝั่งซื้อตามแนวต้านถัดไป`, en: `If price closes above ${stopLoss}, the short is invalid — flip to watching the upside toward the next resistance.` },
    timestamp: new Date().toISOString(),
  };
}

function planReason(market: MarketSnapshot, direction: "long" | "short"): Bilingual {
  const dirTh = direction === "long" ? "ฝั่งซื้อ" : "ฝั่งขาย";
  const dirEn = direction === "long" ? "long" : "short";
  const reasons = market.recommendation.mainReasons;
  return {
    th: `แผน${dirTh} อ้างอิงคำแนะนำ AI (เชื่อมั่น ${market.recommendation.confidence}%) และแนวรับแนวต้านสำคัญ: ${reasons.map((r) => r.th).join("; ")}`,
    en: `${dirEn[0].toUpperCase()}${dirEn.slice(1)} plan based on the AI recommendation (confidence ${market.recommendation.confidence}%) and key S/R levels: ${reasons.map((r) => r.en).join("; ")}`,
  };
}

function noTradeReason(bias: RecommendationLabel, newsWarning: boolean): Bilingual {
  if (newsWarning || bias === "high_news_risk")
    return {
      th: "ใกล้มีข่าวแรง ความเสี่ยงสูง แนะนำงดเปิดสถานะใหม่จนกว่าตลาดจะนิ่ง",
      en: "High-impact news is near — risk is elevated. Avoid new positions until the market settles.",
    };
  return {
    th: "สัญญาณยังไม่ชัดเจนพอจะวางแผนเทรด ควรรอจังหวะที่ความน่าจะเป็นสูงกว่านี้",
    en: "Signals aren't clear enough for a trade plan yet — wait for a higher-probability setup.",
  };
}
