"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { BreakoutScanPayload, BreakoutSignal } from "@/app/api/breakout-scanner/route";

function StrengthBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[9px] font-mono font-bold w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

function SignalCard({ s, expanded, onToggle }: {
  s: BreakoutSignal; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-3.5 text-left">
        {/* Direction icon */}
        <span className="text-lg shrink-0">
          {s.direction === "bullish" ? "⬆" : s.direction === "bearish" ? "⬇" : "➡"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: s.color + "22", color: s.color }}>
              {s.timeframe}
            </span>
            <span className="text-xs font-bold" style={{ color: s.color }}>{s.timeframeTh}</span>
          </div>
          <div className="text-[10px] truncate" style={{ color: "rgba(175,185,215,0.6)" }}>
            {s.patternTh}
          </div>
        </div>
        <div className="text-right shrink-0 mr-1">
          <div className="text-xs font-mono font-black" style={{ color: s.color }}>{s.strength}%</div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>strength</div>
        </div>
        <span className="text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="mt-3 space-y-2">
            <StrengthBar value={s.strength} color={s.color} />
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center">
                <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Breakout Level</div>
                <div className="text-xs font-mono font-bold" style={{ color: s.color }}>${s.breakoutLevel}</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Target</div>
                <div className="text-xs font-mono font-bold" style={{ color: "#34d399" }}>${s.targetLevel}</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Stop</div>
                <div className="text-xs font-mono font-bold" style={{ color: "#f87171" }}>${s.stopLevel}</div>
              </div>
            </div>
            {s.rr > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>R:R</span>
                <span className="text-xs font-black"
                  style={{ color: s.rr >= 2 ? "#34d399" : s.rr >= 1.5 ? "#f5c451" : "#f87171" }}>
                  {s.rr}:1
                </span>
              </div>
            )}
            <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "rgba(175,185,215,0.7)" }}>
              {s.descriptionTh}
            </p>
            <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.3)" }}>
              {s.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BreakoutScannerPage() {
  const [data, setData]       = useState<BreakoutScanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [open, setOpen]       = useState<Record<string, boolean>>({ "0": true });

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/breakout-scanner", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (i: number) => setOpen(p => ({ ...p, [i]: !p[i] }));

  const alertBg = data?.alertZone === "breakout_imminent"
    ? "rgba(248,113,113,0.05)"
    : data?.alertZone === "trending"
    ? "rgba(52,211,153,0.04)"
    : "rgba(245,196,81,0.03)";
  const alertBorder = data?.alertZone === "breakout_imminent"
    ? "rgba(248,113,113,0.25)"
    : data?.alertZone === "trending"
    ? "rgba(52,211,153,0.2)"
    : "rgba(245,196,81,0.15)";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🔍 Breakout Scanner"
        subtitle="สแกน Breakout สัญญาณข้าม 4 Timeframes — 1H, 4H, Daily, Weekly"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🔍 กำลังสแกน Breakout…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Alert zone banner */}
          <div className="panel px-5 py-4" style={{ background: alertBg, border: `1px solid ${alertBorder}` }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {data.alertZone === "breakout_imminent" ? "⚠" : data.alertZone === "trending" ? "✅" : "⏸"}
              </span>
              <div>
                <div className="text-xs font-black" style={{
                  color: data.alertZone === "breakout_imminent" ? "#f87171" : data.alertZone === "trending" ? "#34d399" : "#f5c451"
                }}>
                  {data.alertZoneTh}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(175,185,215,0.5)" }}>
                  จับตาระดับ: {data.keyWatchTh}
                </div>
              </div>
            </div>
          </div>

          {/* Overview */}
          <div className="panel px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Gold ${data.goldPrice.toLocaleString()}
                </div>
                <div className="text-xl font-black mb-1" style={{ color: data.overallBiasColor }}>
                  {data.overallBias.toUpperCase()}
                </div>
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>{data.overallBiasTh}</div>
              </div>
              {/* Bull/Bear/Neutral tally */}
              <div className="flex gap-3">
                <div className="text-center">
                  <div className="text-lg font-black" style={{ color: "#34d399" }}>{data.bullCount}</div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Bull</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black" style={{ color: "#f87171" }}>{data.bearCount}</div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Bear</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black" style={{ color: "#f5c451" }}>{data.neutralCount}</div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>N</div>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                Composite Breakout Strength
              </div>
              <StrengthBar value={data.compositeStrength} color={data.overallBiasColor} />
            </div>
          </div>

          {/* Timeframe signals */}
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-widest px-1 mb-2"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              สัญญาณรายกรอบเวลา
            </div>
            {data.signals.map((s, i) => (
              <SignalCard key={i} s={s} expanded={!!open[i]} onToggle={() => toggle(i)} />
            ))}
          </div>

          {/* How to use */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 วิธีอ่าน Breakout Scanner
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ Strength &gt; 70 = สัญญาณแข็งแกร่ง | 50-70 = ปานกลาง | &lt; 50 = อ่อน</li>
              <li>→ สัญญาณ Bullish ตรงกัน ≥ 3 TF = High Conviction Long Setup</li>
              <li>→ Donchian Breakout = ราคาหลุด High/Low 20 แท่งสุดท้าย</li>
              <li>→ ยืนยันด้วย Volume หรือ candle close ก่อน entry เสมอ</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              สแกน {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
              🔄 รีสแกน
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
