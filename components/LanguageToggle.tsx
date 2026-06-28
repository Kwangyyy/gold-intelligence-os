"use client";

import { useI18n, type Lang } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const opts: { code: Lang; label: string }[] = [
    { code: "th", label: "ไทย" },
    { code: "en", label: "EN" },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-base-border bg-base-panel">
      {opts.map((o) => (
        <button
          key={o.code}
          onClick={() => setLang(o.code)}
          aria-pressed={lang === o.code}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            lang === o.code
              ? "bg-neon/20 text-neon"
              : "text-silver/60 hover:text-silver"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
