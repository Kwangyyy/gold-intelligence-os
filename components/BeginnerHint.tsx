"use client";

import { useMode } from "@/lib/mode";
import { useI18n } from "@/lib/i18n";

// Shows a one-line plain-language explainer only when Beginner mode is on.
export function BeginnerHint({ hintKey }: { hintKey: string }) {
  const { isBeginner } = useMode();
  const { t } = useI18n();
  if (!isBeginner) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/5 px-4 py-2.5 text-sm text-silver/80">
      <span className="mt-0.5">💡</span>
      <span>{t(hintKey as never)}</span>
    </div>
  );
}
