"use client";

import { useI18n } from "@/lib/i18n";
import { useTier, type Tier } from "@/lib/tier";

export function TierToggle() {
  const { tier, setTier } = useTier();
  const { t } = useI18n();
  const opts: { code: Tier; label: string }[] = [
    { code: "free", label: t("tierFree") },
    { code: "premium", label: t("tierPremium") },
    { code: "pro", label: t("tierPro") },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-base-border bg-base-panel" title={t("tierLabel")}>
      {opts.map((o) => (
        <button
          key={o.code}
          onClick={() => setTier(o.code)}
          aria-pressed={tier === o.code}
          className={`px-2 py-1.5 text-xs font-medium transition-colors ${
            tier === o.code ? "bg-neon/20 text-neon" : "text-silver/55 hover:text-silver"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
