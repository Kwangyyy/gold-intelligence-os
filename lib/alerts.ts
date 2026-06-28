// Alert Center engine (Module 18). Pure, client-safe evaluation of user alerts
// against the live market snapshot. Triggering/persistence is handled by the page.

import type { Bilingual, MarketSnapshot } from "./types";

export type AlertType =
  | "price_above"
  | "price_below"
  | "score_above"
  | "score_below"
  | "reco_change"
  | "news_30m";

export interface Alert {
  id: string;
  type: AlertType;
  value?: number; // threshold for price/score alerts
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  message?: Bilingual; // captured when triggered
}

export interface AlertContext {
  snapshot: MarketSnapshot;
  prevReco?: string; // previous recommendation label (for reco_change)
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Returns a bilingual trigger message if the alert fires now, else null.
export function evaluateAlert(alert: Alert, ctx: AlertContext): Bilingual | null {
  const s = ctx.snapshot;
  switch (alert.type) {
    case "price_above":
      if (alert.value != null && s.price >= alert.value)
        return { th: `ราคาทองขึ้นแตะ ${fmt(s.price)} (≥ ${fmt(alert.value)})`, en: `Gold reached ${fmt(s.price)} (≥ ${fmt(alert.value)})` };
      return null;
    case "price_below":
      if (alert.value != null && s.price <= alert.value)
        return { th: `ราคาทองลงแตะ ${fmt(s.price)} (≤ ${fmt(alert.value)})`, en: `Gold dropped to ${fmt(s.price)} (≤ ${fmt(alert.value)})` };
      return null;
    case "score_above":
      if (alert.value != null && s.marketScore >= alert.value)
        return { th: `คะแนนตลาด ${s.marketScore} (≥ ${alert.value})`, en: `Market score ${s.marketScore} (≥ ${alert.value})` };
      return null;
    case "score_below":
      if (alert.value != null && s.marketScore <= alert.value)
        return { th: `คะแนนตลาด ${s.marketScore} (≤ ${alert.value})`, en: `Market score ${s.marketScore} (≤ ${alert.value})` };
      return null;
    case "reco_change":
      if (ctx.prevReco && ctx.prevReco !== s.recommendation.label)
        return {
          th: `คำแนะนำ AI เปลี่ยนเป็น ${s.recommendation.label}`,
          en: `AI recommendation changed to ${s.recommendation.label}`,
        };
      return null;
    case "news_30m":
      if (s.newsRisk.warning)
        return {
          th: `ข่าวแรงใกล้ออกภายใน 30 นาที: ${s.newsRisk.nextEvent?.name.th ?? ""}`,
          en: `High-impact news within 30 min: ${s.newsRisk.nextEvent?.name.en ?? ""}`,
        };
      return null;
    default:
      return null;
  }
}

export const ALERT_TYPES: AlertType[] = [
  "price_above",
  "price_below",
  "score_above",
  "score_below",
  "reco_change",
  "news_30m",
];

export const needsValue = (t: AlertType) =>
  t === "price_above" || t === "price_below" || t === "score_above" || t === "score_below";
