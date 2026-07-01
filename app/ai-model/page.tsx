"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { ModelDataPayload } from "@/lib/aiModelTypes";

// TF.js is loaded dynamically (client-only, large bundle)
let tf: any = null;

const MODEL_IDB_KEY = "indexeddb://gold-ai-model";
const META_LS_KEY   = "gold-ai-model-meta";

type Signal = { hold: number; buy: number; sell: number; decision: "BUY"|"SELL"|"HOLD"; confidence: number };

interface CachedMeta {
  savedAt:     string;
  epochs:      number;
  testAcc:     number;
  confMatrix:  number[][];
  signal:      Signal;
  lossCurve:   number[];
  accCurve:    number[];
  valAccCurve: number[];
  predicted:   number[];
  closes:      number[];
  labels:      number[];
  n:           number;
  featureNames: string[];
  labelCounts: { buy: number; sell: number; hold: number };
  dates:       string[];
  lastFeature: number[];
  priceRange:  { min: number; max: number };
}

const LABEL_NAMES  = ["HOLD", "BUY", "SELL"];
const LABEL_COLORS = ["#f5c451", "#34d399", "#f87171"];

// ── Mini SVG line chart ───────────────────────────────────────────────────────
function LineChart({ data, color, label, maxV }: {
  data: number[]; color: string; label: string; maxV?: number;
}) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-full text-[10px] text-silver/20">
      {label} chart ปรากฏระหว่างเทรน
    </div>
  );
  const W = 300; const H = 70;
  const max = maxV ?? Math.max(...data, 0.001);
  const min = Math.min(...data);
  const range = max - min || 0.001;
  const pts = data.map((v, i) =>
    `${(i / Math.max(data.length - 1, 1)) * W},${H - ((v - min) / range) * H}`
  ).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%", height:H }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <text x="2" y="10" fill={color} fontSize="9">{label}: {data[data.length-1]?.toFixed(4)}</text>
    </svg>
  );
}

// ── Confusion matrix ──────────────────────────────────────────────────────────
function ConfMatrix({ cm }: { cm: number[][] }) {
  const rowSums = cm.map(r => r.reduce((a, b) => a + b, 0) || 1);
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-silver/30 mb-2">Confusion Matrix (True → Predicted)</div>
      <table className="text-[10px] w-full">
        <thead>
          <tr>
            <th className="text-silver/20 font-normal px-1 text-left" />
            {LABEL_NAMES.map(l => <th key={l} className="px-2 pb-1 font-bold text-center" style={{ color:"#94a3b8" }}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {cm.map((row, ri) => (
            <tr key={ri}>
              <td className="px-1 py-1 font-bold text-right pr-2" style={{ color: LABEL_COLORS[ri] }}>{LABEL_NAMES[ri]}</td>
              {row.map((val, ci) => {
                const pct = val / rowSums[ri];
                const isDiag = ri === ci;
                return (
                  <td key={ci} className="px-2 py-1 text-center rounded" style={{
                    background: isDiag ? `${LABEL_COLORS[ri]}22` : "rgba(255,255,255,0.03)",
                    color: isDiag ? LABEL_COLORS[ri] : "#64748b",
                    fontWeight: isDiag ? 700 : 400,
                  }}>
                    {val}
                    <span className="text-[8px] ml-0.5 opacity-60">({(pct*100).toFixed(0)}%)</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Equity curve backtest from AI signals ─────────────────────────────────────
function AiBacktest({ closes, labels, predicted }: { closes: number[]; labels: number[]; predicted: number[] }) {
  if (!predicted.length) return null;
  const N = Math.min(closes.length, predicted.length, labels.length);

  let equity = 10000;
  const curve: number[] = [equity];
  for (let i = 0; i < N - 5; i++) {
    const sig = predicted[i];
    if (sig === 1) {
      const ret = (closes[i + 5] - closes[i]) / closes[i];
      equity *= 1 + Math.max(-0.05, Math.min(0.05, ret));
    } else if (sig === 2) {
      const ret = (closes[i] - closes[i + 5]) / closes[i];
      equity *= 1 + Math.max(-0.05, Math.min(0.05, ret));
    }
    curve.push(equity);
  }

  const W = 500; const H = 80;
  const maxE = Math.max(...curve); const minE = Math.min(...curve);
  const rng = maxE - minE || 1;
  const pts = curve.map((v, i) => `${(i/(curve.length-1))*W},${H-((v-minE)/rng)*H}`).join(" ");
  const finalRet = ((equity - 10000) / 10000 * 100).toFixed(1);
  const color = equity > 10000 ? "#34d399" : "#f87171";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] uppercase tracking-widest text-silver/30">AI Signal Backtest</div>
        <div className="font-black text-sm" style={{ color }}>
          {equity > 10000 ? "+" : ""}{finalRet}% return
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%", height:H }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="0" y1={H-((10000-minE)/rng)*H} x2={W} y2={H-((10000-minE)/rng)*H}
          stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="4,3" />
      </svg>
      <div className="text-[9px] text-silver/25 mt-1">เงินต้น $10,000 · signal จาก test set · ไม่รวม spread/commission</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AiModelPage() {
  const [tfLoaded,     setTfLoaded]     = useState(false);
  const [data,         setData]         = useState<ModelDataPayload | null>(null);
  const [dataLoading,  setDataLoading]  = useState(false);
  const [dataErr,      setDataErr]      = useState("");

  // Training state
  const [epochs,       setEpochs]       = useState(80);
  const [lr,           setLr]           = useState(0.001);
  const [training,     setTraining]     = useState(false);
  const [curEpoch,     setCurEpoch]     = useState(0);
  const [lossCurve,    setLossCurve]    = useState<number[]>([]);
  const [accCurve,     setAccCurve]     = useState<number[]>([]);
  const [valAccCurve,  setValAccCurve]  = useState<number[]>([]);

  // Results
  const [testAcc,      setTestAcc]      = useState<number | null>(null);
  const [confMatrix,   setConfMatrix]   = useState<number[][] | null>(null);
  const [signal,       setSignal]       = useState<Signal | null>(null);
  const [predicted,    setPredicted]    = useState<number[]>([]);

  // Cache status
  const [savedAt,      setSavedAt]      = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [fromCache,    setFromCache]    = useState(false);

  const modelRef = useRef<any>(null);

  // ── Restore saved model + metadata from IndexedDB / localStorage ────────────
  const tryLoadFromCache = useCallback(async () => {
    try {
      const models = await tf.io.listModels();
      if (!(MODEL_IDB_KEY in models)) return;

      const model = await tf.loadLayersModel(MODEL_IDB_KEY);
      modelRef.current = model;

      const raw = localStorage.getItem(META_LS_KEY);
      if (!raw) return;
      const meta: CachedMeta = JSON.parse(raw);

      setSavedAt(meta.savedAt);
      setEpochs(meta.epochs ?? 80);
      setTestAcc(meta.testAcc ?? null);
      setConfMatrix(meta.confMatrix ?? null);
      setSignal(meta.signal ?? null);
      setLossCurve(meta.lossCurve ?? []);
      setAccCurve(meta.accCurve ?? []);
      setValAccCurve(meta.valAccCurve ?? []);
      setPredicted(meta.predicted ?? []);
      setFromCache(true);

      // Restore minimal data object so backtest chart renders
      if (meta.closes?.length) {
        setData({
          features:    [],
          labels:      meta.labels ?? [],
          featureNames: (meta.featureNames ?? []) as readonly string[],
          labelCounts: meta.labelCounts ?? { buy: 0, sell: 0, hold: 0 },
          n:           meta.n ?? 0,
          dates:       meta.dates ?? [],
          lastFeature: meta.lastFeature ?? [],
          priceRange:  meta.priceRange ?? { min: 0, max: 0 },
          closes:      meta.closes,
        } as ModelDataPayload);
      }
    } catch {
      // No saved model — silent fail, user will train fresh
    }
  }, []);

  // Load TF.js, then try restoring cache
  useEffect(() => {
    import("@tensorflow/tfjs").then(async m => {
      tf = m;
      setTfLoaded(true);
      await tryLoadFromCache();
    });
  }, [tryLoadFromCache]);

  // ── Auto-save after training ────────────────────────────────────────────────
  const saveToCache = useCallback(async (
    model: any,
    meta: Omit<CachedMeta, "savedAt">
  ) => {
    setSaving(true);
    try {
      await model.save(MODEL_IDB_KEY);
      const savedAt = new Date().toISOString();
      localStorage.setItem(META_LS_KEY, JSON.stringify({ ...meta, savedAt }));
      setSavedAt(savedAt);
      setFromCache(false);
    } catch {
      // Save failed silently — user can still use results
    } finally {
      setSaving(false);
    }
  }, []);

  // Load features from API
  const loadData = useCallback(async () => {
    setDataLoading(true); setDataErr("");
    try {
      const r = await fetch("/api/ai-model/data", { cache:"no-store" });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(d as ModelDataPayload);
      setFromCache(false);
    } catch (e) { setDataErr(String(e)); }
    finally { setDataLoading(false); }
  }, []);

  // Build TF.js model
  const buildModel = useCallback((inputSize: number) => {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [inputSize], units: 64, activation: "relu" }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 32, activation: "relu" }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 16, activation: "relu" }));
    model.add(tf.layers.dense({ units: 3, activation: "softmax" }));
    model.compile({
      optimizer: tf.train.adam(lr),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });
    return model;
  }, [lr]);

  // Train
  const train = useCallback(async () => {
    if (!tf || !data || !data.features.length) return;
    setTraining(true);
    setCurEpoch(0); setLossCurve([]); setAccCurve([]); setValAccCurve([]);
    setTestAcc(null); setConfMatrix(null); setSignal(null); setPredicted([]);

    const { features, labels, lastFeature, closes } = data;
    const N      = features.length;
    const splitI = Math.floor(N * 0.8);

    // ── Oversample training set so every class is equally represented ─────────
    const rawTrainF = features.slice(0, splitI);
    const rawTrainL = labels.slice(0, splitI);
    const classIdxs: number[][] = [[], [], []];
    for (let i = 0; i < rawTrainL.length; i++) classIdxs[rawTrainL[i]].push(i);
    const maxN = Math.max(...classIdxs.map(c => c.length));
    const balF: number[][] = [];
    const balL: number[] = [];
    for (let c = 0; c < 3; c++) {
      const idxs = classIdxs[c];
      for (let i = 0; i < maxN; i++) {
        balF.push(rawTrainF[idxs[i % idxs.length]]);
        balL.push(c);
      }
    }
    // Fisher-Yates shuffle
    for (let i = balF.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [balF[i], balF[j]] = [balF[j], balF[i]];
      [balL[i], balL[j]] = [balL[j], balL[i]];
    }
    // ─────────────────────────────────────────────────────────────────────────

    const xTrain = tf.tensor2d(balF);
    const xTest  = tf.tensor2d(features.slice(splitI));
    const yTrain = tf.oneHot(tf.tensor1d(balL, "int32"), 3);
    const yTest  = tf.oneHot(tf.tensor1d(labels.slice(splitI), "int32"), 3);

    try {
      const model = buildModel(features[0].length);
      modelRef.current = model;

      const lossH: number[] = [], accH: number[] = [], valAccH: number[] = [];

      await model.fit(xTrain, yTrain, {
        epochs,
        batchSize: 32,
        validationData: [xTest, yTest],
        shuffle: true,
        callbacks: {
          onEpochEnd: (_epoch: number, logs: Record<string, number>) => {
            lossH.push(+(logs?.loss?.toFixed(4) ?? 0));
            accH.push(+(logs?.acc?.toFixed(4) ?? 0));
            valAccH.push(+(logs?.val_acc?.toFixed(4) ?? 0));
            setCurEpoch(_epoch + 1);
            setLossCurve([...lossH]);
            setAccCurve([...accH]);
            setValAccCurve([...valAccH]);
          },
        },
      });

      // Evaluate on test set
      const predTensor = model.predict(xTest) as ReturnType<typeof tf.tensor2d>;
      const predLabels = (predTensor.argMax(1).arraySync() as number[]);
      const trueLabels = labels.slice(splitI);

      // Full prediction for backtest
      const fullPred = (model.predict(tf.tensor2d(features)) as ReturnType<typeof tf.tensor2d>)
        .argMax(1).arraySync() as number[];
      setPredicted(fullPred);

      // Confusion matrix
      const cm: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
      for (let i = 0; i < trueLabels.length; i++) cm[trueLabels[i]][predLabels[i]]++;
      setConfMatrix(cm);
      const acc = predLabels.filter((p, i) => p === trueLabels[i]).length / trueLabels.length * 100;
      setTestAcc(acc);

      // Current signal on latest bar
      const lastTensor = tf.tensor2d([lastFeature]);
      const lastProbs  = (model.predict(lastTensor) as ReturnType<typeof tf.tensor2d>).arraySync()[0] as number[];
      const decision = lastProbs[1] > lastProbs[2] && lastProbs[1] > lastProbs[0] ? "BUY"
                     : lastProbs[2] > lastProbs[1] && lastProbs[2] > lastProbs[0] ? "SELL" : "HOLD";
      const sig: Signal = { hold: lastProbs[0], buy: lastProbs[1], sell: lastProbs[2],
                            decision, confidence: Math.max(...lastProbs) * 100 };
      setSignal(sig);

      // ── Auto-save ──────────────────────────────────────────────────────────
      await saveToCache(model, {
        epochs,
        testAcc:     acc,
        confMatrix:  cm,
        signal:      sig,
        lossCurve:   lossH,
        accCurve:    accH,
        valAccCurve: valAccH,
        predicted:   fullPred,
        closes:      data.closes,
        labels:      data.labels,
        n:           data.n,
        featureNames: [...data.featureNames],
        labelCounts: data.labelCounts,
        dates:       data.dates,
        lastFeature: data.lastFeature,
        priceRange:  data.priceRange,
      });

      [xTrain, xTest, yTrain, yTest, predTensor, lastTensor].forEach(t => t.dispose());
    } finally {
      setTraining(false);
    }
  }, [data, epochs, buildModel, saveToCache]);

  const phaseDone = (p: number) => {
    if (p === 1) return !!data;
    if (p === 2) return accCurve.length > 0;
    if (p === 3) return testAcc !== null;
    return false;
  };

  const canTrain = !!data && data.features.length > 0 && tfLoaded && !training;

  const formatSavedAt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("th-TH", { day:"2-digit", month:"short", year:"numeric" })
      + " " + d.toLocaleTimeString("th-TH", { hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="AI Model Training 🧠"
        subtitle="Feedforward Neural Network + Ensemble · เทรนบน XAUUSD D1 2 ปี · TensorFlow.js runs in your browser"
      />

      {/* Cache status banner */}
      {savedAt && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
          style={{ background: fromCache ? "rgba(52,211,153,0.08)" : "rgba(96,165,250,0.08)",
                   border: `1px solid ${fromCache ? "rgba(52,211,153,0.25)" : "rgba(96,165,250,0.25)"}` }}>
          <span style={{ color: fromCache ? "#34d399" : "#60a5fa" }}>
            {fromCache ? "✅ โหลด model จาก cache" : saving ? "💾 กำลังบันทึก…" : "💾 บันทึกแล้ว"}
          </span>
          <span className="text-silver/40">·</span>
          <span className="text-silver/50">{fromCache ? "เทรนเมื่อ" : "บันทึกเมื่อ"} {formatSavedAt(savedAt)}</span>
          <span className="text-silver/40">·</span>
          <span className="text-silver/40">ข้อมูลต่อเนื่องข้าม session อัตโนมัติ</span>
        </div>
      )}

      {/* Phase stepper */}
      <div className="flex items-center gap-2 mb-6 text-[10px]">
        {["1 โหลดข้อมูล","2 ตั้งค่า & เทรน","3 ผลลัพธ์ & Signal"].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 font-bold ${phaseDone(i+1) ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" : "text-silver/40 border-silver/20 bg-white/[0.03]"} border`}>
              {phaseDone(i+1) ? "✓" : s.slice(0,1)} {s.slice(1)}
            </span>
            {i < 2 && <span className="text-silver/20">→</span>}
          </div>
        ))}
        <span className="ml-auto text-silver/30">{tfLoaded ? "✅ TF.js ready" : "⏳ loading TF.js…"}</span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

        {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Step 1: Load data */}
          <div className="panel p-5">
            <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Step 1 — Dataset</div>
            <button onClick={loadData} disabled={dataLoading}
              className="w-full rounded-xl py-2.5 text-sm font-bold transition-all mb-3 disabled:opacity-50"
              style={{ background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.35)", color:"#60a5fa" }}>
              {dataLoading ? "⏳ กำลังดึงข้อมูล…" : (data && data.features.length > 0) ? "🔄 โหลดใหม่" : "📥 โหลดข้อมูล XAUUSD"}
            </button>
            {fromCache && (!data || data.features.length === 0) && (
              <p className="text-[10px] text-silver/35 mb-2">
                💡 ใช้ model จาก cache ได้เลย · โหลดข้อมูลใหม่เมื่อต้องการเทรนซ้ำ
              </p>
            )}
            {dataErr && <p className="text-xs text-red-400">{dataErr}</p>}
            {data && data.n > 0 && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-silver/50">จำนวนตัวอย่าง</span>
                  <span className="font-mono text-silver/80">{data.n} bars</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-silver/50">Features</span>
                  <span className="font-mono text-silver/80">{data.featureNames.length} indicators</span>
                </div>
                {/* Label distribution */}
                <div className="mt-2">
                  <div className="text-[9px] text-silver/30 uppercase tracking-widest mb-1.5">Label Distribution</div>
                  {[["BUY",data.labelCounts.buy,LABEL_COLORS[1]],
                    ["SELL",data.labelCounts.sell,LABEL_COLORS[2]],
                    ["HOLD",data.labelCounts.hold,LABEL_COLORS[0]]].map(([l,c,col]) => (
                    <div key={l as string} className="flex items-center gap-2 mb-1">
                      <span className="w-8 text-[9px] font-bold" style={{ color: col as string }}>{l as string}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.05)" }}>
                        <div style={{ width:`${(c as number)/data.n*100}%`, background: col as string }} className="h-full rounded-full" />
                      </div>
                      <span className="text-[9px] font-mono text-silver/40 w-10 text-right">{((c as number)/data.n*100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Config */}
          <div className="panel p-5">
            <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Step 2 — ตั้งค่าโมเดล</div>
            <div className="space-y-4 text-xs mb-4">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-silver/60">Epochs</span>
                  <span className="font-mono font-bold text-silver/80">{epochs}</span>
                </div>
                <input type="range" min={20} max={200} step={10} value={epochs}
                  onChange={e => setEpochs(+e.target.value)}
                  className="w-full accent-purple-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-silver/60">Learning Rate</span>
                  <span className="font-mono font-bold text-silver/80">{lr}</span>
                </div>
                <select value={lr} onChange={e => setLr(+e.target.value)}
                  className="w-full rounded-lg border border-base-border/30 bg-white/[0.03] px-2 py-1 text-xs text-silver/70 outline-none">
                  {[0.01, 0.005, 0.001, 0.0005, 0.0001].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Architecture */}
            <div className="rounded-xl p-3 mb-4" style={{ background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[9px] text-silver/30 uppercase tracking-widest mb-2">Architecture</div>
              {[["Input",`${data?.featureNames.length ?? 14} features`,"#60a5fa"],
                ["Dense 64","ReLU + BatchNorm + Dropout(0.3)","#a78bfa"],
                ["Dense 32","ReLU + Dropout(0.2)","#a78bfa"],
                ["Dense 16","ReLU","#a78bfa"],
                ["Output 3","Softmax → BUY/HOLD/SELL","#34d399"]].map(([l,d,c]) => (
                <div key={l} className="flex items-center gap-2 text-[10px] mb-1">
                  <span className="w-16 font-bold" style={{ color: c }}>{l}</span>
                  <span className="text-silver/40">{d}</span>
                </div>
              ))}
            </div>

            <button onClick={train} disabled={!canTrain}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-40"
              style={{ background:"rgba(168,85,247,0.15)", border:"1px solid rgba(168,85,247,0.4)", color:"#c084fc" }}>
              {training
                ? <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400/30 border-t-purple-400" />
                    Epoch {curEpoch}/{epochs}
                  </span>
                : fromCache ? "🔄 เทรนใหม่ (แทน cache)" : "🚀 เริ่มเทรน"}
            </button>
            {!canTrain && !training && (
              <p className="text-[10px] text-silver/30 mt-2 text-center">
                {!tfLoaded ? "รอ TF.js โหลด…" : "กด โหลดข้อมูล XAUUSD ก่อนเทรน"}
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-5">

          {/* Training charts */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-silver/35">Training Progress</div>
              {training && <span className="text-[10px] text-purple-400 animate-pulse">● Training…</span>}
              {testAcc !== null && !training && (
                <span className="text-[10px] text-emerald-400">
                  ✓ {fromCache ? "Cache" : "Done"} — Test Acc: {testAcc.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="space-y-3">
              <LineChart data={lossCurve}    color="#f87171"  label="Loss"        maxV={2.2} />
              <LineChart data={accCurve}     color="#a78bfa"  label="Train Acc"   maxV={1} />
              <LineChart data={valAccCurve}  color="#34d399"  label="Val Acc"     maxV={1} />
            </div>
          </div>

          {/* Results */}
          {testAcc !== null && confMatrix && (
            <div className="panel p-5">
              <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-4">Step 3 — ผลลัพธ์</div>
              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="rounded-xl p-3" style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)" }}>
                  <div className="text-xl font-black text-emerald-400">{testAcc.toFixed(1)}%</div>
                  <div className="text-[9px] text-silver/40 uppercase tracking-widest mt-0.5">Test Accuracy</div>
                </div>
                <div className="rounded-xl p-3" style={{ background:"rgba(168,85,247,0.06)", border:"1px solid rgba(168,85,247,0.2)" }}>
                  <div className="text-xl font-black text-purple-400">{data?.n ?? 0}</div>
                  <div className="text-[9px] text-silver/40 uppercase tracking-widest mt-0.5">Samples</div>
                </div>
                <div className="rounded-xl p-3" style={{ background:"rgba(245,196,81,0.06)", border:"1px solid rgba(245,196,81,0.2)" }}>
                  <div className="text-xl font-black text-gold">{epochs}</div>
                  <div className="text-[9px] text-silver/40 uppercase tracking-widest mt-0.5">Epochs</div>
                </div>
              </div>
              <ConfMatrix cm={confMatrix} />
            </div>
          )}

          {/* Current Signal */}
          {signal && (
            <div className="panel p-5">
              <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">🔮 AI Signal ตอนนี้ (XAUUSD)</div>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl font-black"
                  style={{ color: signal.decision === "BUY" ? "#34d399" : signal.decision === "SELL" ? "#f87171" : "#f5c451" }}>
                  {signal.decision}
                </div>
                <div>
                  <div className="text-sm font-bold text-silver/70">Confidence: {signal.confidence.toFixed(1)}%</div>
                  <div className="text-[10px] text-silver/30 mt-0.5">
                    {fromCache ? "จาก model ที่บันทึกไว้" : "จากโมเดลที่เพิ่งเทรนเสร็จ"}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {[["BUY",signal.buy,LABEL_COLORS[1]],["HOLD",signal.hold,LABEL_COLORS[0]],["SELL",signal.sell,LABEL_COLORS[2]]].map(([l,v,c]) => (
                  <div key={l as string} className="flex items-center gap-2">
                    <span className="w-10 text-[10px] font-bold" style={{ color: c as string }}>{l as string}</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.05)" }}>
                      <div style={{ width:`${(v as number)*100}%`, background: c as string }} className="h-full rounded-full transition-all duration-500" />
                    </div>
                    <span className="font-mono text-[10px] text-silver/50 w-10 text-right">{((v as number)*100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Backtest */}
          {predicted.length > 0 && data && (
            <div className="panel p-5">
              <AiBacktest closes={data.closes} labels={data.labels} predicted={predicted} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-base-border/10 bg-white/[0.015] p-4 text-[10px] text-silver/25 leading-relaxed">
        <b className="text-silver/40">⚠ คำเตือน:</b> ผลการเทรนนี้เป็น in-sample simulation บน historical data ·
        Overfitting เป็นไปได้สูง โดยเฉพาะถ้า accuracy สูงผิดปกติ (&gt;70%) ·
        ควร forward-test บน demo account ก่อนนำไปใช้จริง ·
        การลงทุนมีความเสี่ยง AI model ไม่ใช่การันตีกำไร
      </div>
    </div>
  );
}
