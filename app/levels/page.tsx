"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { SupportResistance } from "@/lib/types";
import { LiveDot } from "@/components/shared";
import { KeyLevelCard, LevelsLadder } from "@/components/LevelsView";
import { Disclaimer } from "@/components/Disclaimer";
import { BeginnerHint } from "@/components/BeginnerHint";
import { PageHeader } from "@/components/PageHeader";

const POLL_MS = 60_000;

export default function LevelsPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<SupportResistance | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/technical/levels", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.error) throw new Error();
      setData(json);
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

  const updated = data
    ? new Date(data.timestamp).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US")
    : "—";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("srTitle")}
        subtitle={t("srSubtitle")}
        right={
          <div className="flex items-center gap-2 rounded-lg border border-base-border bg-base-panel px-3 py-1.5 text-xs">
            <LiveDot live={!!data && !error} />
            <span className="text-silver/50">{t("lastUpdated")} {updated}</span>
          </div>
        }
      />

      <div className="mt-5" />
      <BeginnerHint hintKey="hintLevels" />

      {!data ? (
        <div className="flex h-64 items-center justify-center text-silver/50">
          {error ? `⚠ ${t("srError")}` : t("loadingSr")}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <KeyLevelCard data={data} />
          <LevelsLadder data={data} />
          <Disclaimer />
          <p className="pb-6 text-center text-[11px] text-silver/35">{t("sourceNote")}</p>
        </div>
      )}
    </main>
  );
}
