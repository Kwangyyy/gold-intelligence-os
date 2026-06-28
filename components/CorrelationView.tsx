"use client";

import { useI18n } from "@/lib/i18n";
import type { CorrelationInstrument, IntermarketCorrelation } from "@/lib/types";
import { Card, ScoreRing } from "./shared";

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// Correlation bar from -1 (left/red) to +1 (right/green), centered at 0.
function CorrBar({ corr }: { corr: number }) {
  const half = Math.min(Math.abs(corr), 1) * 50;
  const positive = corr >= 0;
  return (
    <div className="relative h-2 w-full rounded-full bg-base-border">
      <div className="absolute left-1/2 top-0 h-full w-px bg-silver/30" />
      <div
        className={`absolute top-0 h-full rounded-full ${positive ? "bg-bull" : "bg-bear"}`}
        style={positive ? { left: "50%", width: `${half}%` } : { right: "50%", width: `${half}%` }}
      />
    </div>
  );
}

export function CorrelationScore({ data }: { data: IntermarketCorrelation }) {
  const { t } = useI18n();
  const biasTone =
    data.netBias === "supportive" ? "text-bull" : data.netBias === "pressure" ? "text-bear" : "text-silver/60";
  const biasLabel = data.netBias === "supportive" ? t("supportive") : data.netBias === "pressure" ? t("pressure_") : t("neutralImpact");
  return (
    <Card accent="neon">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center gap-1 sm:w-44">
          <span className="stat-label">{t("goldSupportScore")}</span>
          <ScoreRing score={data.goldSupportScore} />
          <span className={`text-sm font-semibold ${biasTone}`}>{biasLabel}</span>
        </div>
        <div className="flex-1 text-sm text-silver/70">
          <div className="mb-2">
            {t("goldVs")}:{" "}
            <span className={`font-mono font-semibold ${data.goldChangePct >= 0 ? "text-bull" : "text-bear"}`}>
              {pct(data.goldChangePct)}
            </span>
          </div>
          <p className="leading-relaxed text-silver/60">
            {data.netBias === "supportive"
              ? "Intermarket flows are net supportive for gold right now."
              : data.netBias === "pressure"
                ? "Intermarket flows are net pressuring gold right now."
                : "Intermarket flows are mixed / balanced for gold."}
          </p>
        </div>
      </div>
    </Card>
  );
}

function FactorList({ title, items, tone }: { title: string; items: CorrelationInstrument[]; tone: "bull" | "bear" }) {
  const { t, instrument2 } = useI18n();
  const color = tone === "bull" ? "text-bull" : "text-bear";
  return (
    <Card className="p-0">
      <div className={`border-b border-base-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${color}`}>
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-silver/40">—</div>
      ) : (
        <ul className="divide-y divide-base-border/40">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium text-silver">{instrument2(i.key)}</span>
              <span className="ml-auto font-mono text-xs text-silver/50">
                corr {i.correlation} · {pct(i.changePct)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CorrelationFactors({ data }: { data: IntermarketCorrelation }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FactorList title={t("supportiveFactors")} items={data.supportive} tone="bull" />
      <FactorList title={t("pressureFactors")} items={data.pressure} tone="bear" />
    </div>
  );
}

export function CorrelationTable({ data }: { data: IntermarketCorrelation }) {
  const { t, instrument2 } = useI18n();
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-base-border text-left">
            <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver/50">{t("instrumentCol")}</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-silver/50">{t("changeCol")}</th>
            <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver/50">{t("correlationCol")}</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-silver/50">corr</th>
          </tr>
        </thead>
        <tbody>
          {data.instruments.map((i) => (
            <tr key={i.key} className={`border-b border-base-border/40 ${!i.available ? "opacity-40" : ""}`}>
              <td className="px-3 py-2.5 font-medium text-silver">{instrument2(i.key)}</td>
              <td className={`px-3 py-2.5 text-right font-mono ${i.changePct >= 0 ? "text-bull" : "text-bear"}`}>
                {i.available ? pct(i.changePct) : "—"}
              </td>
              <td className="px-3 py-2.5">
                <div className="w-32">{i.available ? <CorrBar corr={i.correlation} /> : null}</div>
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-silver/70">{i.available ? i.correlation : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function DivergenceAlerts({ data }: { data: IntermarketCorrelation }) {
  const { t, tb, instrument2 } = useI18n();
  return (
    <Card accent={data.divergences.length ? "gold" : "none"}>
      <div className="stat-label mb-2">⚠ {t("divergenceAlert")}</div>
      {data.divergences.length === 0 ? (
        <p className="text-sm text-silver/50">{t("noDivergence")}</p>
      ) : (
        <ul className="space-y-2">
          {data.divergences.map((d, i) => (
            <li key={i} className="text-sm text-silver/75">
              <span className="font-semibold text-gold">{instrument2(d.key)}</span> — {tb(d.note)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
