"use client";

import { useI18n } from "@/lib/i18n";
import type { IndicatorReading, TechnicalScore } from "@/lib/types";
import { Card, ScoreRing, SignalBadge } from "./shared";

function barColor(value: number, kind: "directional" | "risk" | "info" | "level"): string {
  if (kind === "directional") return value >= 55 ? "bg-bull" : value <= 45 ? "bg-bear" : "bg-gold";
  if (kind === "risk") return value >= 60 ? "bg-bear" : value >= 35 ? "bg-warn" : "bg-bull";
  if (kind === "info") return "bg-neon";
  return "bg-gold";
}

function ScoreBar({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind: "directional" | "risk" | "info" | "level";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-silver/60">{label}</span>
        <span className="font-mono font-semibold text-silver">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-base-border">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barColor(value, kind)}`}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function SignalDot({ signal }: { signal: IndicatorReading["signal"] }) {
  const color =
    signal === "bull" ? "bg-bull" : signal === "bear" ? "bg-bear" : "bg-silver/40";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function IndicatorGroup({ title, items }: { title: string; items: IndicatorReading[] }) {
  const { indicator, indSignal } = useI18n();
  return (
    <Card className="p-0">
      <div className="border-b border-base-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gold/80">
        {title}
      </div>
      <ul className="divide-y divide-base-border/40">
        {items.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-medium text-silver">{indicator(r.key)}</div>
              {r.detail && <div className="truncate text-[11px] text-silver/40">{r.detail}</div>}
            </div>
            <div className="flex items-center gap-2 text-right">
              <span className="font-mono text-sm text-silver/80">{r.value}</span>
              <SignalDot signal={r.signal} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TechnicalSummary({ data }: { data: TechnicalScore }) {
  const { t, recommendation } = useI18n();
  return (
    <Card accent="neon">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center gap-2 sm:w-40">
          <span className="stat-label">{t("technicalScoreLabel")}</span>
          <ScoreRing score={data.technicalScore} />
          <SignalBadge label={data.signal} text={recommendation(data.signal)} />
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <ScoreBar label={t("trendScoreLabel")} value={data.trendScore} kind="directional" />
          <ScoreBar label={t("momentumScoreLabel")} value={data.momentumScore} kind="directional" />
          <ScoreBar label={t("volatilityScoreLabel")} value={data.volatilityScore} kind="level" />
          <ScoreBar label={t("reversalRiskLabel")} value={data.reversalRisk} kind="risk" />
          <ScoreBar label={t("breakoutProbLabel")} value={data.breakoutProbability} kind="info" />
        </div>
      </div>
    </Card>
  );
}

export function IndicatorGrid({ data }: { data: TechnicalScore }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <IndicatorGroup title={t("catTrend")} items={data.indicators.trend} />
      <IndicatorGroup title={t("catMomentum")} items={data.indicators.momentum} />
      <IndicatorGroup title={t("catVolatility")} items={data.indicators.volatility} />
      <IndicatorGroup title={t("catLevels")} items={data.indicators.levels} />
    </div>
  );
}
