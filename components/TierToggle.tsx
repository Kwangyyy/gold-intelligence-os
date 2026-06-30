"use client";

import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { useTier, type Tier } from "@/lib/tier";

const TIER_KEY: Record<Tier, "tierFree" | "tierPremium" | "tierPro"> = {
  free: "tierFree", premium: "tierPremium", pro: "tierPro",
};

// Read-only display of the signed-in account's plan. Tier is no longer
// self-assignable client-side — see lib/userTier.ts for how it's set.
export function TierToggle() {
  const { tier } = useTier();
  const { status } = useSession();
  const { t } = useI18n();

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg border border-base-border bg-base-panel px-2.5 py-1.5 text-xs font-medium text-silver/70"
      title={t("tierLabel")}
    >
      <span className="text-neon">{t(TIER_KEY[tier])}</span>
      {status !== "authenticated" && (
        <span className="text-[10px] text-silver/35">({t("tierLabel")})</span>
      )}
    </div>
  );
}
