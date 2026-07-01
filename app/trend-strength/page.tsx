"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { TrendStrengthPayload, TFTrendData } from "@/app/api/trend-strength/route";

const TREND_STYLE: Record<TFTrendData["trend"], { color: string; icon: string; bg: string }> = {
  strong_up:   { color: "#34d399", icon: "🚀", bg: "rgba(52,211,153,0.08)"   },
  up:          { color: "#6ee7b7", icon: "↑",  bg: "rgba(52,211,153,0.04)"   },
  flat:        { color: "#f5c451", icon: "→",  bg: "rgba(245,196,81,0.04)"   },
  down:        { color: "#fca5a5", icon: "↓",  bg: "rgba(248,113,113,0.04)"  },
  strong_down: { color: "#f87171", icon: "💀", bg: "rgba(248,113,113,0.08)"  },
};

const QUALITY_COLOR: Record<TFTrendData["quality"], string> = {
  excellent: "#34d399", good: "#6ee7b7", fair: "#f5c451", weak: "rgba(175,185,215,0.3)",
};

function ADXGauge({ adx, diPlus, diMinus }: { adx: number; diPlus: number; diMinus: number }) {
  const sweep = 180;
  const cx = 60, cy = 55, r = 42;
  function arc(from: number, to: number, color: string, width = 8) {
    const startAngle = (from / 100 * sweep - 90) * Math.PI / 180;
    const endAngle   = (to   / 100 * sweep - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = to - from > 50 ? 1 : 0;
    return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`;
  }
  const trackHtml   = arc(0, 100, "rgba(255,255,255,0.04)", 8);
  const adxHtml     = arc(0, Math.min(adx, 100), adx >= 25 ? "#f5c451" : "rgba(175,185,215,0.3)", 8);
  const svgContent  = `${trackHtml}${adxHtml}`;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="70" viewBox="0 0 120 70"
        dangerouslySetInnerHTML={{ __html: svgContent + `<text x="60" y="52" text-anchor="middle" fill="#f5c451" font-size="14" font-weight="900" font-family="monospace">${adx.toFixed(0)}</text><text x="60" y="64" text-anchor="middle" fill="rgba(175,185,215,0.3)" font-size="7">ADX</text>` }} />
      <div className="flex gap-3 text-[9px]">
        <span style={{ color: "#34d399" }}>DI+ {diPlus.toFixed(0)}</span>
        <span style={{ color: "#f87171" }}>DI- {diMinus.toFixed(0)}</span>
      </div>
    </div>
  );
}

function TFCard({ tf }: { tf: TFTrendData }) {
  const s = TREND_STYLE[tf.trend];
  const qColor = QUALITY_COLOR[tf.quality];
  const diPlusWins = tf.diPlus > tf.diMinus;
  return (
    <div className="panel px-4 py-4 transition-all" style={{ borderColor: `${s.color}30`, background: s.bg }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-black" style={{ color: s.color }}>{tf.tfLabel}</div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{tf.trendLabelTh}</div>
        </div>
        <div className="text-lg">{s.icon}</div>
      </div>
      <ADXGauge adx={tf.adx} diPlus={tf.diPlus} diMinus={tf.diMinus} />
      {/* Quality */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Quality</span>
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-full rounded-full" style={{ width: `${tf.qualityScore}%`, background: qColor }} />
        </div>
        <span className="text-[9px] font-bold" style={{ color: qColor }}>{tf.quality}</span>
      </div>
      {/* DI bars */}
      <div className="mt-2 space-y-1">
        {[{ label: "DI+", val: tf.diPlus, color: "#34d399" }, { label: "DI-", val: tf.diMinus, color: "#f87171" }].map(d => (
          <div key={d.label} className="flex items-center gap-1.5 text-[8px]">
            <span className="w-5" style={{ color: d.color }}>{d.label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(d.val, 60) / 60 * 100}%`, background: d.color, opacity: 0.7 }} />
            </div>
            <span className="w-5 font-mono" style={{ color: d.color }}>{d.val.toFixed(0)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[9px] font-bold text-center" style={{ color: s.color }}>
        {tf.trendLabel} {diPlusWins ? "(BUY bias)" : "(SELL bias)"}
      </div>
    </div>
  );
}

export default function TrendStrengthPage() {
  const [data, setData]       = useState<TrendStrengthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/trend-strength", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const overallStyle = data ? TREND_STYLE[data.overallTrend] : TREND_STYLE.flat;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="📈 Trend Strength"
        subtitle="ADX + DI+/DI- across 4 timeframes — คุณภาพและทิศทางแนวโน้ม XAUUSD"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>📈 กำลังคำนวณ ADX…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Overall */}
          <div className="panel px-5 py-4 flex items-center gap-4"
            style={{ border: `1px solid ${overallStyle.color}30`, background: overallStyle.bg }}>
            <div className="text-3xl">{overallStyle.icon}</div>
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
                Overall Trend Strength
              </div>
              <div className="text-lg font-black" style={{ color: overallStyle.color }}>
                {data.overallLabelTh} — {data.overallLabel}
              </div>
              <div className="text-[10px] mt-1" style={{ color: "rgba(175,185,215,0.5)" }}>
                {data.alignedCount}/{data.timeframes.length} TF align · {data.alignedPct}% consensus
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black" style={{ color: overallStyle.color }}>{data.overallScore}</div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>ADX avg</div>
            </div>
          </div>

          {/* Advice */}
          <div className="panel px-5 py-3" style={{ border: "1px solid rgba(245,196,81,0.15)", background: "rgba(245,196,81,0.03)" }}>
            <p className="text-sm font-medium" style={{ color: "rgba(175,185,215,0.85)" }}>{data.adviceTh}</p>
            <p className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>{data.advice}</p>
          </div>

          {/* TF alignment visual */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Timeframe Alignment
            </div>
            <div className="flex gap-2">
              {data.timeframes.map(tf => {
                const s = TREND_STYLE[tf.trend];
                return (
                  <div key={tf.tf} className="flex-1 text-center">
                    <div className="h-12 rounded-lg flex items-center justify-center text-lg mb-1"
                      style={{ background: s.bg, border: `1px solid ${s.color}30` }}>
                      {s.icon}
                    </div>
                    <div className="text-[8px] font-bold" style={{ color: s.color }}>{tf.tf.toUpperCase()}</div>
                    <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>ADX {tf.adx.toFixed(0)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TF Cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.timeframes.map(tf => <TFCard key={tf.tf} tf={tf} />)}
          </div>

          {/* ADX interpretation */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">📖 อ่านค่า ADX</div>
            <div className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>
              {[
                ["< 18", "rgba(175,185,215,0.3)", "Sideways — ตลาดไม่มีทิศทาง ไม่ใช้ trend strategy"],
                ["18–25", "#f5c451",              "Weak Trend — เริ่มมีทิศทาง แต่ยังไม่แน่นอน"],
                ["25–40", "#34d399",              "Good Trend — แนวโน้มชัดเจน เหมาะ trend following"],
                ["> 40",  "#f87171",              "Strong Trend — แนวโน้มแข็งแกร่งมาก ระวัง overextended"],
              ].map(([range, color, desc]) => (
                <div key={range} className="flex gap-3">
                  <span className="font-mono font-bold w-12 shrink-0" style={{ color: color as string }}>{range}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ${data.price.toFixed(0)} · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
