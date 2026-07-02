"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { CryptoGoldPayload, PricePoint } from "@/app/api/crypto-gold/route";

function DivergenceChart({ history }: { history: PricePoint[] }) {
  if (history.length < 2) return null;
  const W = 500, H = 90, PAD = 8;
  const goldNorms = history.map(h => h.goldNorm);
  const btcNorms  = history.map(h => h.btcNorm);
  const allVals   = [...goldNorms, ...btcNorms];
  const minV = Math.min(...allVals) * 0.97;
  const maxV = Math.max(...allVals) * 1.02;
  const rangeV = maxV - minV;
  const toX = (i: number) => PAD + (i / (history.length - 1)) * (W - 2 * PAD);
  const toY = (v: number) => H - PAD - ((v - minV) / rangeV) * (H - 2 * PAD);
  const gPts = history.map((h, i) => `${toX(i)},${toY(h.goldNorm)}`).join(" ");
  const bPts = history.map((h, i) => `${toX(i)},${toY(h.btcNorm)}`).join(" ");
  const baseline = toY(100);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: H }}>
      {/* Baseline 100 */}
      <line x1={PAD} y1={baseline} x2={W - PAD} y2={baseline}
        stroke="rgba(255,255,255,0.08)" strokeDasharray="3 2" strokeWidth={0.8} />
      <text x={PAD + 2} y={baseline - 2} fontSize="5.5" fill="rgba(175,185,215,0.25)">100</text>
      {/* BTC line */}
      <polyline points={bPts} fill="none" stroke="#818cf8" strokeWidth={1.5} strokeLinejoin="round" opacity={0.8} />
      {/* Gold line */}
      <polyline points={gPts} fill="none" stroke="#f5c451" strokeWidth={1.5} strokeLinejoin="round" />
      {/* Current dots */}
      <circle cx={toX(history.length - 1)} cy={toY(history[history.length - 1].goldNorm)} r={3} fill="#f5c451" />
      <circle cx={toX(history.length - 1)} cy={toY(history[history.length - 1].btcNorm)}  r={3} fill="#818cf8" />
      {/* Labels */}
      <text x={W - PAD - 2} y={toY(history[history.length - 1].goldNorm) - 3}
        textAnchor="end" fontSize="6" fill="#f5c451">Gold</text>
      <text x={W - PAD - 2} y={toY(history[history.length - 1].btcNorm) - 3}
        textAnchor="end" fontSize="6" fill="#818cf8">BTC</text>
    </svg>
  );
}

function CorrelationMeter({ corr }: { corr: number }) {
  const pct = ((corr + 1) / 2) * 100;
  const color = corr > 0.5 ? "#34d399" : corr > 0 ? "#f5c451" : "#f87171";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px]">
        <span style={{ color: "rgba(175,185,215,0.35)" }}>30D Correlation</span>
        <span className="font-black" style={{ color }}>{corr.toFixed(3)}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.8 }} />
        {/* Zero marker */}
        <div className="absolute top-0 bottom-0 w-0.5" style={{ left: "50%", background: "rgba(255,255,255,0.15)" }} />
      </div>
      <div className="flex justify-between text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        <span>-1 (Inverse)</span>
        <span>0</span>
        <span>+1 (Perfect)</span>
      </div>
    </div>
  );
}

function ReturnGrid({ data }: { data: CryptoGoldPayload }) {
  const rows: Array<{ label: string; gold: number; btc: number }> = [
    { label: "1D", gold: data.goldChange1d, btc: data.btcChange1d },
    { label: "1W", gold: data.goldChange1w, btc: data.btcChange1w },
    { label: "1M", gold: data.goldChange1m, btc: data.btcChange1m },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-[8px] font-bold" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span>Period</span>
        <span className="text-center" style={{ color: "#f5c451" }}>🪙 Gold</span>
        <span className="text-center" style={{ color: "#818cf8" }}>₿ BTC</span>
      </div>
      {rows.map(r => (
        <div key={r.label} className="grid grid-cols-3 gap-2 py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{r.label}</span>
          <span className="text-[9px] font-bold text-center tabular-nums" style={{ color: r.gold >= 0 ? "#34d399" : "#f87171" }}>
            {r.gold >= 0 ? "+" : ""}{r.gold.toFixed(2)}%
          </span>
          <span className="text-[9px] font-bold text-center tabular-nums" style={{ color: r.btc >= 0 ? "#34d399" : "#f87171" }}>
            {r.btc >= 0 ? "+" : ""}{r.btc.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CryptoGoldPage() {
  const [data, setData]       = useState<CryptoGoldPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/crypto-gold", { cache: "no-store" });
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
        title="₿ Crypto-Gold Divergence"
        subtitle="Bitcoin vs ทองคำ — การวิเคราะห์ safe haven rotation และ divergence"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            ₿ กำลังโหลดข้อมูล BTC/Gold…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero prices */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(245,196,81,0.06)", border: "1px solid rgba(245,196,81,0.15)" }}>
                <div className="text-[8px]" style={{ color: "rgba(245,196,81,0.5)" }}>🪙 GOLD</div>
                <div className="text-2xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                <div className="text-[9px] font-bold" style={{ color: data.goldChange1d >= 0 ? "#34d399" : "#f87171" }}>
                  1D {data.goldChange1d >= 0 ? "+" : ""}{data.goldChange1d.toFixed(2)}%
                </div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)" }}>
                <div className="text-[8px]" style={{ color: "rgba(129,140,248,0.5)" }}>₿ BITCOIN</div>
                <div className="text-2xl font-black" style={{ color: "#818cf8" }}>${data.btcPrice.toLocaleString()}</div>
                <div className="text-[9px] font-bold" style={{ color: data.btcChange1d >= 0 ? "#34d399" : "#f87171" }}>
                  1D {data.btcChange1d >= 0 ? "+" : ""}{data.btcChange1d.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Safe haven signal */}
            <div className="rounded-xl px-4 py-3" style={{ background: `${data.goldBiasColor}10`, border: `1px solid ${data.goldBiasColor}30` }}>
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>Safe Haven Flow</div>
              <div className="text-xs font-bold" style={{ color: data.goldBiasColor }}>{data.safeHavenFlowTh}</div>
              <div className="text-[9px] mt-0.5 font-bold" style={{ color: data.goldBiasColor }}>🪙 {data.goldBiasTh}</div>
            </div>
          </div>

          {/* Normalized chart */}
          {data.history.length > 1 && (
            <div className="panel px-4 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
                Performance (Normalized to 100)
              </div>
              <DivergenceChart history={data.history} />
            </div>
          )}

          {/* Divergence + Correlation */}
          <div className="panel px-5 py-4 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>30D Divergence</span>
                <span className="text-xs font-black" style={{ color: data.divergenceColor }}>
                  {data.divergence30d >= 0 ? "+" : ""}{data.divergence30d.toFixed(2)}%
                </span>
              </div>
              <div className="text-[9px] font-bold" style={{ color: data.divergenceColor }}>{data.divergenceSignalTh}</div>
            </div>
            <CorrelationMeter corr={data.correlation30d} />
          </div>

          {/* Returns grid */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              ผลตอบแทนเปรียบเทียบ
            </div>
            <ReturnGrid data={data} />
          </div>

          {/* Education */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 BTC vs Gold: ทำความเข้าใจ
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ BTC correlation กับ gold เพิ่มสูงขึ้นใน 2024+ จาก institutional adoption</li>
              <li>→ Gold นำ BTC ในวิกฤต (2020, 2022) → traditional safe haven ยังสำคัญ</li>
              <li>→ BTC นำ gold ช่วง liquidity expansion → risk appetite สูง</li>
              <li>→ Safe haven rotation: เมื่อ gold ขึ้น BTC ลง → นักลงทุน prefer physical safe haven</li>
              <li>→ Divergence &gt;20% มักตามด้วย mean-reversion → catch-up trade opportunity</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ GC=F + BTC-USD จาก Yahoo Finance | {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
