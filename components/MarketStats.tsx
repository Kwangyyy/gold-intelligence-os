"use client";

import { useI18n } from "@/lib/i18n";
import type { MarketSnapshot } from "@/lib/types";
import { Card, fmtDuration, fmtPrice } from "./shared";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-base-border/60 bg-base-panel/50 p-3">
      <span className="stat-label">{label}</span>
      <span className={`text-lg font-semibold ${accent ?? "stat-value"}`}>{value}</span>
    </div>
  );
}

export function MarketStatsGrid({ data }: { data: MarketSnapshot }) {
  const { t, condition } = useI18n();
  const up = data.change >= 0;
  return (
    <Card>
      <div className="stat-label mb-3">{t("marketOverview")}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label={t("open")} value={fmtPrice(data.open)} />
        <Stat label={t("high")} value={fmtPrice(data.high)} accent="text-bull" />
        <Stat label={t("low")} value={fmtPrice(data.low)} accent="text-bear" />
        <Stat label={t("prevClose")} value={fmtPrice(data.previousClose)} />
        <Stat
          label={t("dailyChange")}
          value={`${up ? "+" : ""}${data.changePercent.toFixed(2)}%`}
          accent={up ? "text-bull" : "text-bear"}
        />
        <Stat label={t("spread")} value={fmtPrice(data.spread)} />
        <Stat label={t("atr")} value={fmtPrice(data.atr)} />
        <Stat label={t("dailyRange")} value={fmtPrice(data.dailyRange)} />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-base-border/60 bg-base-panel/50 px-3 py-2">
        <span className="stat-label">{t("marketCondition")}</span>
        <span className="text-sm font-semibold text-neon">
          {condition(data.marketCondition)}
        </span>
      </div>
    </Card>
  );
}

export function SessionClock({ data }: { data: MarketSnapshot }) {
  const { t, sessionName, lang } = useI18n();
  const s = data.session;
  const hLabel = lang === "th" ? "ชม." : "h";
  const mLabel = lang === "th" ? "น." : "m";
  return (
    <Card>
      <div className="stat-label mb-3">{t("session")}</div>
      <div className="mb-3">
        <span className="stat-label">{t("currentSession")}</span>
        <div className="text-xl font-bold text-gold">{sessionName(s.current)}</div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-silver/60">{t("londonOpen")}</span>
          <span className={s.londonOpen ? "font-semibold text-bull" : "stat-value"}>
            {s.londonOpen ? t("openNow") : fmtDuration(s.minutesToLondonOpen, hLabel, mLabel)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-silver/60">{t("newYorkOpen")}</span>
          <span className={s.newYorkOpen ? "font-semibold text-bull" : "stat-value"}>
            {s.newYorkOpen ? t("openNow") : fmtDuration(s.minutesToNewYorkOpen, hLabel, mLabel)}
          </span>
        </div>
      </div>
    </Card>
  );
}
