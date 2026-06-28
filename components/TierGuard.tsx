"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { canAccess, minTierFor, useTier, type Tier } from "@/lib/tier";

// Wraps page content. If the current tier can't access the route, shows an
// upgrade prompt instead of the page (front-end preview of plan gating).
export function TierGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tier, setTier } = useTier();
  const { t } = useI18n();

  if (canAccess(tier, pathname)) return <>{children}</>;

  const required = minTierFor(pathname);
  const reqLabel = required === "pro" ? t("tierPro") : required === "premium" ? t("tierPremium") : t("tierFree");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-4 text-5xl">🔒</div>
      <h1 className="text-xl font-bold text-silver">{t("lockedTitle")}</h1>
      <p className="mt-2 text-sm text-silver/60">{t("lockedBody")}</p>
      <button
        onClick={() => setTier(required as Tier)}
        className="mt-6 rounded-xl bg-gold/20 px-6 py-3 text-sm font-semibold text-gold transition-colors hover:bg-gold/30"
      >
        {t("upgradeTo")} {reqLabel}
      </button>
      <p className="mt-6 text-[11px] italic text-silver/35">{t("tierPreviewNote")}</p>
    </main>
  );
}
