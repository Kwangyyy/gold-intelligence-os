"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { WeeklyBriefPayload } from "@/app/api/weekly-brief/route";

function LevelLadder({ levels, current }: {
  levels: WeeklyBriefPayload["keyLevels"];
  current: number;
}) {
  const prices = levels.map(l => l.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const range = max - min || 1;

  return (
    <div className="relative h-32">
      {levels.map((lvl) => {
        const pct = ((lvl.price - min) / range) * 80 + 10;
        return (
          <div key={lvl.label} className="absolute left-0 right-0 flex items-center gap-2"
            style={{ bottom: `${pct}%` }}>
            <div className="h-px flex-1 opacity-40" style={{ background: lvl.color }} />
            <span className="text-[9px] font-mono font-bold whitespace-nowrap"
              style={{ color: lvl.color }}>
              ${lvl.price.toLocaleString()}
            </span>
            <span className="text-[8px] whitespace-nowrap"
              style={{ color: "rgba(175,185,215,0.4)" }}>{lvl.labelTh}</span>
            {lvl.price === current && (
              <span className="text-[8px] rounded-full px-1.5 py-0.5 font-bold"
                style={{ background: lvl.color + "33", color: lvl.color }}>
                ◀ Now
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ section, isOpen, onToggle }: {
  section: WeeklyBriefPayload["sections"][number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <span className="text-lg">{section.icon}</span>
        <div className="flex-1">
          <div className="text-xs font-bold" style={{ color: "#f5c451" }}>{section.titleTh}</div>
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{section.title}</div>
        </div>
        <span className="text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </button>
      {isOpen && (
        <div className="px-5 pb-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: "rgba(175,185,215,0.8)" }}>
            {section.contentTh}
          </p>
          <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>
            {section.content}
          </p>
        </div>
      )}
    </div>
  );
}

export default function WeeklyBriefPage() {
  const [data, setData]       = useState<WeeklyBriefPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [open, setOpen]       = useState<Record<number, boolean>>({ 0: true });

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/weekly-brief", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (i: number) => setOpen(p => ({ ...p, [i]: !p[i] }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="📰 Weekly Gold Brief"
        subtitle="สรุปภาพรวมทองรายสัปดาห์ — ผลตอบแทน, ปัจจัยขับเคลื่อน, และมุมมองสัปดาห์หน้า"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📰 กำลังสรุปข้อมูลสัปดาห์…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero banner */}
          <div className="panel px-5 py-5" style={{ borderLeft: `4px solid ${data.biasColor}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] uppercase tracking-widest mb-1"
                  style={{ color: "rgba(175,185,215,0.3)" }}>
                  {data.weekLabelTh}
                </div>
                <div className="text-2xl font-black mb-1"
                  style={{ color: "#f5c451" }}>
                  ${data.goldPrice.toLocaleString()}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold" style={{ color: data.goldWeekReturn >= 0 ? "#34d399" : "#f87171" }}>
                    {data.goldWeekReturn >= 0 ? "+" : ""}{data.goldWeekReturn}% สัปดาห์
                  </span>
                  <span style={{ color: data.goldMonthReturn >= 0 ? "#34d399" : "#f87171" }}>
                    {data.goldMonthReturn >= 0 ? "+" : ""}{data.goldMonthReturn}% เดือน
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black px-3 py-1.5 rounded-xl mb-1"
                  style={{ background: data.biasColor + "22", color: data.biasColor, border: `1px solid ${data.biasColor}55` }}>
                  {data.tradingBias.toUpperCase()}
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                  {data.weekLabel}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-[10px]" style={{ borderColor: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.6)" }}>
              {data.tradingBiasTh}
            </div>
          </div>

          {/* Key levels */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-4"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              ระดับราคาสำคัญสัปดาห์นี้
            </div>
            <LevelLadder levels={data.keyLevels} current={data.goldPrice} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {data.keyLevels.map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>{l.labelTh}</span>
                  <span className="font-mono text-[9px] ml-auto font-bold" style={{ color: l.color }}>
                    ${l.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Analysis sections */}
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-widest px-1 mb-2"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              การวิเคราะห์เชิงลึก
            </div>
            {data.sections.map((s, i) => (
              <SectionCard key={i} section={s} isOpen={!!open[i]} onToggle={() => toggle(i)} />
            ))}
          </div>

          {/* Watchlist */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              สิ่งที่ต้องจับตาสัปดาห์หน้า
            </div>
            <ul className="space-y-2">
              {data.watchlistTh.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[10px]"
                  style={{ color: "rgba(175,185,215,0.7)" }}>
                  <span className="mt-0.5 text-[8px]" style={{ color: "#f5c451" }}>→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Disclaimer + refresh */}
          <div className="panel px-5 py-3" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <p className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              ⚠ Weekly Brief นี้สร้างจากข้อมูลราคาตลาดจริง ไม่ใช่คำแนะนำการลงทุน ใช้ประกอบการตัดสินใจของคุณเองเท่านั้น
            </p>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              สร้างเมื่อ {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
