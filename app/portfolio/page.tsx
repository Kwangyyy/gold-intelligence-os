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

interface AccountTab { id: string; label: string; connected: boolean; }

export default function PortfolioPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState(false);
  const [accounts, setAccounts] = useState<AccountTab[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (id: string | null) => {
    try {
      const qs = id ? `?account=${id}` : "";
      const res = await fetch(`/api/portfolio${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json() as PortfolioData);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // Load the user's linked accounts once (for the switcher tabs)
  useEffect(() => {
    fetch("/api/mt5/accounts", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j?.accounts) return;
        const tabs: AccountTab[] = j.accounts.map((a: { id: string; label: string; connected: boolean }) => ({ id: a.id, label: a.label, connected: a.connected }));
        setAccounts(tabs);
        setAccountId(prev => prev ?? tabs[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load(accountId);
    timer.current = setInterval(() => load(accountId), 15_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load, accountId]);

  const updated = data ? new Date(data.timestamp).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US") : "—";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("pfTitle")}
        subtitle={t("pfSubtitle")}
        right={<span className="text-xs text-silver/50">{t("lastUpdated")} {updated}</span>}
      />

      {/* Account switcher (multi-account) */}
      {accounts.length > 1 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-silver/35">พอร์ต</span>
          <div className="flex gap-1 rounded-xl p-1 flex-wrap" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {accounts.map(a => {
              const active = a.id === accountId;
              return (
                <button
                  key={a.id}
                  onClick={() => setAccountId(a.id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all"
                  style={active
                    ? { background: "linear-gradient(90deg, rgba(168,85,247,0.3), rgba(245,196,81,0.12))", color: "#f5c451", boxShadow: "inset 0 0 0 1px rgba(245,196,81,0.3)" }
                    : { color: "rgba(175,185,215,0.5)" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.connected ? "#34d399" : "#475569" }} />
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
                  href="/mt5"
                  className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold hover:bg-gold/20 transition-colors"
                >
                  🔌 จัดการพอร์ต MT5
                </a>
              </div>
              <p>1. ไปหน้า <span className="font-mono text-gold/80">MT5 Bridge</span> → กด &ldquo;+ เพิ่มพอร์ต&rdquo; ตั้งชื่อ → ระบบสร้าง token เฉพาะพอร์ตนั้น</p>
              <p>2. กด &ldquo;⬇ EA&rdquo; ของพอร์ตนั้น — ไฟล์ .mq5 จะฝัง token ให้อัตโนมัติ</p>
              <p>3. ใน MT5 → Tools → Options → Expert Advisors → เปิด &ldquo;Allow WebRequest&rdquo; และเพิ่ม URL: <span className="font-mono text-gold/80">{typeof window !== "undefined" ? window.location.origin : "http://localhost:3100"}/api/mt5/push</span></p>
              <p>4. วาง .mq5 ใน MQL5\Experts → กด F7 Compile → ลาก EA ลงชาร์ต</p>
              <p>5. EA จะ push ข้อมูลทุก 15 วินาที — หน้านี้อัพเดตอัตโนมัติ · หลายพอร์ตเลือกดูได้จากแท็บด้านบน</p>
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
