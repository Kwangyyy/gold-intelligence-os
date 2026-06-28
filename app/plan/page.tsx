"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { TradePlan } from "@/lib/types";
import { Card, SignalBadge, recoTone } from "@/components/shared";
import { Disclaimer } from "@/components/Disclaimer";
import { BeginnerHint } from "@/components/BeginnerHint";
import { PageHeader } from "@/components/PageHeader";
import { computeRisk } from "@/lib/risk";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD_PER_DOLLAR_PER_LOT = 100;

export default function PlanPage() {
  const { t, tb, recommendation, lang } = useI18n();
  const [plan, setPlan] = useState<TradePlan | null>(null);
  const [error, setError] = useState(false);
  const [balance, setBalance] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/plan", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.error) throw new Error();
      setPlan(json);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 60_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const sizing = useMemo(() => {
    if (!plan || plan.direction === "none" || !plan.entryZone || plan.stopLoss == null) return null;
    const entryMid = (plan.entryZone.low + plan.entryZone.high) / 2;
    const r = computeRisk({
      balance,
      riskPct,
      leverage: 100,
      entry: entryMid,
      stopLoss: plan.stopLoss,
      direction: plan.direction === "long" ? "buy" : "sell",
    });
    const rewards = plan.takeProfits.map((tp) => +(r.lots * USD_PER_DOLLAR_PER_LOT * Math.abs(tp - entryMid)).toFixed(2));
    return { entryMid, ...r, rewards };
  }, [plan, balance, riskPct]);

  const updated = plan ? new Date(plan.timestamp).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US") : "—";

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("planTitle")}
        subtitle={t("planSubtitle")}
        right={<span className="text-xs text-silver/50">{t("lastUpdated")} {updated}</span>}
      />

      <BeginnerHint hintKey="hintPlan" />

      {!plan ? (
        <div className="flex h-64 items-center justify-center text-silver/50">
          {error ? `⚠ ${t("planError")}` : t("loadingPlan")}
        </div>
      ) : plan.direction === "none" ? (
        <Card accent="gold">
          <div className="mb-2 flex items-center gap-2">
            <SignalBadge label={plan.bias} text={recommendation(plan.bias)} />
            <span className="text-sm font-semibold text-silver/70">{t("planNoTrade")}</span>
          </div>
          <p className="text-sm leading-relaxed text-silver/75">{tb(plan.reason)}</p>
          <p className="mt-3 text-sm text-silver/60">{tb(plan.alternative)}</p>
          <div className="mt-4"><Disclaimer /></div>
        </Card>
      ) : (
        <div className="space-y-6">
          {plan.newsWarning && (
            <div className="rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm font-medium text-warn">
              {t("planNewsWarn")}
            </div>
          )}

          <Card accent="neon">
            <div className="flex flex-wrap items-center gap-3">
              <SignalBadge label={plan.bias} text={recommendation(plan.bias)} />
              <span className={`text-sm font-bold ${plan.direction === "long" ? "text-bull" : "text-bear"}`}>
                {plan.direction === "long" ? "▲ " + t("planLong") : "▼ " + t("planShort")}
              </span>
              <span className="text-sm text-silver/50">
                {t("confidence")} <span className="font-mono text-silver/80">{plan.confidence}%</span>
              </span>
              {plan.riskReward != null && (
                <span className="ml-auto rounded-lg border border-neon/40 bg-neon/10 px-3 py-1 text-sm font-semibold text-neon">
                  {t("planRR")} 1:{plan.riskReward}
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Box label={t("planEntryZone")} value={plan.entryZone ? `${money(plan.entryZone.low)} – ${money(plan.entryZone.high)}` : "—"} tone="text-gold" />
              <Box label={t("planStopLoss")} value={plan.stopLoss != null ? money(plan.stopLoss) : "—"} tone="text-bear" />
              <Box label={t("planInvalidation")} value={plan.invalidation != null ? money(plan.invalidation) : "—"} tone="text-bear" />
            </div>

            <div className="mt-3">
              <div className="stat-label mb-1">{t("planTargets")}</div>
              <div className="grid grid-cols-3 gap-2">
                {plan.takeProfits.map((tp, i) => (
                  <div key={i} className="rounded-lg border border-bull/30 bg-bull/5 p-2 text-center">
                    <div className="text-[11px] text-silver/50">TP{i + 1}</div>
                    <div className="font-mono text-sm text-bull">{money(tp)}</div>
                    {sizing && <div className="text-[10px] text-silver/40">+${money(sizing.rewards[i])}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neon">{t("planReasons")}</span>
                <p className="text-silver/75">{tb(plan.reason)}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-warn">{t("planAlternative")}</span>
                <p className="text-silver/70">{tb(plan.alternative)}</p>
              </div>
            </div>
          </Card>

          {/* Position sizing */}
          <Card>
            <div className="stat-label mb-3">{t("planSizing")}</div>
            <div className="flex flex-wrap items-end gap-4">
              <Num label={t("rmBalance")} value={balance} onChange={setBalance} step={100} />
              <Num label={t("rmRiskPct")} value={riskPct} onChange={setRiskPct} step={0.25} />
              {sizing && (
                <>
                  <div className="rounded-lg border border-neon/40 bg-neon/10 px-4 py-2 text-center">
                    <div className="stat-label">{t("planLots")}</div>
                    <div className="font-mono text-2xl font-bold text-neon">{sizing.lots.toFixed(2)}</div>
                  </div>
                  <div className="text-xs text-silver/50">
                    {t("rmRiskAmount")}: <span className="font-mono text-silver/80">${money(sizing.riskAmount)}</span><br />
                    {t("rmMargin")}: <span className="font-mono text-silver/80">${money(sizing.margin)}</span>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Disclaimer />
        </div>
      )}
    </main>
  );
}

function Box({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-base-border/60 bg-base-panel/50 p-3">
      <div className="stat-label">{label}</div>
      <div className={`mt-1 font-mono text-base font-semibold ${tone ?? "text-silver"}`}>{value}</div>
    </div>
  );
}

function Num({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div>
      <label className="stat-label mb-1 block">{label}</label>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-32 rounded-lg border border-base-border bg-base-panel px-3 py-2 font-mono text-sm text-silver outline-none focus:border-neon/50"
      />
    </div>
  );
}
