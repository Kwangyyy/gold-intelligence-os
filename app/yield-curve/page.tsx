"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { YieldCurvePayload } from "@/app/api/yield-curve/route";

function CurveChart({ points }: { points: YieldCurvePayload["points"] }) {
  if (points.length < 2) return null;
  const yields = points.map(p => p.yield).filter(y => y > 0);
  if (yields.length < 2) return null;
  const min = Math.min(...yields) * 0.95;
  const max = Math.max(...yields) * 1.05;
  const range = max - min || 0.1;
  const W = 500, H = 100;
  const xStep = W / (points.length - 1);
  const toY = (y: number) => H - ((y - min) / range) * H;
  const pts  = points.filter(p => p.yield > 0).map((p, i) => `${(i * xStep).toFixed(1)},${toY(p.yield).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" height="110" preserveAspectRatio="none">
      {/* Fill under curve */}
      <polygon
        points={`0,${H} ${pts} ${(points.filter(p => p.yield > 0).length - 1) * xStep},${H}`}
        fill="rgba(192,132,252,0.08)"
      />
      <polyline points={pts} fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinejoin="round" />
      {points.filter(p => p.yield > 0).map((p, i) => (
        <g key={i}>
          <circle cx={i * xStep} cy={toY(p.yield)} r="4" fill="#c084fc" />
          <text x={i * xStep} y={toY(p.yield) - 7} textAnchor="middle" fontSize="8" fill="#c084fc" fontWeight="bold">
            {p.yield.toFixed(2)}%
          </text>
          <text x={i * xStep} y={H + 14} textAnchor="middle" fontSize="8" fill="rgba(175,185,215,0.4)">
            {p.tenor}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function YieldCurvePage() {
  const [data, setData]       = useState<YieldCurvePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/yield-curve", { cache: "no-store" });
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
        title="📉 Yield Curve & Real Rates"
        subtitle="US Treasury yield curve + real interest rates — ปัจจัยขับเคลื่อนทองที่สำคัญที่สุด"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📉 กำลังโหลดข้อมูล Yield Curve…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Curve shape */}
          <div className="panel px-5 py-4" style={{ borderLeft: `4px solid ${data.curveShapeColor}` }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Yield Curve Shape
                </div>
                <div className="text-sm font-black mb-1" style={{ color: data.curveShapeColor }}>
                  {data.curveShapeTh}
                </div>
                <div className="flex gap-4 text-[9px]">
                  <span style={{ color: data.spread2s10s >= 0 ? "#34d399" : "#f87171" }}>
                    Spread 3M-10Y: {data.spread2s10s > 0 ? "+" : ""}{data.spread2s10s} bps
                  </span>
                  {data.isInverted && (
                    <span className="font-bold" style={{ color: "#f87171" }}>⚠ INVERTED</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
                <div className="text-lg font-black" style={{ color: "#f5c451" }}>
                  ${data.goldPrice.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Curve chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              US Treasury Yield Curve
            </div>
            <CurveChart points={data.points} />
          </div>

          {/* Yield table */}
          <div className="panel overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["อายุ","Yield","1D (bps)","1W (bps)"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[8px] uppercase tracking-wider"
                      style={{ color: "rgba(175,185,215,0.35)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.points.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-bold" style={{ color: "#c084fc" }}>{p.tenor}</div>
                      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{p.tenorTh}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono font-black text-sm" style={{ color: "rgba(175,185,215,0.9)" }}>
                        {p.yield.toFixed(3)}%
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs" style={{ color: p.change1d > 0 ? "#f87171" : p.change1d < 0 ? "#34d399" : "#f5c451" }}>
                        {p.change1d > 0 ? "+" : ""}{p.change1d} bps
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs" style={{ color: p.change1w > 0 ? "#f87171" : p.change1w < 0 ? "#34d399" : "#f5c451" }}>
                        {p.change1w > 0 ? "+" : ""}{p.change1w} bps
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Real rates */}
          <div className="panel px-5 py-4" style={{ borderLeft: `3px solid ${data.realRateColor}` }}>
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Real Interest Rate (Proxy)
            </div>
            <div className="flex gap-6 mb-3">
              <div>
                <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>10Y Nominal</div>
                <div className="text-sm font-black" style={{ color: "#c084fc" }}>{data.nominalRate10y.toFixed(3)}%</div>
              </div>
              <div>
                <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Inflation Proxy</div>
                <div className="text-sm font-black" style={{ color: "#f97316" }}>{data.inflationProxy.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Real Rate</div>
                <div className="text-sm font-black" style={{ color: data.realRateColor }}>
                  {data.realRateProxy > 0 ? "+" : ""}{data.realRateProxy.toFixed(2)}%
                </div>
              </div>
            </div>
            <div className="text-xs font-bold mb-1" style={{ color: data.realRateColor }}>
              {data.realRateSignalTh}
            </div>
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.7)" }}>{data.goldImplicationTh}</p>
            <p className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>{data.goldImplication}</p>
          </div>

          {/* Education */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 Yield Curve & Real Rates → ทอง
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ Real Rate ติดลบ = ทองเป็น safe haven ที่ดีกว่าพันธบัตร → bullish gold</li>
              <li>→ Inverted curve = เศรษฐกิจอาจถดถอย → Flight to safety → ดีสำหรับทอง</li>
              <li>→ Yield ขึ้นเร็ว (Fed hiking) = เพิ่ม opportunity cost ของทอง → bearish</li>
              <li>→ ทองไม่จ่าย yield — ถ้า real yield สูง นักลงทุนเลือกพันธบัตรแทน</li>
              <li>→ ⚠ Inflation proxy นี้ใช้ VIX-based estimate ไม่ใช่ TIPS breakeven จริง</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
