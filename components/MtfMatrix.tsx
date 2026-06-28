"use client";

import { useI18n } from "@/lib/i18n";
import type { MultiTimeframe, TfTrend, TimeframeRow } from "@/lib/types";
import { Card, SignalBadge, recoTone } from "./shared";

const fmt = (n: number | null, d = 1) =>
  n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function trendColor(t: TfTrend | "bull" | "bear" | "neutral"): string {
  if (t === "bullish" || t === "bull") return "text-bull";
  if (t === "bearish" || t === "bear") return "text-bear";
  return "text-silver/60";
}

function emaColor(s: string): string {
  if (s === "strong_up" || s === "up") return "text-bull";
  if (s === "strong_down" || s === "down") return "text-bear";
  return "text-silver/60";
}

function rsiColor(v: number | null): string {
  if (v == null) return "text-silver/40";
  if (v >= 70) return "text-warn";
  if (v <= 30) return "text-warn";
  if (v >= 55) return "text-bull";
  if (v <= 45) return "text-bear";
  return "text-silver/70";
}

export function OverallBiasCard({ data }: { data: MultiTimeframe }) {
  const { t, tb, recommendation } = useI18n();
  const o = data.overall;
  const tone = recoTone(o.bias);
  return (
    <Card accent="neon">
      <div className="stat-label mb-2">{t("overallBias")}</div>
      <div className="flex flex-wrap items-center gap-4">
        <SignalBadge label={o.bias} text={recommendation(o.bias)} />
        <div className="flex gap-4 text-sm">
          <span className="text-bull">{t("bullishTfs")}: {o.bullishCount}</span>
          <span className="text-bear">{t("bearishTfs")}: {o.bearishCount}</span>
          <span className="text-silver/60">{t("neutralTfs")}: {o.neutralCount}</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-silver/70">{tb(o.explanation)}</p>
    </Card>
  );
}

export function MtfTable({ data }: { data: MultiTimeframe }) {
  const { t, trend, emaStatus, macdState, recommendation } = useI18n();

  const headers = [
    t("colTimeframe"),
    t("colTrend"),
    t("colEma"),
    t("colRsi"),
    t("colMacd"),
    t("colAdx"),
    t("colAtr"),
    t("colStructure"),
    t("colSignal"),
    t("colConfidence"),
  ];

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-base-border text-left">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver/50 ${
                  i === 0 ? "sticky left-0 bg-base-card" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <Row
              key={r.tf}
              r={r}
              labels={{ trend, emaStatus, macdState, recommendation, na: t("naShort") }}
            />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Row({
  r,
  labels,
}: {
  r: TimeframeRow;
  labels: {
    trend: (k: string) => string;
    emaStatus: (k: string) => string;
    macdState: (k: string) => string;
    recommendation: (k: string) => string;
    na: string;
  };
}) {
  if (!r.available) {
    return (
      <tr className="border-b border-base-border/40 text-silver/30">
        <td className="sticky left-0 bg-base-card px-3 py-3 font-mono font-bold text-silver/60">{r.tf}</td>
        <td className="px-3 py-3" colSpan={9}>
          {labels.na}
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-base-border/40 transition-colors hover:bg-base-panel/40">
      <td className="sticky left-0 bg-base-card px-3 py-3 font-mono font-bold text-silver">{r.tf}</td>
      <td className={`px-3 py-3 font-medium ${trendColor(r.trend)}`}>{labels.trend(r.trend)}</td>
      <td className={`px-3 py-3 ${emaColor(r.emaStatus)}`}>{labels.emaStatus(r.emaStatus)}</td>
      <td className={`px-3 py-3 font-mono ${rsiColor(r.rsi)}`}>{fmt(r.rsi)}</td>
      <td className={`px-3 py-3 font-medium ${trendColor(r.macdState)}`}>{labels.macdState(r.macdState)}</td>
      <td className="px-3 py-3 font-mono text-silver/70">{fmt(r.adx)}</td>
      <td className="px-3 py-3 font-mono text-silver/70">{fmt(r.atr, 2)}</td>
      <td className={`px-3 py-3 font-medium ${trendColor(r.structure)}`}>{labels.trend(r.structure)}</td>
      <td className="px-3 py-3">
        <SignalBadge label={r.signal} text={labels.recommendation(r.signal)} />
      </td>
      <td className="px-3 py-3 font-mono text-silver/70">{r.confidence}%</td>
    </tr>
  );
}
