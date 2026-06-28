"use client";

import { useI18n } from "@/lib/i18n";
import { GoldChart } from "@/components/GoldChart";
import { BeginnerHint } from "@/components/BeginnerHint";
import { Disclaimer } from "@/components/Disclaimer";
import { PageHeader } from "@/components/PageHeader";

export default function ChartPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title={t("chartTitle")} subtitle={t("chartSubtitle")} />

      <BeginnerHint hintKey="hintChart" />
      <GoldChart />

      <p className="mt-3 text-center text-[11px] text-silver/35">{t("chartSource")}</p>
      <div className="mt-6">
        <Disclaimer />
      </div>
    </main>
  );
}
