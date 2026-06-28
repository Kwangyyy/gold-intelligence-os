"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { TechnicalScore, TimeframeCode } from "@/lib/types";
import { LiveDot } from "@/components/shared";
import { IndicatorGrid, TechnicalSummary } from "@/components/TechnicalView";
import { Disclaimer } from "@/components/Disclaimer";
import { BeginnerHint } from "@/components/BeginnerHint";
import { PageHeader } from "@/components/PageHeader";

const POLL_MS = 30_000;
const TIMEFRAMES: TimeframeCode[] = ["M15", "M30", "H1", "H4", "D1", "W1"];

export default function IndicatorsPage() {
  const { t, lang } = useI18n();
  const [tf, setTf] = useState<TimeframeCode>("H1");
  const [data, setData] = useState<TechnicalScore | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (timeframe: TimeframeCode) => {
    try {
      const res = await fetch(`/api/technical/score?tf=${timeframe}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.error) throw new Error();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(tf);
    timer.current = setInterval(() => load(tf), POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [tf, load]);

  const updated = data
    ? new Date(data.timestamp).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US")
    : "—";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("techTitle")}
        subtitle={t("techSubtitle")}
        right={
          <div className="flex items-center gap-2 rounded-lg border border-base-border bg-base-panel px-3 py-1.5 text-xs">
            <LiveDot live={!!data && !error} />
            <span className="text-silver/50">
              {data ? `${data.symbol} · ${data.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""} · {t("lastUpdated")} {updated}
            </span>
          </div>
        }
      />

      <div className="mt-5" />
      <BeginnerHint hintKey="hintIndicators" />

      {/* Timeframe selector */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-base-border bg-base-panel p-1">
        {TIMEFRAMES.map((code) => (
          <button
            key={code}
            onClick={() => setTf(code)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              tf === code ? "bg-neon/20 text-neon" : "text-silver/60 hover:text-silver"
            }`}
          >
            {code}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center text-silver/50">
          {error ? `⚠ ${t("techError")}` : t("loadingTech")}
        </div>
      ) : data ? (
        <div className={`mt-6 space-y-6 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
          <TechnicalSummary data={data} />
          <IndicatorGrid data={data} />
          <Disclaimer />
          <p className="pb-6 text-center text-[11px] text-silver/35">{t("sourceNote")}</p>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center text-silver/50">⚠ {t("techError")}</div>
      )}
    </main>
  );
}
