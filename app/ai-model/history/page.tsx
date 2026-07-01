"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { AiModelSignalEntry } from "@/app/api/ai-model/signal/route";

const LABEL_COLORS: Record<string, string> = {
  BUY:  "#34d399",
  SELL: "#f87171",
  HOLD: "#f5c451",
};

function tsStr(ms: number) {
  return new Date(ms).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function AccBar({ v, color }: { v: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="font-mono text-[11px]" style={{ color }}>{v.toFixed(1)}%</span>
    </div>
  );
}

export default function AiSignalHistoryPage() {
  const [entries,  setEntries]  = useState<AiModelSignalEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/ai-model/signal?limit=100", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setEntries(await r.json());
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Signal change events (highlight when decision changes)
  const changes = entries.map((e, i) => ({
    ...e,
    changed: i === entries.length - 1 || e.decision !== entries[i + 1]?.decision,
  }));

  // Stats
  const byDecision = entries.reduce((acc, e) => {
    acc[e.decision] = (acc[e.decision] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const avgAcc = entries.length ? entries.reduce((s, e) => s + e.testAcc, 0) / entries.length : 0;
  const latestSignal = entries[0] ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="AI Signal History 📜"
        subtitle="บันทึก signal จาก Neural Network ทุกครั้งที่เทรน · เก็บใน Redis"
      />

      {/* Stats row */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
          <div className="panel p-4 text-center">
            <div className="text-xl font-black" style={{ color: LABEL_COLORS[latestSignal.decision] }}>
              {latestSignal.decision}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-silver/35 mt-0.5">Signal ล่าสุด</div>
            <div className="text-[10px] text-silver/40 mt-1">{latestSignal.confidence.toFixed(1)}% conf</div>
          </div>
          {(["BUY","HOLD","SELL"] as const).map(d => (
            <div key={d} className="panel p-4 text-center">
              <div className="text-xl font-black" style={{ color: LABEL_COLORS[d] }}>{byDecision[d] ?? 0}</div>
              <div className="text-[9px] uppercase tracking-widest text-silver/35 mt-0.5">{d}</div>
              <div className="text-[10px] text-silver/40 mt-1">ครั้ง</div>
            </div>
          ))}
        </div>
      )}

      {/* Average accuracy */}
      {entries.length > 0 && (
        <div className="flex items-center gap-4 mb-5 rounded-xl border border-base-border/20 bg-white/[0.02] px-4 py-3 text-xs">
          <span className="text-silver/40">Avg Test Accuracy</span>
          <AccBar v={avgAcc} color="#a78bfa" />
          <span className="ml-auto text-silver/30">{entries.length} training sessions</span>
          <button onClick={load}
            className="rounded-lg border border-base-border/25 bg-white/[0.03] px-3 py-1.5 text-[10px] text-silver/50 hover:text-silver/80 transition-colors">
            🔄 รีเฟรช
          </button>
        </div>
      )}

      {/* Main table */}
      <div className="panel overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-silver/30">⏳ กำลังโหลด…</div>
        ) : err ? (
          <div className="flex h-40 items-center justify-center text-red-400 text-sm">{err}</div>
        ) : entries.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-silver/30 text-sm">
            <span className="text-3xl opacity-30">🧠</span>
            ยังไม่มีประวัติ signal · เทรน model ก่อนที่ <a href="/ai-model" className="underline text-silver/50">/ai-model</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-silver/30 text-[10px] border-b border-white/[0.04]">
                  <th className="text-left px-4 py-3 font-normal">เวลา</th>
                  <th className="text-center px-3 py-3 font-normal">Signal</th>
                  <th className="text-right px-3 py-3 font-normal">Confidence</th>
                  <th className="text-right px-3 py-3 font-normal">Test Acc</th>
                  <th className="text-right px-3 py-3 font-normal">Val Acc</th>
                  <th className="text-right px-4 py-3 font-normal">Epochs</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((e, i) => {
                  const color = LABEL_COLORS[e.decision];
                  return (
                    <tr key={e.id}
                      className="border-t border-white/[0.03] transition-colors hover:bg-white/[0.02]"
                      style={e.changed && i > 0 ? { borderTopColor: `${color}40` } : {}}>
                      <td className="px-4 py-3 text-silver/50 whitespace-nowrap">{tsStr(e.ts)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black"
                          style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>
                          {e.decision}
                        </span>
                        {e.changed && i > 0 && (
                          <span className="ml-1.5 text-[9px] text-silver/30">← เปลี่ยน</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <AccBar v={e.confidence} color={color} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <AccBar v={e.testAcc} color="#a78bfa" />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <AccBar v={e.valAcc ?? 0} color="#60a5fa" />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-silver/50">{e.epochs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-[10px] text-silver/25">
        บันทึกอัตโนมัติทุกครั้งที่เทรนเสร็จ · เก็บสูงสุด 200 รายการ ·
        <a href="/ai-model" className="ml-1 underline hover:text-silver/50">← กลับไปเทรน</a>
      </p>
    </div>
  );
}
