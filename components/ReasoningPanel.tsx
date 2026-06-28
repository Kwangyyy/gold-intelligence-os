"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { AiRecommendation } from "@/lib/types";
import { Card, RiskMeter, SignalBadge, recoTone } from "./shared";

// Full PRD §12 AI output: Recommendation, Confidence, Risk, Main Reasons,
// Opposite Risk, Invalidation, Suggested Action, Disclaimer.
export function ReasoningPanel({
  r,
  aiSource,
}: {
  r: AiRecommendation;
  aiSource: "gemini" | "fallback";
}) {
  const { t, tb, recommendation, risk } = useI18n();
  const [open, setOpen] = useState(true);
  const tone = recoTone(r.label);

  return (
    <Card accent="neon">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="stat-label">{t("aiReasoning")}</span>
          <AiBadge aiSource={aiSource} label={aiSource === "gemini" ? t("poweredByGemini") : t("ruleBasedFallback")} />
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-base-border px-2 py-1 text-xs text-silver/70 hover:text-silver"
        >
          {open ? t("hideReasoning") : t("showReasoning")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SignalBadge label={r.label} text={recommendation(r.label)} />
        <div className="text-sm">
          <span className="text-silver/50">{t("confidence")}: </span>
          <span className={`font-mono font-bold ${tone.text}`}>{r.confidence}%</span>
        </div>
        <div className="min-w-[140px] flex-1">
          <RiskMeter level={r.riskLevel} label={`${t("riskLevel")}: ${risk(r.riskLevel)}`} />
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 text-sm">
          <Section title={t("mainReasons")}>
            <ul className="list-disc space-y-1 pl-5 text-silver/80">
              {r.mainReasons.map((reason, i) => (
                <li key={i}>{tb(reason)}</li>
              ))}
            </ul>
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Section title={t("oppositeRisk")} tone="warn">
              <p className="text-silver/80">{tb(r.oppositeRisk)}</p>
            </Section>
            <Section title={t("invalidation")} tone="bear">
              <p className="text-silver/80">{tb(r.invalidation)}</p>
            </Section>
          </div>

          <Section title={t("suggestedAction")} tone="bull">
            <p className="text-silver/90">{tb(r.suggestedAction)}</p>
          </Section>

          <p className="border-t border-base-border pt-3 text-[11px] italic text-silver/45">
            {tb(r.disclaimer)}
          </p>
        </div>
      )}
    </Card>
  );
}

function AiBadge({ aiSource, label }: { aiSource: "gemini" | "fallback"; label: string }) {
  const live = aiSource === "gemini";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        live
          ? "border-neon/40 bg-neon/10 text-neon"
          : "border-warn/40 bg-warn/10 text-warn"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-neon" : "bg-warn"}`} />
      {label}
    </span>
  );
}

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "warn" | "bear" | "bull";
}) {
  const color =
    tone === "warn"
      ? "text-warn"
      : tone === "bear"
        ? "text-bear"
        : tone === "bull"
          ? "text-bull"
          : "text-neon";
  return (
    <div>
      <div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${color}`}>
        {title}
      </div>
      {children}
    </div>
  );
}
