"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface VaultEntry {
  week: string;
  registered: number;
  eligible: number;
  total: number;
  coverage: number;
}

interface KeyLevel {
  level: number;
  label: string;
  note: string;
}

interface ComexVaultData {
  registeredTonnes: number;
  eligibleTonnes: number;
  totalTonnes: number;
  coverageRatio: number;
  weeklyChange: number;
  trend: "draining" | "stable" | "building";
  signal: "bullish" | "neutral" | "bearish";
  goldImplication: string;
  history: VaultEntry[];
  keyLevels: KeyLevel[];
  insight: string;
  timestamp: string;
}

const TREND_META = {
  draining: { label: "Draining",  color: "#34d399", icon: "⬇",  desc: "Bullish — physical leaving vaults" },
  stable:   { label: "Stable",    color: "#f5c451", icon: "→",  desc: "Neutral — inventory in balance"   },
  building: { label: "Building",  color: "#f87171", icon: "⬆",  desc: "Bearish — physical entering vaults"},
};

const SIG_META = {
  bullish: { label: "Bullish",  color: "#34d399" },
  neutral: { label: "Neutral",  color: "#f5c451" },
  bearish: { label: "Bearish",  color: "#f87171" },
};

export default function ComexVaultPage() {
  const { t } = useI18n();
  const [data, setData] = useState<ComexVaultData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/comex-vault")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading COMEX vault data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const trend = TREND_META[data.trend];
  const sig = SIG_META[data.signal];
  const maxTotal = Math.max(...data.history.map(h => h.total));

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navComexVault")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          COMEX Gold Vault Inventory · Registered vs Eligible · Physical Drain Signal
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Registered",   value: `${data.registeredTonnes.toLocaleString()}t`, sub: "Deliverable",  color: "#34d399" },
          { label: "Eligible",     value: `${data.eligibleTonnes.toLocaleString()}t`,   sub: "Can Deliver",  color: "#60a5fa" },
          { label: "Total Vault",  value: `${data.totalTonnes.toLocaleString()}t`,       sub: "COMEX System", color: "#f5c451" },
          { label: "Coverage",     value: `${(data.coverageRatio * 100).toFixed(1)}%`,  sub: "vs Est. OI",   color: data.coverageRatio < 0.25 ? "#f87171" : "#86efac" },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{item.label}</div>
            <div className="text-xl font-black" style={{ color: item.color }}>{item.value}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Trend banner */}
      <div className="rounded-xl p-4" style={{ background: `${trend.color}0a`, border: `1px solid ${trend.color}30` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{trend.icon}</span>
            <div>
              <div className="text-sm font-bold" style={{ color: trend.color }}>Inventory {trend.label}</div>
              <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{trend.desc}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>Weekly Change</div>
            <div className="text-sm font-black" style={{ color: data.weeklyChange >= 0 ? "#f87171" : "#34d399" }}>
              {data.weeklyChange >= 0 ? "+" : ""}{data.weeklyChange}t
            </div>
          </div>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.goldImplication}</p>
        <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{data.insight}</p>
      </div>

      {/* 12-week inventory chart */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold mb-3" style={{ color: "rgba(175,185,215,0.5)" }}>12-WEEK VAULT INVENTORY</div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${data.history.length}, 1fr)` }}>
          {data.history.map((w, i) => {
            const isLast = i === data.history.length - 1;
            const regH = (w.registered / maxTotal) * 60;
            const eligH = (w.eligible / maxTotal) * 60;
            return (
              <div key={w.week} className="flex flex-col items-center gap-0.5">
                <div className="flex flex-col justify-end" style={{ height: "64px", width: "100%" }}>
                  <div className="w-full rounded-t-sm" style={{ height: `${eligH}px`, background: isLast ? "#60a5fa99" : "#60a5fa44" }} />
                  <div className="w-full" style={{ height: `${regH}px`, background: isLast ? "#34d399" : "#34d39999" }} />
                </div>
                <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)", writingMode: "vertical-rl", transform: "rotate(180deg)", height: "28px" }}>
                  {w.week}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
          <span><span style={{ color: "#34d399" }}>■</span> Registered (deliverable)</span>
          <span><span style={{ color: "#60a5fa99" }}>■</span> Eligible</span>
        </div>
      </div>

      {/* Key levels */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          REGISTERED INVENTORY REFERENCE LEVELS
        </div>
        {data.keyLevels.map((kl, i) => {
          const isCurrent = Math.abs(data.registeredTonnes - kl.level) < 60;
          const color = kl.level >= 800 ? "#34d399" : kl.level >= 400 ? "#f5c451" : kl.level >= 200 ? "#fb923c" : "#f87171";
          return (
            <div
              key={kl.level}
              className="flex gap-4 px-4 py-2.5"
              style={{
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                background: isCurrent ? "rgba(245,196,81,0.04)" : undefined,
              }}
            >
              <div className="w-16 shrink-0">
                <div className="text-sm font-black" style={{ color }}>{kl.level}t</div>
                {isCurrent && <div className="text-[7px]" style={{ color: "#f5c451" }}>◄ NOW</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>{kl.label}</div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{kl.note}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>REGISTERED vs ELIGIBLE</div>
        {[
          { icon: "📦", text: "Registered = warrants outstanding, physically allocated, ready for delivery. When this drains, shorts face squeeze risk." },
          { icon: "🏪", text: "Eligible = gold meeting COMEX spec in approved vaults but not yet registered. Must be 'converted' before delivery." },
          { icon: "📉", text: "Drain Signal: Registered falling while OI stays high = rising leverage ratio = squeeze potential building." },
          { icon: "🌐", text: "2024-2025 context: Unusual large drain from COMEX as gold physically moved to NYC from London on tariff/arbitrage fears." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Vault data modeled from COMEX CME Group warehouse reports · 1-hour cache · Not financial advice
      </p>
    </div>
  );
}
