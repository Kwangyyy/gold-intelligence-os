"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { PortfolioSnapshot } from "@/lib/types";

type PortfolioData = PortfolioSnapshot & {
  mt5Connected: boolean;
  mt5LastSync: number | null;
  mt5Server?: string;
  mt5Account?: string;
};
import { Card } from "@/components/shared";
import {
  EaCards,
  EquityCurve,
  PortfolioHealth,
  PortfolioSummary,
  PositionsTable,
} from "@/components/PortfolioView";
import { PageHeader } from "@/components/PageHeader";

export default function PortfolioPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json() as PortfolioData);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const updated = data ? new Date(data.timestamp).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US") : "—";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("pfTitle")}
        subtitle={t("pfSubtitle")}
        right={<span className="text-xs text-silver/50">{t("lastUpdated")} {updated}</span>}
      />

      {/* MT5 Connection status */}
      {data ? (
        data.mt5Connected ? (
          <div className="mb-5 rounded-xl border border-bull/40 bg-bull/10 px-4 py-3 flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-bull live-dot shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-bull">{t("pfMT5Connected")}</div>
              <div className="text-[11px] text-silver/50 mt-0.5">
                {data.mt5Server && <span>Server: <span className="font-mono text-silver/70">{data.mt5Server}</span> · </span>}
                {data.mt5Account && <span>Account: <span className="font-mono text-silver/70">{data.mt5Account}</span> · </span>}
                {data.mt5LastSync && <span>{t("pfMT5LastSync")}: {new Date(data.mt5LastSync).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US")}</span>}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-xs font-medium text-warn flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-warn shrink-0" />
              <span>{t("pfMT5Disconnected")} — {t("pfDemo")}</span>
            </div>
            <div className="mb-5 rounded-xl border border-base-border/50 bg-base-panel/40 px-4 py-3 text-[11px] text-silver/50 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-silver/70">{t("pfMT5HowTo")}</div>
                <a
                  href="/api/mt5/ea"
                  download="GoldIntelligenceOS_Bridge.mq5"
                  className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold hover:bg-gold/20 transition-colors"
                >
                  ⬇ Download EA (.mq5)
                </a>
              </div>
              <p>1. เปิด MetaTrader 5 → Tools → Options → Expert Advisors → เปิด &ldquo;Allow WebRequest&rdquo;</p>
              <p>2. เพิ่ม URL: <span className="font-mono text-gold/80">{typeof window !== "undefined" ? window.location.origin : "http://localhost:3100"}/api/mt5/push</span></p>
              <p>3. Download EA ด้านบน → วางใน MQL5\Experts → กด F7 เพื่อ Compile</p>
              <p>4. ตั้งค่า API Key = <span className="font-mono text-gold/80">mt5-bridge-key</span> (หรือค่าจาก .env.local MT5_API_KEY)</p>
              <p>5. EA จะ push ข้อมูลทุก 15 วินาที — หน้านี้อัพเดตอัตโนมัติ</p>
              <div className="mt-2 font-mono text-[10px] bg-base-black/60 rounded p-2 border border-base-border/30 text-silver/40">
                {`POST /api/mt5/push  ·  Authorization: Bearer <MT5_API_KEY>\n{ "balance":10000, "equity":10250, "positions":[...] }`}
              </div>
            </div>
          </>
        )
      ) : (
        <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-xs font-medium text-warn">
          {t("pfDemo")}
        </div>
      )}

      {!data ? (
        <div className="flex h-64 items-center justify-center text-silver/50">
          {error ? "⚠ " : ""}
          {t("loadingPf")}
        </div>
      ) : (
        <div className="space-y-6">
          <PortfolioSummary data={data} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <div className="stat-label mb-2">{t("pfEquityCurve")}</div>
                <EquityCurve points={data.equityCurve} />
              </Card>
            </div>
            <PortfolioHealth data={data} />
          </div>

          <PositionsTable data={data} />

          <div>
            <div className="stat-label mb-3">{t("pfEAs")}</div>
            <EaCards data={data} />
          </div>
        </div>
      )}
    </main>
  );
}
