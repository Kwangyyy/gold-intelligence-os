"use client";

import { useMode, type Mode } from "@/lib/mode";
import { useI18n } from "@/lib/i18n";

export function ModeToggle() {
  const { mode, setMode } = useMode();
  const { t } = useI18n();
  const opts: { code: Mode; label: string }[] = [
    { code: "beginner", label: t("modeBeginner") },
    { code: "pro", label: t("modePro") },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-base-border bg-base-panel">
      {opts.map((o) => (
        <button
          key={o.code}
          onClick={() => setMode(o.code)}
          aria-pressed={mode === o.code}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mode === o.code ? "bg-gold/20 text-gold" : "text-silver/60 hover:text-silver"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
