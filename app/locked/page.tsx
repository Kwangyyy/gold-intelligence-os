"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { AuthButton } from "@/components/AuthButton";
import type { Tier } from "@/lib/tierConfig";

const TIER_KEY: Record<Tier, "tierFree" | "tierPremium" | "tierPro"> = {
  free: "tierFree", premium: "tierPremium", pro: "tierPro",
};

export default function LockedPage() {
  return (
    <Suspense fallback={null}>
      <LockedContent />
    </Suspense>
  );
}

function LockedContent() {
  const { t } = useI18n();
  const { status } = useSession();
  const params = useSearchParams();
  const need = (params.get("need") as Tier) || "premium";
  const reqLabel = t(TIER_KEY[need] ?? "tierPremium");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-4 text-5xl">🔒</div>
      <h1 className="text-xl font-bold text-silver">{t("lockedTitle")}</h1>
      <p className="mt-2 text-sm text-silver/60">
        {status !== "authenticated" ? t("lockedNeedLogin") : t("lockedBody")}
        {status === "authenticated" && (
          <span className="block mt-1">
            {t("upgradeTo")} <b className="text-gold">{reqLabel}</b>
          </span>
        )}
      </p>

      {status !== "authenticated" && (
        <div className="mt-6 w-56">
          <AuthButton />
        </div>
      )}

      <p className="mt-6 max-w-sm text-[11px] italic text-silver/35">{t("lockedNoSelfServe")}</p>
    </main>
  );
}
