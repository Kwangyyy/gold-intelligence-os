"use client";

import { useI18n } from "@/lib/i18n";

export function Disclaimer() {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-warn/25 bg-warn/5 p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-warn">
        ⚠ {t("disclaimerTitle")}
      </div>
      <p className="text-xs leading-relaxed text-silver/60">{t("disclaimerBody")}</p>
    </div>
  );
}
