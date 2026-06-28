"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { MarketSnapshot, TradePlan } from "@/lib/types";
import { buildContent, type Tone } from "@/lib/content";
import { Card } from "@/components/shared";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";

function Skeleton() {
  return (
    <div className="space-y-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="panel animate-pulse p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-3 w-32 rounded bg-base-border/60" />
            <div className="h-7 w-20 rounded-lg bg-base-border/40" />
          </div>
          <div className="space-y-2">
            <div className="h-3 rounded bg-base-border/40" />
            <div className="h-3 w-4/5 rounded bg-base-border/40" />
            <div className="h-3 w-3/5 rounded bg-base-border/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContentPage() {
  const { t, lang } = useI18n();
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [plan, setPlan] = useState<TradePlan | null>(null);
  const [tone, setTone] = useState<Tone>("professional");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [m, p] = await Promise.all([
        fetch("/api/market/xauusd", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/plan", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      setMarket(m);
      setPlan(p && !p.error ? p : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const content = useMemo(
    () => (market ? buildContent(market, plan, lang, tone) : null),
    [market, plan, lang, tone]
  );

  const tones: { code: Tone; label: string }[] = [
    { code: "professional", label: t("ctToneProfessional") },
    { code: "friendly", label: t("ctToneFriendly") },
    { code: "trendy", label: t("ctToneTrendy") },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("contentTitle")}
        subtitle={t("contentSubtitle")}
        right={
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-base-border bg-base-panel px-3 py-1.5 text-xs text-silver/70 hover:text-silver disabled:opacity-50"
          >
            {loading ? "…" : `↻ ${t("ctRefresh")}`}
          </button>
        }
      />

      {/* Tone selector */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="stat-label">{t("ctTone")}:</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-base-border">
          {tones.map((to) => (
            <button
              key={to.code}
              onClick={() => setTone(to.code)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                tone === to.code ? "bg-gold/20 text-gold" : "text-silver/55 hover:text-silver"
              }`}
            >
              {to.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-red-400">{t("loadingError")}</p>
          <button
            onClick={load}
            className="rounded-lg bg-neon/20 px-5 py-2 text-sm font-medium text-neon hover:bg-neon/30"
          >
            ↻ {t("ctRefresh")}
          </button>
        </div>
      ) : !content ? (
        <div className="flex h-48 items-center justify-center text-silver/50">{t("loadingContent")}</div>
      ) : (
        <div className="space-y-5">
          <CopyCard title={t("ctBrief")} text={content.brief} mono />
          <CopyCard title={t("ctCaption")} text={content.caption} />
          <CopyCard title={t("ctHashtags")} text={content.hashtags} />
          <Disclaimer />
        </div>
      )}
    </main>
  );
}

function CopyCard({ title, text, mono }: { title: string; text: string; mono?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gold/80">{title}</span>
        <button
          onClick={copy}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
            copied ? "border-bull/40 bg-bull/15 text-bull" : "border-royal/40 bg-royal/10 text-royal-soft hover:bg-royal/20"
          }`}
        >
          {copied ? t("ctCopied") : `⧉ ${t("ctCopy")}`}
        </button>
      </div>
      <pre className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-silver/85 ${mono ? "font-sans" : ""}`}>
        {text}
      </pre>
    </Card>
  );
}
