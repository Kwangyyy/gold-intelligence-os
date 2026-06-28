// Content Studio (Module 19). Composes shareable gold content from live data —
// a brief, a social caption, and hashtags. Pure & client-safe; no AI needed
// (works even when the Gemini quota is exhausted). Bilingual.

import type { MarketSnapshot, TradePlan } from "./types";
import type { Lang } from "./i18n";

export type Tone = "professional" | "friendly" | "trendy";

const f = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RECO_TH: Record<string, string> = {
  strong_buy: "ซื้อแรง",
  buy: "ซื้อ",
  buy_on_pullback: "รอย่อแล้วซื้อ",
  wait: "รอดู",
  sell_on_rally: "รอเด้งแล้วขาย",
  sell: "ขาย",
  strong_sell: "ขายแรง",
  no_trade: "งดเทรด",
  high_news_risk: "เสี่ยงข่าวสูง",
};
const RECO_EN: Record<string, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  buy_on_pullback: "Buy on Pullback",
  wait: "Wait",
  sell_on_rally: "Sell on Rally",
  sell: "Sell",
  strong_sell: "Strong Sell",
  no_trade: "No Trade",
  high_news_risk: "High News Risk",
};

const DISCLAIMER_TH = "⚠️ การลงทุนมีความเสี่ยง ข้อมูลนี้เป็นการวิเคราะห์ ไม่ใช่การรับประกันผลกำไร";
const DISCLAIMER_EN = "⚠️ Trading involves risk. This is analysis, not a guarantee of profit.";

export interface ContentBundle {
  brief: string;
  caption: string;
  hashtags: string;
}

export function buildContent(
  market: MarketSnapshot,
  plan: TradePlan | null,
  lang: Lang,
  tone: Tone
): ContentBundle {
  const up = market.change >= 0;
  const arrow = up ? "▲" : "▼";
  const pct = `${up ? "+" : ""}${market.changePercent.toFixed(2)}%`;
  const reco = lang === "th" ? RECO_TH[market.recommendation.label] : RECO_EN[market.recommendation.label];
  const conf = market.recommendation.confidence;

  const brief =
    lang === "th"
      ? briefTh(market, plan, arrow, pct, reco, conf)
      : briefEn(market, plan, arrow, pct, reco, conf);

  const caption = lang === "th" ? captionTh(pct, reco, tone, up) : captionEn(pct, reco, tone, up);

  const hashtags =
    lang === "th"
      ? "#ทองคำ #XAUUSD #ราคาทอง #เทรดทอง #Gold #GoldTrading #EAProfitLab #วิเคราะห์ทอง #Forex"
      : "#Gold #XAUUSD #GoldTrading #Forex #Trading #PriceAction #EAProfitLab #GoldPrice #DayTrading";

  return { brief, caption, hashtags };
}

function planLineTh(plan: TradePlan | null): string {
  if (!plan || plan.direction === "none" || !plan.entryZone) return "";
  const d = plan.direction === "long" ? "ซื้อ" : "ขาย";
  return `\n📋 แผน${d}: เข้า ${f(plan.entryZone.low)}–${f(plan.entryZone.high)} | SL ${plan.stopLoss != null ? f(plan.stopLoss) : "-"} | TP ${plan.takeProfits.map(f).join(" / ")}${plan.riskReward ? ` (RR 1:${plan.riskReward})` : ""}`;
}
function planLineEn(plan: TradePlan | null): string {
  if (!plan || plan.direction === "none" || !plan.entryZone) return "";
  const d = plan.direction === "long" ? "Long" : "Short";
  return `\n📋 ${d} plan: entry ${f(plan.entryZone.low)}–${f(plan.entryZone.high)} | SL ${plan.stopLoss != null ? f(plan.stopLoss) : "-"} | TP ${plan.takeProfits.map(f).join(" / ")}${plan.riskReward ? ` (RR 1:${plan.riskReward})` : ""}`;
}

function newsLineTh(m: MarketSnapshot): string {
  const ev = m.newsRisk.nextEvent;
  if (!ev) return "";
  const mins = m.newsRisk.minutesToNext;
  return `\n📰 ข่าวถัดไป: ${ev.name.th}${mins != null ? ` (อีก ~${Math.round(mins / 60)} ชม.)` : ""}`;
}
function newsLineEn(m: MarketSnapshot): string {
  const ev = m.newsRisk.nextEvent;
  if (!ev) return "";
  const mins = m.newsRisk.minutesToNext;
  return `\n📰 Next event: ${ev.name.en}${mins != null ? ` (~${Math.round(mins / 60)}h)` : ""}`;
}

function briefTh(m: MarketSnapshot, plan: TradePlan | null, arrow: string, pct: string, reco: string, conf: number): string {
  return [
    `🟡 Gold Brief — XAUUSD`,
    `${arrow} ราคา ${f(m.price)} (${pct} วันนี้) · H ${f(m.high)} / L ${f(m.low)}`,
    `🤖 มุมมอง AI: ${reco} · เชื่อมั่น ${conf}%`,
    `📊 ความผันผวน: ${m.volatilityStatus} · ช่วงตลาด: ${m.session.current}`,
    planLineTh(plan),
    newsLineTh(m),
    ``,
    DISCLAIMER_TH,
  ]
    .filter(Boolean)
    .join("\n");
}
function briefEn(m: MarketSnapshot, plan: TradePlan | null, arrow: string, pct: string, reco: string, conf: number): string {
  return [
    `🟡 Gold Brief — XAUUSD`,
    `${arrow} Price ${f(m.price)} (${pct} today) · H ${f(m.high)} / L ${f(m.low)}`,
    `🤖 AI view: ${reco} · ${conf}% confidence`,
    `📊 Volatility: ${m.volatilityStatus} · Session: ${m.session.current}`,
    planLineEn(plan),
    newsLineEn(m),
    ``,
    DISCLAIMER_EN,
  ]
    .filter(Boolean)
    .join("\n");
}

function captionTh(pct: string, reco: string, tone: Tone, up: boolean): string {
  const move = up ? "ขึ้น" : "ลง";
  if (tone === "professional")
    return `ทองคำ XAUUSD ${move} ${pct} วันนี้ มุมมองเชิงเทคนิค: ${reco} ติดตามแนวรับแนวต้านและบริหารความเสี่ยงทุกครั้ง 🪙`;
  if (tone === "friendly")
    return `ทองวันนี้${move} ${pct} นะ 🪙 AI มองว่า "${reco}" ใครถือทองอยู่อย่าลืมตั้ง SL กันด้วยน้า ✨`;
  return `ทองพุ่ง/ร่วง ${pct} 🔥 AI จัดให้: ${reco} 🪙📈 สายเทรดทองห้ามพลาด! #ทองคำ`;
}
function captionEn(pct: string, reco: string, tone: Tone, up: boolean): string {
  const move = up ? "up" : "down";
  if (tone === "professional")
    return `XAUUSD is ${move} ${pct} today. Technical view: ${reco}. Watch key S/R and manage risk on every trade. 🪙`;
  if (tone === "friendly")
    return `Gold is ${move} ${pct} today 🪙 AI says "${reco}" — holding gold? Don't forget your stop loss ✨`;
  return `Gold just moved ${pct} 🔥 AI call: ${reco} 🪙📈 Gold traders, don't miss this!`;
}
