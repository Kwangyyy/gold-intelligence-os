"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { MarketSnapshot } from "@/lib/types";
import { LiveDot, SignalBadge, recoTone } from "./shared";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Hero({ data, lang }: { data: MarketSnapshot | null; lang: string }) {
  const { t, recommendation } = useI18n();
  const up = (data?.change ?? 0) >= 0;
  const live = data?.isLive ?? false;
  const updated = data ? new Date(data.timestamp).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US") : "—";
  const tone = data ? recoTone(data.recommendation.label) : null;

  return (
    <section className="hero-surface relative overflow-hidden rounded-3xl border border-royal/25 px-6 py-7 shadow-royalglow sm:px-9 sm:py-9">
      {/* decorative ring */}
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-royal/20 opacity-60" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full border border-gold/20 opacity-50" />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-royal/30 bg-royal/10 px-3 py-1 text-[11px] font-medium text-royal-soft">
          ✦ EA Profit Lab · AI Trading Intelligence
        </span>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gradient-royal sm:text-4xl">
          {t("appTitle")}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-silver/60">{t("appSubtitle")}</p>

        {/* live snapshot row */}
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <div className="stat-label">{t("cardPrice")} · XAUUSD</div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold text-gradient-gold">
                {data ? fmt(data.price) : "—"}
              </span>
              {data && (
                <span className={`text-sm font-semibold ${up ? "text-bull" : "text-bear"}`}>
                  {up ? "+" : ""}
                  {data.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-silver/45">
              <LiveDot live={live} />
              <span className={live ? "text-bull" : "text-warn"}>{live ? t("live") : t("delayed")}</span>
              <span>· {t("lastUpdated")} {updated}</span>
            </div>
          </div>

          {data && (
            <div className="h-12 w-px bg-base-border/70" />
          )}

          {data && (
            <div>
              <div className="stat-label mb-1">{t("cardRecommendation")}</div>
              <div className="flex items-center gap-2">
                <SignalBadge label={data.recommendation.label} text={recommendation(data.recommendation.label)} />
                <span className={`font-mono text-lg font-bold ${tone?.text}`}>{data.recommendation.confidence}%</span>
              </div>
            </div>
          )}

          {data && (
            <div>
              <div className="stat-label mb-1">{t("cardScore")}</div>
              <div className="font-mono text-2xl font-bold text-neon">{data.marketScore}<span className="text-sm text-silver/40">/100</span></div>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/chart"
            className="rounded-xl bg-gradient-to-r from-gold to-gold-deep px-5 py-2.5 text-sm font-semibold text-base-black shadow-goldglow transition-transform hover:scale-[1.02]"
          >
            📈 {t("navChart")}
          </Link>
          <Link
            href="/chat"
            className="rounded-xl border border-royal/40 bg-royal/15 px-5 py-2.5 text-sm font-semibold text-royal-soft transition-colors hover:bg-royal/25"
          >
            🤖 {t("navChat")}
          </Link>
          <Link
            href="/plan"
            className="rounded-xl border border-base-border bg-base-panel/70 px-5 py-2.5 text-sm font-semibold text-silver/80 transition-colors hover:text-silver"
          >
            🎯 {t("navPlan")}
          </Link>
        </div>
      </div>
    </section>
  );
}
