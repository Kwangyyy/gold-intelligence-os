"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { GeoRiskPayload, GeoRiskEvent } from "@/app/api/geo-risk/route";

const CAT_ICON: Record<GeoRiskEvent["category"], string> = {
  war: "⚔️", sanctions: "🚫", trade: "📦", political: "🏛️", financial: "💸", energy: "⛽",
};
const CAT_LABEL: Record<GeoRiskEvent["category"], string> = {
  war: "สงคราม", sanctions: "คว่ำบาตร", trade: "การค้า", political: "การเมือง", financial: "การเงิน", energy: "พลังงาน",
};

function RiskMeter({ score, color }: { score: number; color: string }) {
  const r = 44, cx = 50, cy = 54;
  const startAngle = -200;
  const totalAngle = 220;
  const angle = startAngle + (score / 100) * totalAngle;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcX = (a: number) => cx + r * Math.cos(toRad(a));
  const arcY = (a: number) => cy + r * Math.sin(toRad(a));
  const largeArc = (score / 100) * totalAngle > 180 ? 1 : 0;
  const d = `M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 ${largeArc} 1 ${arcX(angle)} ${arcY(angle)}`;
  const bg = `M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 1 1 ${arcX(startAngle + totalAngle)} ${arcY(startAngle + totalAngle)}`;

  return (
    <svg viewBox="0 0 100 80" width="120" height="96">
      <path d={bg} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
      {score > 0 && <path d={d} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="900" fill={color}>{score}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6" fill="rgba(175,185,215,0.4)">/ 100</text>
    </svg>
  );
}

function EventCard({ e }: { e: GeoRiskEvent }) {
  const riskColors = { extreme: "#f87171", high: "#f97316", medium: "#f5c451", low: "#34d399" };
  const riskLabels = { extreme: "Extreme", high: "High", medium: "Medium", low: "Low" };
  const c = riskColors[e.riskLevel];
  return (
    <div className="panel px-4 py-3" style={{ borderLeft: `3px solid ${c}` }}>
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0 mt-0.5">{CAT_ICON[e.category]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: c + "22", color: c }}>
              {riskLabels[e.riskLevel]}
            </span>
            <span className="text-[8px] font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>
              {e.regionTh}
            </span>
            <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              {CAT_LABEL[e.category]}
            </span>
          </div>
          <div className="text-[10px] font-medium mb-1" style={{ color: "rgba(175,185,215,0.85)" }}>
            {e.eventTh}
          </div>
          <div className="text-[9px]" style={{ color: e.goldImpactColor }}>
            🪙 {e.goldImpactTh}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GeoRiskPage() {
  const [data, setData]       = useState<GeoRiskPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [filter, setFilter]   = useState<GeoRiskEvent["category"] | "all">("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/geo-risk", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cats = ["all", "war", "sanctions", "trade", "political", "financial"] as const;
  const filtered = data?.events.filter(e => filter === "all" || e.category === filter) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🌍 Geopolitical Risk Tracker"
        subtitle="ติดตามความเสี่ยงภูมิรัฐศาสตร์โลก และผลกระทบต่อ XAUUSD safe-haven demand"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🌍 กำลังประเมินความเสี่ยงโลก…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Risk score */}
          <div className="panel px-5 py-5">
            <div className="flex items-center gap-5">
              <RiskMeter score={data.compositeRiskScore} color={data.riskColor} />
              <div className="flex-1">
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Geopolitical Risk Index
                </div>
                <div className="text-xl font-black mb-1" style={{ color: data.riskColor }}>
                  {data.riskLevelTh}
                </div>
                <div className="text-xs font-bold mb-2" style={{ color: data.goldBiasColor }}>
                  {data.goldBiasTh}
                </div>
                <div className="flex gap-3 text-[9px]">
                  <span>⚔️ {data.activeConflicts} conflicts</span>
                  <span>🚫 {data.activeSanctions} sanctions</span>
                  <span>📦 {data.tradeDisputes} trade disputes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Safe haven + VIX */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Safe-Haven Demand</div>
              <div className="text-xs font-bold" style={{
                color: data.safeHavenDemand === "high" ? "#34d399" : data.safeHavenDemand === "elevated" ? "#86efac" : "#f5c451"
              }}>
                {data.safeHavenTh}
              </div>
            </div>
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>VIX (Fear Gauge)</div>
              <div className="text-lg font-black" style={{
                color: data.goldVix > 25 ? "#f87171" : data.goldVix > 20 ? "#f97316" : "#34d399"
              }}>
                {data.goldVix}
              </div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                {data.goldVix > 25 ? "Extreme Fear" : data.goldVix > 20 ? "Elevated" : "Calm"}
              </div>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {cats.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className="px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all flex items-center gap-1"
                style={{
                  background: filter === c ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filter === c ? "rgba(245,196,81,0.5)" : "rgba(255,255,255,0.06)"}`,
                  color: filter === c ? "#f5c451" : "rgba(175,185,215,0.5)",
                }}>
                {c !== "all" && CAT_ICON[c as GeoRiskEvent["category"]]}
                {c === "all" ? "ทั้งหมด" : CAT_LABEL[c as GeoRiskEvent["category"]]}
              </button>
            ))}
          </div>

          {/* Events */}
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-widest px-1 mb-2"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              สถานการณ์โลก ({filtered.length} events)
            </div>
            {filtered.map(e => <EventCard key={e.id} e={e} />)}
          </div>

          {/* How geo risk affects gold */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 Geopolitical Risk กับทอง
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ ทองเป็น ultimate safe haven — เมื่อ geopolitical risk สูง นักลงทุนหนีมาทอง</li>
              <li>→ สงครามและความขัดแย้ง → spike ระยะสั้น แต่ effect ลดลงถ้าบุก escalate ไม่ถึง major war</li>
              <li>→ มาตรการคว่ำบาตรรัสเซีย → Central Bank ของจีน/รัสเซีย/อินเดียซื้อทองแทน USD</li>
              <li>→ ความตึงเครียดการค้าสหรัฐ-จีน → USD อ่อน → หนุนทอง</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ ข้อมูล events เป็น static dataset — อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
