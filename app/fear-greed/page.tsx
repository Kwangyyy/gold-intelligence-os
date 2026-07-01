"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { FearGreedPayload, FearGreedComponent } from "@/app/api/fear-greed/route";

const ZONE_COLORS: Record<string, string> = {
  extreme_fear:  "#f87171",
  fear:          "#f97316",
  neutral:       "#f5c451",
  greed:         "#6ee7b7",
  extreme_greed: "#34d399",
};

function FearGauge({ score, color }: { score: number; color: string }) {
  const angle = -135 + (score / 100) * 270;
  const cx = 100, cy = 100, r = 70;
  // Arc from -135° to 135° (270° span)
  function polarToXY(deg: number) {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  const start = polarToXY(-135);
  const end   = polarToXY(135);
  const needle = polarToXY(angle);
  const bgArc = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
  const filledPct = score / 100;
  // Large arc flag needed if span > 180°; we go 270°, so always use large-arc for part
  const spanDeg = 270 * filledPct;
  const fillEnd = polarToXY(-135 + spanDeg);
  const fillLarge = spanDeg > 180 ? 1 : 0;
  const fillArc = `M ${start.x} ${start.y} A ${r} ${r} 0 ${fillLarge} 1 ${fillEnd.x} ${fillEnd.y}`;

  return (
    <div className="flex flex-col items-center">
      <div dangerouslySetInnerHTML={{ __html: `
        <svg viewBox="0 0 200 160" width="220" height="176">
          <!-- Background track -->
          <path d="${bgArc}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="14" stroke-linecap="round"/>
          <!-- Colored gradient segments -->
          <defs>
            <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stop-color="#f87171"/>
              <stop offset="25%"  stop-color="#f97316"/>
              <stop offset="50%"  stop-color="#f5c451"/>
              <stop offset="75%"  stop-color="#6ee7b7"/>
              <stop offset="100%" stop-color="#34d399"/>
            </linearGradient>
          </defs>
          <path d="${bgArc}" fill="none" stroke="url(#gauge-grad)" stroke-width="14" stroke-linecap="round" opacity="0.25"/>
          <!-- Filled arc -->
          <path d="${fillArc}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>
          <!-- Needle -->
          <line x1="${cx}" y1="${cy}" x2="${needle.x}" y2="${needle.y}" stroke="white" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
          <circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>
          <!-- Score -->
          <text x="${cx}" y="${cy + 35}" text-anchor="middle" font-size="28" font-weight="900" fill="${color}" font-family="monospace">${score}</text>
          <text x="${cx}" y="${cy + 52}" text-anchor="middle" font-size="10" fill="rgba(175,185,215,0.4)" font-family="sans-serif">/ 100</text>
        </svg>
      `}} />
    </div>
  );
}

function ComponentRow({ c }: { c: FearGreedComponent }) {
  const [open, setOpen] = useState(false);
  const color = ZONE_COLORS[c.signal] ?? "#f5c451";
  return (
    <div
      className="panel px-4 py-3 cursor-pointer"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-bold truncate" style={{ color: "rgba(175,185,215,0.8)" }}>
              {c.nameTh}
            </span>
            <span className="text-[10px] font-black shrink-0" style={{ color }}>{c.value}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${c.value}%`, background: color }} />
          </div>
        </div>
        <span className="text-[8px] uppercase tracking-wider shrink-0" style={{ color }}>
          {c.signal.replace(/_/g, " ")}
        </span>
        <span className="text-[9px] opacity-30">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="mt-3 space-y-1 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.7)" }}>{c.descriptionTh}</p>
          <p className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>{c.description}</p>
          <p className="text-[9px]" style={{ color: "rgba(175,185,215,0.25)" }}>
            น้ำหนัก {(c.weight * 100).toFixed(0)}%
          </p>
        </div>
      )}
    </div>
  );
}

function ZoneBar({ score }: { score: number }) {
  const zones = [
    { label: "Extreme\nFear", end: 20,  color: "#f87171" },
    { label: "Fear",          end: 40,  color: "#f97316" },
    { label: "Neutral",       end: 60,  color: "#f5c451" },
    { label: "Greed",         end: 80,  color: "#6ee7b7" },
    { label: "Extreme\nGreed",end: 100, color: "#34d399" },
  ];
  return (
    <div className="relative mt-2">
      <div className="flex h-4 rounded-full overflow-hidden">
        {zones.map(z => (
          <div key={z.label} style={{ flex: 20, background: z.color, opacity: 0.3 }} />
        ))}
      </div>
      {/* Score marker */}
      <div
        className="absolute top-0 bottom-0 w-1 rounded-full"
        style={{ left: `${score}%`, transform: "translateX(-50%)", background: "white" }}
      />
      <div className="flex justify-between mt-1">
        {zones.map(z => (
          <span key={z.label} className="text-[7px] text-center leading-tight" style={{ color: "rgba(175,185,215,0.3)", flex: 1 }}>
            {z.label.replace("\n", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FearGreedPage() {
  const [data, setData]       = useState<FearGreedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/fear-greed", { cache: "no-store" });
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
        title="😱 Fear & Greed Index"
        subtitle="Multi-asset fear/greed composite — Gold market implication"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📊 กำลังคำนวณ Fear & Greed Index…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Main gauge */}
          <div className="panel px-5 py-5 flex flex-col items-center">
            <FearGauge score={data.score} color={data.color} />
            <div
              className="text-2xl font-black mt-1 tracking-tight"
              style={{ color: data.color }}
            >
              {data.labelTh}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
              {data.label}
            </div>
            <div className="w-full max-w-xs mt-4">
              <ZoneBar score={data.score} />
            </div>
          </div>

          {/* Gold implication */}
          <div
            className="panel px-5 py-4"
            style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}
          >
            <div className="text-[9px] uppercase tracking-widest mb-2 text-amber-400/60">
              🪙 นัยสำหรับทองคำ
            </div>
            <p className="text-sm font-semibold" style={{ color: "#f5c451" }}>
              {data.goldImplicationTh}
            </p>
            <p className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>
              {data.goldImplication}
            </p>
          </div>

          {/* Components */}
          <div>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              องค์ประกอบ (คลิกเพื่อดูรายละเอียด)
            </div>
            <div className="space-y-2">
              {data.components.map(c => <ComponentRow key={c.name} c={c} />)}
            </div>
          </div>

          {/* Historical context */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              ⏳ บริบทประวัติศาสตร์
            </div>
            <div className="space-y-2">
              {data.historicalContext.map(h => {
                const c = h.score <= 20 ? "#f87171" : h.score <= 40 ? "#f97316" : h.score <= 60 ? "#f5c451" : "#34d399";
                return (
                  <div key={h.period} className="flex items-center gap-3">
                    <div
                      className="h-4 rounded-full"
                      style={{ width: `${h.score}%`, maxWidth: "60%", background: c, opacity: 0.6 }}
                    />
                    <span className="font-mono text-[10px] font-bold shrink-0" style={{ color: c }}>{h.score}</span>
                    <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{h.period}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* How to use */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.12)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(168,85,247,0.5)" }}>
              💡 วิธีอ่าน Fear & Greed Index
            </div>
            <ul className="space-y-2 text-xs" style={{ color: "rgba(175,185,215,0.6)" }}>
              <li>→ <strong style={{ color: "#f87171" }}>Extreme Fear (0-20)</strong>: ตลาดตื่นตระหนก — ทองมักทำผลดีมากในช่วงนี้ (historical buy zone)</li>
              <li>→ <strong style={{ color: "#f97316" }}>Fear (21-40)</strong>: นักลงทุนกังวล — demand safe-haven สูง ทองมี upside bias</li>
              <li>→ <strong style={{ color: "#f5c451" }}>Neutral (41-60)</strong>: ตลาดสมดุล — ไม่มีสัญญาณ fear/greed ชัดเจน</li>
              <li>→ <strong style={{ color: "#6ee7b7" }}>Greed (61-80)</strong>: นักลงทุนเสี่ยงมาก — ทองอาจ underperform หุ้น</li>
              <li>→ <strong style={{ color: "#34d399" }}>Extreme Greed (81-100)</strong>: ตลาดโลภจัด — สัญญาณ contrarian ระวัง correction</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              {data.components.length} ปัจจัย · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button
              onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}
            >
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
