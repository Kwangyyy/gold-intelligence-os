"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { PageHeader } from "@/components/PageHeader";
import type { ElliottWavePayload, ElliottTF } from "@/app/api/elliott-wave/route";

const TFS: { id: ElliottTF; label: string }[] = [
  { id: "15m", label: "15m" },
  { id: "1h",  label: "1H" },
  { id: "4h",  label: "4H" },
  { id: "1d",  label: "1D" },
  { id: "1w",  label: "1W" },
];

type IndKey = "ema20" | "ema50" | "ema200" | "bb";
const INDICATORS: { id: IndKey; label: string; color: string }[] = [
  { id: "ema20",  label: "EMA 20",  color: "#60a5fa" },
  { id: "ema50",  label: "EMA 50",  color: "#f5c451" },
  { id: "ema200", label: "EMA 200", color: "#f87171" },
  { id: "bb",     label: "Bollinger", color: "#94a3b8" },
];

// ── indicator math ────────────────────────────────────────────────────────────
function ema(vals: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = [];
  let prev: number | undefined;
  for (let i = 0; i < vals.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    if (prev === undefined) {
      prev = vals.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    } else {
      prev = vals[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}
function bollinger(vals: number[], period = 20, mult = 2) {
  const up: (number | null)[] = [], mid: (number | null)[] = [], lo: (number | null)[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (i < period - 1) { up.push(null); mid.push(null); lo.push(null); continue; }
    const w = vals.slice(i - period + 1, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / period);
    mid.push(m); up.push(m + mult * sd); lo.push(m - mult * sd);
  }
  return { up, mid, lo };
}
const lineData = (t: number[], vals: (number | null)[]) =>
  t.map((time, i) => ({ time, value: vals[i] })).filter(d => d.value != null) as { time: number; value: number }[];

const STRUCT_COLOR: Record<string, string> = {
  impulse: "#34d399", terminal: "#fb923c", zigzag: "#f5c451", flat: "#f5c451",
  triangle: "#60a5fa", complex: "#c084fc", unclear: "#94a3b8",
};

export default function ElliottWavePage() {
  const [data, setData]   = useState<ElliottWavePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]     = useState("");
  const [tf, setTf]       = useState<ElliottTF>("1d");
  const [libReady, setLibReady] = useState(false);
  const [inds, setInds]   = useState<Record<IndKey, boolean>>({ ema20: false, ema50: true, ema200: false, bb: false });

  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleRef = useRef<any>(null);
  const zzRef = useRef<any>(null);
  const indRef = useRef<Partial<Record<string, any>>>({});

  const load = useCallback(async (timeframe: ElliottTF) => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch(`/api/elliott-wave?tf=${timeframe}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(tf); }, [load, tf]);

  // Create the chart once the library + container are ready
  useEffect(() => {
    if (!libReady || !boxRef.current || chartRef.current) return;
    const LWC = (window as any).LightweightCharts;
    if (!LWC) return;
    const chart = LWC.createChart(boxRef.current, {
      height: 460,
      layout: { background: { type: "solid", color: "transparent" }, textColor: "rgba(175,185,215,0.6)", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      handleScroll: true, handleScale: true,
    });
    const candle = chart.addCandlestickSeries({
      upColor: "#22c55e", downColor: "#ef4444", borderVisible: false,
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });
    const zz = chart.addLineSeries({ color: "#c084fc", lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    chartRef.current = chart; candleRef.current = candle; zzRef.current = zz;

    const ro = new ResizeObserver(() => {
      if (boxRef.current) chart.applyOptions({ width: boxRef.current.clientWidth });
    });
    ro.observe(boxRef.current);
    chart.applyOptions({ width: boxRef.current.clientWidth });

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [libReady]);

  // Push data into the chart when it changes
  useEffect(() => {
    if (!data || !chartRef.current || !candleRef.current) return;
    const { series, zigzag, pivots } = data;
    const candleData = series.t.map((time, i) => ({ time, open: series.o[i], high: series.h[i], low: series.l[i], close: series.c[i] }));
    candleRef.current.setData(candleData);

    zzRef.current.setData(zigzag.filter(z => z.i >= 0 && z.i < series.t.length).map(z => ({ time: series.t[z.i], value: z.price })));

    // NeoWave labels as candle markers
    candleRef.current.setMarkers(
      pivots.filter(p => p.seriesIndex >= 0 && p.seriesIndex < series.t.length).map(p => ({
        time: series.t[p.seriesIndex],
        position: p.type === "high" ? "aboveBar" : "belowBar",
        color: p.type === "high" ? "#f5c451" : "#34d399",
        shape: p.type === "high" ? "arrowDown" : "arrowUp",
        text: p.label,
      }))
    );
    chartRef.current.timeScale().fitContent();
  }, [data]);

  // Sync indicator overlays
  useEffect(() => {
    if (!data || !chartRef.current) return;
    const chart = chartRef.current;
    const { series } = data;
    const c = series.c;
    const ensure = (key: string, color: string, width = 1) => {
      if (!indRef.current[key]) {
        indRef.current[key] = chart.addLineSeries({ color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      }
      return indRef.current[key];
    };
    const drop = (key: string) => { if (indRef.current[key]) { chart.removeSeries(indRef.current[key]); delete indRef.current[key]; } };

    (["ema20", "ema50", "ema200"] as const).forEach(k => {
      const period = k === "ema20" ? 20 : k === "ema50" ? 50 : 200;
      const color = INDICATORS.find(i => i.id === k)!.color;
      if (inds[k]) ensure(k, color).setData(lineData(series.t, ema(c, period)));
      else drop(k);
    });
    if (inds.bb) {
      const bb = bollinger(c, 20, 2);
      ensure("bbUp", "rgba(148,163,184,0.5)").setData(lineData(series.t, bb.up));
      ensure("bbLo", "rgba(148,163,184,0.5)").setData(lineData(series.t, bb.lo));
      ensure("bbMid", "rgba(148,163,184,0.3)").setData(lineData(series.t, bb.mid));
    } else { drop("bbUp"); drop("bbLo"); drop("bbMid"); }
  }, [inds, data]);

  const structColor = data ? (STRUCT_COLOR[data.structure] ?? "#94a3b8") : "#94a3b8";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Script
        src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"
        strategy="afterInteractive"
        onReady={() => setLibReady(true)}
        onLoad={() => setLibReady(true)}
      />

      <PageHeader
        title="〰️ NeoWave Analyzer"
        subtitle="นับคลื่นสาย NeoWave (Glenn Neely) — ตรวจสอบด้วยกฎ ไม่ใช่ Elliott Principle · ซูม/แพน + อินดิเคเตอร์ได้"
      />

      {/* Controls: timeframe + indicators */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>TF</span>
          <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {TFS.map(item => {
              const active = tf === item.id;
              return (
                <button key={item.id} onClick={() => setTf(item.id)}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all"
                  style={active
                    ? { background: "linear-gradient(90deg, rgba(168,85,247,0.3), rgba(245,196,81,0.12))", color: "#f5c451", boxShadow: "inset 0 0 0 1px rgba(245,196,81,0.3)" }
                    : { color: "rgba(175,185,215,0.5)" }}>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Indicators</span>
          <div className="flex flex-wrap gap-1">
            {INDICATORS.map(ind => {
              const on = inds[ind.id];
              return (
                <button key={ind.id} onClick={() => setInds(s => ({ ...s, [ind.id]: !s[ind.id] }))}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all"
                  style={on
                    ? { background: `${ind.color}22`, border: `1px solid ${ind.color}66`, color: ind.color }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(175,185,215,0.45)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: on ? ind.color : "rgba(148,163,184,0.3)" }} />
                  {ind.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {err && <div className="panel px-5 py-4 text-sm text-red-400 mb-4">{err}</div>}

      {/* Chart */}
      <div className="panel p-3 mb-5 relative">
        <div ref={boxRef} style={{ width: "100%", height: 460 }} />
        {(!libReady || loading) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ background: "rgba(6,9,26,0.4)" }}>
            <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>〰️ กำลังโหลดกราฟ NeoWave…</div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
          <span>🟢 แท่งขึ้น · 🔴 แท่งลง</span>
          <span style={{ color: "#c084fc" }}>— เส้นม่วง = NeoWave ZigZag</span>
          <span>ลากเพื่อแพน · สกอร์ลเพื่อซูม · ดับเบิลคลิกรีเซ็ต</span>
        </div>
      </div>

      {data && (
        <div className="space-y-5">
          {/* Structure hero */}
          <div className="panel px-5 py-5" style={{ borderLeft: `4px solid ${structColor}` }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-1 flex items-center gap-2" style={{ color: "rgba(175,185,215,0.3)" }}>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(192,132,252,0.15)", color: "#c084fc" }}>NeoWave</span>
                  โครงสร้างคลื่น
                </div>
                <div className="text-base font-black mb-1" style={{ color: structColor }}>{data.structureLabelTh}</div>
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.45)" }}>{data.structureLabel}</div>
                <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                  🎯 ตำแหน่งปัจจุบัน: <span style={{ color: "#f5c451" }}>{data.currentWaveTh}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Gold ({tf.toUpperCase()})</div>
                <div className="text-xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                <div className="mt-1 text-[9px] px-2 py-1 rounded-lg font-bold inline-block"
                  style={{ background: data.confidenceColor + "22", color: data.confidenceColor }}>
                  Confidence: {data.confidence}
                </div>
                {data.extension && (
                  <div className="mt-1 text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>คลื่นยืดตัว: <b style={{ color: "#34d399" }}>{data.extension}</b></div>
                )}
              </div>
            </div>
          </div>

          {/* Neely rule checks */}
          {data.neelyRules.length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                กฎ NeoWave (Rule-based verification)
              </div>
              <div className="space-y-2">
                {data.neelyRules.map((r, i) => {
                  const c = r.status === "pass" ? "#34d399" : r.status === "fail" ? "#f87171" : "#60a5fa";
                  const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "•";
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                        style={{ background: `${c}22`, color: c }}>{icon}</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{r.nameTh}</div>
                        <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.45)" }}>{r.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Implication */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>นัยสำคัญ</div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(175,185,215,0.8)" }}>{data.implicationTh}</p>
            <p className="text-[9px] mt-2 leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{data.implication}</p>
          </div>

          {/* Projections */}
          {data.projections.length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                เป้าหมายราคา (NeoWave Projection)
              </div>
              <div className="space-y-2">
                {data.projections.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-medium" style={{ color: p.type === "target" ? "#34d399" : "#60a5fa" }}>{p.labelTh}</div>
                      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{p.label}</div>
                    </div>
                    <span className="font-mono font-black text-sm" style={{ color: p.type === "target" ? "#34d399" : "#60a5fa" }}>
                      ${p.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fib levels */}
          {data.fibLevels.length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>Fibonacci Retracements</div>
              <div className="space-y-1.5">
                {data.fibLevels.map((f, i) => {
                  const near = Math.abs(f.price - data.goldPrice) / data.goldPrice < 0.01;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-10 text-[9px] font-bold" style={{ color: "#c084fc" }}>{f.ratio}</span>
                      <div className="flex-1 h-0.5 rounded-full" style={{ background: near ? "#f5c451" : "rgba(192,132,252,0.15)" }} />
                      <span className="font-mono text-[9px] font-bold" style={{ color: near ? "#f5c451" : "rgba(175,185,215,0.6)" }}>
                        ${f.price.toLocaleString()}{near && " ◀ Now"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>⚠️ เกี่ยวกับ NeoWave</div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ NeoWave (Glenn Neely) เน้น &ldquo;กฎ&rdquo; — Retracement, non-overlap, extension, Similarity &amp; Balance</li>
              <li>→ แม่นกว่า Elliott Principle เดิมเพราะตรวจสอบด้วยเงื่อนไข ไม่ใช่เดา pattern</li>
              <li>→ ระบบนี้เป็น heuristic อัตโนมัติ — count ทางเลือกอื่นอาจ valid ได้</li>
              <li>→ {data.disclaimer}</li>
            </ul>
            <div className="mt-2 flex justify-end">
              <button onClick={() => load(tf)}
                className="rounded-xl px-4 py-2 text-xs font-bold"
                style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
                🔄 วิเคราะห์ใหม่
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
