"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { RateWatchPayload, CBRateEntry } from "@/app/api/rate-watch/route";

function RealRateGauge({ rate, color }: { rate: number; color: string }) {
  // Range: -2 to +5, neutral at 1.5
  const min = -2, max = 5;
  const pct = Math.max(0, Math.min(100, ((rate - min) / (max - min)) * 100));
  return (
    <div className="space-y-1">
      <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        {/* Zone backgrounds */}
        <div className="absolute inset-y-0 left-0 right-[71%]" style={{ background: "rgba(52,211,153,0.12)" }} />
        <div className="absolute inset-y-0 left-[29%] right-[43%]" style={{ background: "rgba(245,196,81,0.08)" }} />
        <div className="absolute inset-y-0 left-[57%] right-0" style={{ background: "rgba(248,113,113,0.10)" }} />
        {/* Marker */}
        <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span>-2% (Bullish)</span><span>0%</span><span>2%</span><span>+5% (Bearish)</span>
      </div>
    </div>
  );
}

function CycleChip({ status, color }: { status: CBRateEntry["cycleStatus"]; color: string }) {
  const icons = { hiking: "⬆️", holding: "➡️", cutting: "⬇️", emergency_cut: "🚨" };
  return (
    <span className="text-[8px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"
      style={{ background: color + "22", color }}>
      {icons[status]} {status === "cutting" ? "ลด" : status === "hiking" ? "ขึ้น" : status === "holding" ? "คง" : "ฉุกเฉิน"}
    </span>
  );
}

function CBCard({ e }: { e: CBRateEntry }) {
  const goldColors = { bullish: "#34d399", neutral: "#9ca3af", bearish: "#f87171" };
  const changeColor = e.change < 0 ? "#34d399" : e.change > 0 ? "#f87171" : "#9ca3af";

  return (
    <div className="panel px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{e.flag}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.85)" }}>
              {e.bankTh}
            </span>
            <CycleChip status={e.cycleStatus} color={e.cycleColor} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Rate ปัจจุบัน</div>
              <div className="text-base font-black" style={{ color: "#f5c451" }}>
                {e.currentRate.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>เปลี่ยนแปลง</div>
              <div className="text-[10px] font-bold" style={{ color: changeColor }}>
                {e.change >= 0 ? "+" : ""}{e.change} bps
              </div>
            </div>
            <div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>ประชุมถัดไป</div>
              <div className="text-[9px] font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>
                {e.nextMeetingLabel}
              </div>
            </div>
          </div>
          <div className="mt-1.5 text-[9px]" style={{ color: goldColors[e.goldImplication] }}>
            🪙 {e.goldImplicationTh}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RateWatchPage() {
  const [data, setData]       = useState<RateWatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/rate-watch", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🏦 Central Bank Rate Watch"
        subtitle="ติดตามดอกเบี้ยนโยบายธนาคารกลางทั่วโลก — วัฏจักรดอกเบี้ยและผลต่อทอง"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🏦 กำลังโหลดข้อมูลดอกเบี้ย…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Macro summary */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Rate Environment</div>
                <div className="text-sm font-black" style={{
                  color: data.rateEnvironment === "dovish" ? "#34d399"
                       : data.rateEnvironment === "hawkish" ? "#f87171" : "#9ca3af"
                }}>
                  {data.rateEnvironment === "dovish" ? "🕊️ Dovish" : data.rateEnvironment === "hawkish" ? "🦅 Hawkish" : "⚖️ Neutral"}
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{data.rateEnvironmentTh}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Real Yield (10Y-CPI)</div>
                <div className="text-lg font-black" style={{ color: data.realRate < 1 ? "#34d399" : data.realRate > 2.5 ? "#f87171" : "#f5c451" }}>
                  {data.realRate >= 0 ? "+" : ""}{data.realRate}%
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>10Y Yield</div>
                <div className="text-lg font-black" style={{ color: "rgba(175,185,215,0.8)" }}>{data.yield10y}%</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                  {data.yieldCurve === "inverted" ? "🔻 Inverted" : data.yieldCurve === "flat" ? "➡️ Flat" : "✅ Normal"} curve
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Next FOMC</div>
                <div className="text-sm font-bold" style={{ color: "#c084fc" }}>{data.daysToNextFomc}d</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{data.nextFomcDate}</div>
              </div>
            </div>

            {/* Real rate gauge */}
            <div>
              <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
                Real Yield Gauge (10Y nominal − CPI proxy)
              </div>
              <RealRateGauge rate={data.realRate}
                color={data.realRate < 0 ? "#34d399" : data.realRate < 1.5 ? "#f5c451" : "#f87171"} />
              <div className="mt-1.5 text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>
                {data.historicalNote}
              </div>
            </div>

            <div className="text-xs font-bold" style={{ color: data.goldBiasColor }}>
              🪙 {data.goldBiasTh}
            </div>
          </div>

          {/* CB cards */}
          <div>
            <div className="text-[9px] uppercase tracking-widest px-1 mb-2"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              ธนาคารกลาง ({data.entries.length})
            </div>
            <div className="space-y-2">
              {data.entries.map(e => <CBCard key={e.bank} e={e} />)}
            </div>
          </div>

          {/* Gold & rates relationship */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 ดอกเบี้ยกับทอง
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ <span className="font-bold" style={{ color: "#34d399" }}>Rate cuts</span> → Real yield ลด → ทองไม่มีโอกาสเสียค่าเสียหาย → Demand เพิ่ม</li>
              <li>→ <span className="font-bold" style={{ color: "#f87171" }}>Rate hikes</span> → Real yield สูง → Fixed income ดึงดูดกว่า → กดทอง</li>
              <li>→ <span className="font-bold" style={{ color: "#f5c451" }}>Real yield ติดลบ</span> → ทองเป็นที่หลบเงินเฟ้อ → historically bullish มาก</li>
              <li>→ Inverted yield curve → สัญญาณ recession → ทองมักขึ้นก่อน Fed หมุนนโยบาย</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ CB rate data อัปเดตด้วย static dataset — ประชุม {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
