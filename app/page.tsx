"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMode } from "@/lib/mode";
import type { MarketSnapshot } from "@/lib/types";
import { Card, SignalBadge, recoTone } from "@/components/shared";
import {
  PriceCard,
  RecommendationCard,
  ScoreCard,
  VolatilityCard,
  NewsRiskCard,
} from "@/components/HeroCards";
import { MarketStatsGrid, SessionClock } from "@/components/MarketStats";
import { ReasoningPanel } from "@/components/ReasoningPanel";
import { Disclaimer } from "@/components/Disclaimer";
import { ModuleHub } from "@/components/ModuleHub";
import { GoldChart } from "@/components/GoldChart";
import { Hero } from "@/components/Hero";

const POLL_MS = 10_000;

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { isBeginner } = useMode();
  const [data, setData] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market/xauusd", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Hero data={data} lang={lang} />

      {!data ? (
        <div className="mt-6 flex h-64 items-center justify-center text-silver/50">
          {error ? "⚠ " : ""}
          {t("loading")}
        </div>
      ) : isBeginner ? (
        /* --- Beginner: simplified, action-first view --- */
        <div className="mt-6 space-y-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PriceCard data={data} />
            <RecommendationCard data={data} />
            <NewsRiskCard data={data} />
          </section>

          <BeginnerActionCard data={data} />

          <GoldChart heightClass="h-[400px]" />

          <ModuleHub />

          <Disclaimer />
          <p className="pb-6 text-center text-[11px] text-silver/35">{t("sourceNote")}</p>
        </div>
      ) : (
        /* --- Pro: full view --- */
        <div className="mt-6 space-y-6">
          {/* 5 hero cards (PRD §1) */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <PriceCard data={data} />
            <RecommendationCard data={data} />
            <ScoreCard data={data} />
            <VolatilityCard data={data} />
            <NewsRiskCard data={data} />
          </section>

          {/* stats + session */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MarketStatsGrid data={data} />
            </div>
            <SessionClock data={data} />
          </section>

          {/* Live chart */}
          <GoldChart heightClass="h-[440px]" />

          {/* AI reasoning (full PRD §12 output) */}
          <ReasoningPanel r={data.recommendation} aiSource={data.aiSource} />

          <ModuleHub />

          <Disclaimer />

          <p className="pb-6 text-center text-[11px] text-silver/35">{t("sourceNote")}</p>
        </div>
      )}
    </main>
  );
}

function BeginnerActionCard({ data }: { data: MarketSnapshot }) {
  const { t, tb, recommendation, risk } = useI18n();
  const r = data.recommendation;
  const tone = recoTone(r.label);
  return (
    <Card accent="neon">
      <div className="stat-label mb-2">{t("beginnerWhatToDo")}</div>
      <div className="flex flex-wrap items-center gap-3">
        <SignalBadge label={r.label} text={recommendation(r.label)} />
        <span className={`font-mono text-2xl font-bold ${tone.text}`}>{r.confidence}%</span>
        <span className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-1 text-sm font-semibold text-warn">
          {t("beginnerRiskFirst")}: {risk(r.riskLevel)}
        </span>
      </div>
      <p className="mt-3 text-base leading-relaxed text-silver/90">👉 {tb(r.suggestedAction)}</p>
      <p className="mt-2 text-sm text-silver/55">{tb(r.oppositeRisk)}</p>
      <p className="mt-4 text-xs italic text-silver/40">{t("beginnerSeePro")}</p>
    </Card>
  );
}

