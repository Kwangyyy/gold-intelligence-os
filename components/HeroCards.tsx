"use client";

import { useI18n } from "@/lib/i18n";
import type { MarketSnapshot } from "@/lib/types";
import {
  Card,
  RiskMeter,
  ScoreRing,
  SignalBadge,
  fmtDuration,
  fmtPrice,
  fmtSigned,
  recoTone,
} from "./shared";

function CardHeader({ label }: { label: string }) {
  return <div className="stat-label mb-2">{label}</div>;
}

// 1) Current Gold Price -------------------------------------------------------
export function PriceCard({ data }: { data: MarketSnapshot }) {
  const { t } = useI18n();
  const up = data.change >= 0;
  return (
    <Card accent="gold" className="flex flex-col justify-between">
      <CardHeader label={t("cardPrice")} />
      <div>
        <div className="font-mono text-3xl font-bold text-gold">
          {fmtPrice(data.price)}
        </div>
        <div className="mt-0.5 text-xs text-silver/50">{data.symbol} · USD</div>
      </div>
      <div className={`mt-3 text-sm font-semibold ${up ? "text-bull" : "text-bear"}`}>
        {fmtSigned(data.change)} ({up ? "+" : ""}
        {data.changePercent.toFixed(2)}%)
      </div>
    </Card>
  );
}

// 2) AI Recommendation --------------------------------------------------------
export function RecommendationCard({ data }: { data: MarketSnapshot }) {
  const { t, recommendation } = useI18n();
  const r = data.recommendation;
  const tone = recoTone(r.label);
  return (
    <Card accent="neon" className="flex flex-col justify-between">
      <CardHeader label={t("cardRecommendation")} />
      <div>
        <SignalBadge label={r.label} text={recommendation(r.label)} />
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`font-mono text-2xl font-bold ${tone.text}`}>
            {r.confidence}%
          </span>
          <span className="text-xs text-silver/50">{t("confidence")}</span>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-silver/40">{t("notTradingAdvice")}</div>
    </Card>
  );
}

// 3) Market Score -------------------------------------------------------------
export function ScoreCard({ data }: { data: MarketSnapshot }) {
  const { t, condition } = useI18n();
  return (
    <Card className="flex flex-col items-center justify-between">
      <CardHeader label={t("cardScore")} />
      <ScoreRing score={data.marketScore} />
      <div className="mt-2 text-xs font-medium text-silver/70">
        {condition(data.marketCondition)}
      </div>
    </Card>
  );
}

// 4) Volatility ---------------------------------------------------------------
export function VolatilityCard({ data }: { data: MarketSnapshot }) {
  const { t, volatility } = useI18n();
  const v = data.volatilityStatus;
  const color =
    v === "extreme"
      ? "text-bear"
      : v === "elevated"
        ? "text-warn"
        : v === "low"
          ? "text-silver"
          : "text-bull";
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader label={t("cardVolatility")} />
      <div className={`text-2xl font-bold ${color}`}>{volatility(v)}</div>
      <div className="mt-3 space-y-1 text-xs text-silver/60">
        <div className="flex justify-between">
          <span>{t("atr")}</span>
          <span className="stat-value">{fmtPrice(data.atr)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("dailyRange")}</span>
          <span className="stat-value">{fmtPrice(data.dailyRange)}</span>
        </div>
      </div>
    </Card>
  );
}

// 5) News Risk ----------------------------------------------------------------
export function NewsRiskCard({ data }: { data: MarketSnapshot }) {
  const { t, tb, risk, lang } = useI18n();
  const nr = data.newsRisk;
  const hLabel = lang === "th" ? "ชม." : "h";
  const mLabel = lang === "th" ? "น." : "m";
  return (
    <Card
      accent={nr.warning ? "gold" : "none"}
      className="flex flex-col justify-between"
    >
      <CardHeader label={t("cardNewsRisk")} />
      <div>
        <RiskMeter level={nr.level} label={risk(nr.level)} />
      </div>
      <div className="mt-3 text-xs text-silver/60">
        {nr.nextEvent ? (
          <>
            <div className="truncate font-medium text-silver/80">
              {tb(nr.nextEvent.name)}
            </div>
            <div className="mt-0.5">
              {t("nextEvent")}:{" "}
              <span className="stat-value">
                {nr.minutesToNext != null
                  ? fmtDuration(nr.minutesToNext, hLabel, mLabel)
                  : "—"}
              </span>
            </div>
            {nr.nextEvent.impactAnalysis && (
              <div className="mt-2 border-t border-base-border/60 pt-2">
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neon/80">
                  {t("newsImpact")}
                </div>
                <p className="leading-snug text-silver/70">{tb(nr.nextEvent.impactAnalysis)}</p>
              </div>
            )}
          </>
        ) : (
          <span>{t("noUpcomingNews")}</span>
        )}
      </div>
      {nr.warning && (
        <div className="mt-2 rounded-md bg-warn/15 px-2 py-1 text-[11px] font-medium text-warn">
          {t("newsWarning")}
        </div>
      )}
    </Card>
  );
}
