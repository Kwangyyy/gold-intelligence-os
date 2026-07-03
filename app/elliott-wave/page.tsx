"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { PageHeader } from "@/components/PageHeader";
import type { ElliottWavePayload, ElliottTF } from "@/app/api/elliott-wave/route";

const TFS: { id: ElliottTF; label: string }[] = [
  { id: "15m", label: "15m" }, { id: "1h", label: "1H" }, { id: "4h", label: "4H" },
  { id: "1d", label: "1D" }, { id: "1w", label: "1W" },
];

type OverlayKey = "ema20" | "ema50" | "ema100" | "ema200" | "sma50" | "sma200" | "bb" | "vwap" | "volume";
const OVERLAYS: { id: OverlayKey; label: string; color: string }[] = [
  { id: "ema20",  label: "EMA20",  color: "#60a5fa" },
  { id: "ema50",  label: "EMA50",  color: "#f5c451" },
  { id: "ema100", label: "EMA100", color: "#22d3ee" },
  { id: "ema200", label: "EMA200", color: "#f87171" },
  { id: "sma50",  label: "SMA50",  color: "#a3e635" },
  { id: "sma200", label: "SMA200", color: "#fb923c" },
  { id: "bb",     label: "Bollinger", color: "#94a3b8" },
  { id: "vwap",   label: "VWAP",   color: "#e879f9" },
  { id: "volume", label: "Volume", color: "#64748b" },
];
type Osc = "none" | "rsi" | "macd" | "stoch";
const OSCS: { id: Osc; label: string }[] = [
  { id: "none", label: "ไม่มี" }, { id: "rsi", label: "RSI" }, { id: "macd", label: "MACD" }, { id: "stoch", label: "Stochastic" },
];

// ── indicator math ────────────────────────────────────────────────────────────
function ema(v: number[], p: number): (number | null)[] {
  const k = 2 / (p + 1); const out: (number | null)[] = []; let prev: number | undefined;
  for (let i = 0; i < v.length; i++) {
    if (i < p - 1) { out.push(null); continue; }
    prev = prev === undefined ? v.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p : v[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
function sma(v: number[], p: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < v.length; i++) out.push(i < p - 1 ? null : v.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p);
  return out;
}
function bollinger(v: number[], p = 20, m = 2) {
  const up: (number | null)[] = [], mid: (number | null)[] = [], lo: (number | null)[] = [];
  for (let i = 0; i < v.length; i++) {
    if (i < p - 1) { up.push(null); mid.push(null); lo.push(null); continue; }
    const w = v.slice(i - p + 1, i + 1); const mean = w.reduce((a, b) => a + b, 0) / p;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / p);
    mid.push(mean); up.push(mean + m * sd); lo.push(mean - m * sd);
  }
  return { up, mid, lo };
}
function vwap(h: number[], l: number[], c: number[], vol: number[]): (number | null)[] {
  let pv = 0, vv = 0; const out: (number | null)[] = [];
  for (let i = 0; i < c.length; i++) { const tp = (h[i] + l[i] + c[i]) / 3; pv += tp * vol[i]; vv += vol[i]; out.push(vv > 0 ? pv / vv : null); }
  return out;
}
function rsi(c: number[], p = 14): (number | null)[] {
  const out: (number | null)[] = Array(c.length).fill(null);
  if (c.length <= p) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  let ag = g / p, al = l / p;
  out[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1]; ag = (ag * (p - 1) + Math.max(d, 0)) / p; al = (al * (p - 1) + Math.max(-d, 0)) / p;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}
function macd(c: number[]) {
  const f = ema(c, 12), s = ema(c, 26);
  const line = c.map((_, i) => (f[i] != null && s[i] != null ? (f[i] as number) - (s[i] as number) : null));
  const lv = line.map(x => x ?? 0);
  const sig = ema(lv, 9).map((x, i) => (line[i] == null ? null : x));
  const hist = line.map((x, i) => (x != null && sig[i] != null ? x - (sig[i] as number) : null));
  return { line, sig, hist };
}
function stoch(h: number[], l: number[], c: number[], p = 14, d = 3) {
  const k: (number | null)[] = [];
  for (let i = 0; i < c.length; i++) {
    if (i < p - 1) { k.push(null); continue; }
    const hh = Math.max(...h.slice(i - p + 1, i + 1)), ll = Math.min(...l.slice(i - p + 1, i + 1));
    k.push(hh === ll ? 50 : (100 * (c[i] - ll)) / (hh - ll));
  }
  const kv = k.map(x => x ?? 0);
  const dl = sma(kv, d).map((x, i) => (k[i] == null ? null : x));
  return { k, d: dl };
}
const toLine = (t: number[], v: (number | null)[]) =>
  t.map((time, i) => ({ time, value: v[i] })).filter(x => x.value != null) as { time: number; value: number }[];

const STRUCT_COLOR: Record<string, string> = {
  impulse: "#34d399", terminal: "#fb923c", zigzag: "#f5c451", flat: "#f5c451",
  triangle: "#60a5fa", complex: "#c084fc", unclear: "#94a3b8",
};

export default function ElliottWavePage() {
  const [data, setData] = useState<ElliottWavePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tf, setTf] = useState<ElliottTF>("1d");
  const [libReady, setLibReady] = useState(false);
  const [ov, setOv] = useState<Record<OverlayKey, boolean>>({
    ema20: false, ema50: true, ema100: false, ema200: true, sma50: false, sma200: false, bb: false, vwap: false, volume: true,
  });
  const [osc, setOsc] = useState<Osc>("rsi");

  const boxRef = useRef<HTMLDivElement>(null);
  const oscBoxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleRef = useRef<any>(null);
  const zzRef = useRef<any>(null);
  const ovRef = useRef<Record<string, any>>({});
  const oscChartRef = useRef<any>(null);
  const oscSeriesRef = useRef<any[]>([]);
  const syncing = useRef(false);

  const load = useCallback(async (timeframe: ElliottTF) => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`/api/elliott-wave?tf=${timeframe}`, { cache: "no-store" });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e) { setErr(String(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(tf); }, [load, tf]);

  // main chart create (once)
  useEffect(() => {
    if (!libReady || !boxRef.current || chartRef.current) return;
    const LWC = (window as any).LightweightCharts; if (!LWC) return;
    const chart = LWC.createChart(boxRef.current, {
      height: 440,
      layout: { background: { type: "solid", color: "transparent" }, textColor: "rgba(175,185,215,0.6)", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: 1 },
    });
    const candle = chart.addCandlestickSeries({ upColor: "#22c55e", downColor: "#ef4444", borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444" });
    const zz = chart.addLineSeries({ color: "#c084fc", lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    chartRef.current = chart; candleRef.current = candle; zzRef.current = zz;
    const ro = new ResizeObserver(() => boxRef.current && chart.applyOptions({ width: boxRef.current.clientWidth }));
    ro.observe(boxRef.current); chart.applyOptions({ width: boxRef.current.clientWidth });
    // sync main → osc
    chart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
      if (syncing.current || !oscChartRef.current || !r) return;
      syncing.current = true; oscChartRef.current.timeScale().setVisibleLogicalRange(r); syncing.current = false;
    });
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [libReady]);

  // push candles + zigzag + markers
  useEffect(() => {
    if (!data || !chartRef.current || !candleRef.current) return;
    const s = data.series, n = s.t.length;
    candleRef.current.setData(s.t.map((time, i) => ({ time, open: s.o[i], high: s.h[i], low: s.l[i], close: s.c[i] })));
    zzRef.current.setData(data.zigzag.filter(z => z.i >= 0 && z.i < n).map(z => ({ time: s.t[z.i], value: z.price })));
    candleRef.current.setMarkers(
      data.pivots.filter(p => p.seriesIndex >= 0 && p.seriesIndex < n).map(p => ({
        time: s.t[p.seriesIndex], position: p.type === "high" ? "aboveBar" : "belowBar",
        color: p.type === "high" ? "#f5c451" : "#34d399", shape: p.type === "high" ? "arrowDown" : "arrowUp", text: p.label,
      }))
    );
    // show the most recent ~130 bars, older history scrollable
    chartRef.current.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 130), to: n + 4 });
  }, [data]);

  // overlays
  useEffect(() => {
    if (!data || !chartRef.current) return;
    const chart = chartRef.current, s = data.series;
    const ensure = (key: string, opts: any) => (ovRef.current[key] ??= chart.addLineSeries({ priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...opts }));
    const drop = (key: string) => { if (ovRef.current[key]) { chart.removeSeries(ovRef.current[key]); delete ovRef.current[key]; } };
    const cfg: [OverlayKey, () => (number | null)[], string, number][] = [
      ["ema20", () => ema(s.c, 20), "#60a5fa", 1], ["ema50", () => ema(s.c, 50), "#f5c451", 1],
      ["ema100", () => ema(s.c, 100), "#22d3ee", 1], ["ema200", () => ema(s.c, 200), "#f87171", 2],
      ["sma50", () => sma(s.c, 50), "#a3e635", 1], ["sma200", () => sma(s.c, 200), "#fb923c", 2],
    ];
    cfg.forEach(([k, fn, color, w]) => { if (ov[k]) ensure(k, { color, lineWidth: w }).setData(toLine(s.t, fn())); else drop(k); });

    if (ov.bb) { const b = bollinger(s.c); ensure("bbU", { color: "rgba(148,163,184,0.5)" }).setData(toLine(s.t, b.up)); ensure("bbL", { color: "rgba(148,163,184,0.5)" }).setData(toLine(s.t, b.lo)); ensure("bbM", { color: "rgba(148,163,184,0.3)" }).setData(toLine(s.t, b.mid)); }
    else { drop("bbU"); drop("bbL"); drop("bbM"); }

    if (ov.vwap && s.v.some(x => x > 0)) ensure("vwap", { color: "#e879f9", lineWidth: 2 }).setData(toLine(s.t, vwap(s.h, s.l, s.c, s.v))); else drop("vwap");

    if (ov.volume && s.v.some(x => x > 0)) {
      if (!ovRef.current.vol) {
        ovRef.current.vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false });
        chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
      }
      ovRef.current.vol.setData(s.t.map((time, i) => ({ time, value: s.v[i], color: s.c[i] >= s.o[i] ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)" })));
    } else if (ovRef.current.vol) { chart.removeSeries(ovRef.current.vol); delete ovRef.current.vol; }
  }, [ov, data]);

  // oscillator sub-pane
  useEffect(() => {
    if (!libReady) return;
    const LWC = (window as any).LightweightCharts; if (!LWC) return;
    // teardown when off
    if (osc === "none") {
      oscSeriesRef.current = [];
      if (oscChartRef.current) { oscChartRef.current.remove(); oscChartRef.current = null; }
      return;
    }
    if (!oscBoxRef.current) return;
    if (!oscChartRef.current) {
      const c = LWC.createChart(oscBoxRef.current, {
        height: 150,
        layout: { background: { type: "solid", color: "transparent" }, textColor: "rgba(175,185,215,0.5)", fontSize: 10 },
        grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
        timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
        crosshair: { mode: 1 },
      });
      oscChartRef.current = c;
      const ro = new ResizeObserver(() => oscBoxRef.current && c.applyOptions({ width: oscBoxRef.current.clientWidth }));
      ro.observe(oscBoxRef.current); c.applyOptions({ width: oscBoxRef.current.clientWidth });
      c.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
        if (syncing.current || !chartRef.current || !r) return;
        syncing.current = true; chartRef.current.timeScale().setVisibleLogicalRange(r); syncing.current = false;
      });
    }
    const chart = oscChartRef.current;
    oscSeriesRef.current.forEach(sr => chart.removeSeries(sr)); oscSeriesRef.current = [];
    if (!data) return;
    const s = data.series;
    const addLine = (o: any) => { const sr = chart.addLineSeries({ priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...o }); oscSeriesRef.current.push(sr); return sr; };
    if (osc === "rsi") {
      const sr = addLine({ color: "#c084fc", lineWidth: 2 }); sr.setData(toLine(s.t, rsi(s.c, 14)));
      sr.createPriceLine({ price: 70, color: "rgba(248,113,113,0.4)", lineWidth: 1, lineStyle: 2 });
      sr.createPriceLine({ price: 30, color: "rgba(52,211,153,0.4)", lineWidth: 1, lineStyle: 2 });
    } else if (osc === "macd") {
      const m = macd(s.c);
      const h = chart.addHistogramSeries({ lastValueVisible: false });
      h.setData(s.t.map((time, i) => ({ time, value: m.hist[i] ?? 0, color: (m.hist[i] ?? 0) >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" })).filter((_, i) => m.hist[i] != null));
      oscSeriesRef.current.push(h);
      addLine({ color: "#60a5fa", lineWidth: 2 }).setData(toLine(s.t, m.line));
      addLine({ color: "#f5c451", lineWidth: 1 }).setData(toLine(s.t, m.sig));
    } else if (osc === "stoch") {
      const st = stoch(s.h, s.l, s.c);
      const sr = addLine({ color: "#60a5fa", lineWidth: 2 }); sr.setData(toLine(s.t, st.k));
      addLine({ color: "#f5c451", lineWidth: 1 }).setData(toLine(s.t, st.d));
      sr.createPriceLine({ price: 80, color: "rgba(248,113,113,0.4)", lineWidth: 1, lineStyle: 2 });
      sr.createPriceLine({ price: 20, color: "rgba(52,211,153,0.4)", lineWidth: 1, lineStyle: 2 });
    }
    if (chartRef.current) { const r = chartRef.current.timeScale().getVisibleLogicalRange(); if (r) chart.timeScale().setVisibleLogicalRange(r); }
  }, [osc, data, libReady]);

  const structColor = data ? (STRUCT_COLOR[data.structure] ?? "#94a3b8") : "#94a3b8";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"
        strategy="afterInteractive" onReady={() => setLibReady(true)} onLoad={() => setLibReady(true)} />

      <PageHeader title="〰️ NeoWave Analyzer"
        subtitle="นับคลื่นสาย NeoWave (Glenn Neely) — ตรวจด้วยกฎ · ซูม/แพน + อินดิเคเตอร์ · label ซ้อนดีกรีตามทามเฟรม" />

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>TF</span>
          <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {TFS.map(i => {
              const a = tf === i.id;
              return <button key={i.id} onClick={() => setTf(i.id)} className="rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all"
                style={a ? { background: "linear-gradient(90deg, rgba(168,85,247,0.3), rgba(245,196,81,0.12))", color: "#f5c451", boxShadow: "inset 0 0 0 1px rgba(245,196,81,0.3)" } : { color: "rgba(175,185,215,0.5)" }}>{i.label}</button>;
            })}
          </div>
          {data && <span className="text-[9px] px-2 py-1 rounded-lg" style={{ background: "rgba(192,132,252,0.12)", color: "#c084fc" }}>ดีกรี: {data.degree}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Osc</span>
          <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {OSCS.map(o => {
              const a = osc === o.id;
              return <button key={o.id} onClick={() => setOsc(o.id)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all"
                style={a ? { background: "rgba(96,165,250,0.2)", color: "#60a5fa", boxShadow: "inset 0 0 0 1px rgba(96,165,250,0.4)" } : { color: "rgba(175,185,215,0.5)" }}>{o.label}</button>;
            })}
          </div>
        </div>
      </div>

      {/* Overlay indicator chips */}
      <div className="mb-3 flex flex-wrap gap-1">
        {OVERLAYS.map(ind => {
          const on = ov[ind.id];
          return <button key={ind.id} onClick={() => setOv(s => ({ ...s, [ind.id]: !s[ind.id] }))}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all"
            style={on ? { background: `${ind.color}22`, border: `1px solid ${ind.color}66`, color: ind.color } : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(175,185,215,0.45)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: on ? ind.color : "rgba(148,163,184,0.3)" }} />{ind.label}</button>;
        })}
      </div>

      {err && <div className="panel px-5 py-4 text-sm text-red-400 mb-4">{err}</div>}

      {/* Charts */}
      <div className="panel p-3 mb-5 relative">
        <div ref={boxRef} style={{ width: "100%", height: 440 }} />
        {osc !== "none" && <div ref={oscBoxRef} style={{ width: "100%", height: 150 }} className="mt-1 border-t" />}
        {(!libReady || loading) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ background: "rgba(6,9,26,0.4)" }}>
            <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>〰️ กำลังโหลดกราฟ NeoWave…</div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
          <span style={{ color: "#c084fc" }}>— เส้นม่วง = NeoWave ZigZag</span>
          <span>ลากเพื่อแพน · สกอร์ลเพื่อซูม · ลากซ้ายเพื่อดูย้อนหลัง</span>
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
                  โครงสร้างคลื่น · ดีกรี {data.degreeTh}
                </div>
                <div className="text-base font-black mb-1" style={{ color: structColor }}>{data.structureLabelTh}</div>
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.45)" }}>{data.structureLabel}</div>
                <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>🎯 ตำแหน่งปัจจุบัน: <span style={{ color: "#f5c451" }}>{data.currentWaveTh}</span></div>
              </div>
              <div className="text-right">
                <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Gold ({tf.toUpperCase()})</div>
                <div className="text-xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                <div className="mt-1 text-[9px] px-2 py-1 rounded-lg font-bold inline-block" style={{ background: data.confidenceColor + "22", color: data.confidenceColor }}>Confidence: {data.confidence}</div>
                {data.extension && <div className="mt-1 text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>คลื่นยืดตัว: <b style={{ color: "#34d399" }}>{data.extension}</b></div>}
              </div>
            </div>
          </div>

          {/* Neely rules */}
          {data.neelyRules.length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>กฎ NeoWave (Rule-based verification)</div>
              <div className="space-y-2">
                {data.neelyRules.map((r, i) => {
                  const c = r.status === "pass" ? "#34d399" : r.status === "fail" ? "#f87171" : "#60a5fa";
                  const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "•";
                  return <div key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: `${c}22`, color: c }}>{icon}</span>
                    <div className="min-w-0"><div className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{r.nameTh}</div><div className="text-[10px]" style={{ color: "rgba(175,185,215,0.45)" }}>{r.detail}</div></div>
                  </div>;
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
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>เป้าหมายราคา (NeoWave Projection)</div>
              <div className="space-y-2">
                {data.projections.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div><div className="text-[10px] font-medium" style={{ color: p.type === "target" ? "#34d399" : "#60a5fa" }}>{p.labelTh}</div><div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{p.label}</div></div>
                    <span className="font-mono font-black text-sm" style={{ color: p.type === "target" ? "#34d399" : "#60a5fa" }}>${p.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>⚠️ เกี่ยวกับ NeoWave</div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ NeoWave (Glenn Neely) เน้น &ldquo;กฎ&rdquo; — Retracement, non-overlap, extension, Similarity &amp; Balance</li>
              <li>→ label ซ้อนดีกรี: 1W ①②③ · 1D (1)(2)(3) · 4H 1 2 3 · 1H (i)(ii)(iii) · 15m i ii iii</li>
              <li>→ ระบบเป็น heuristic อัตโนมัติ — count ทางเลือกอื่นอาจ valid ได้</li>
              <li>→ {data.disclaimer}</li>
            </ul>
            <div className="mt-2 flex justify-end">
              <button onClick={() => load(tf)} className="rounded-xl px-4 py-2 text-xs font-bold" style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>🔄 วิเคราะห์ใหม่</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
