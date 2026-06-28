"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultBacktestConfig,
  defaultExtraCond,
  runBacktest,
  type BacktestConfig,
  type BacktestDirection,
  type BacktestExtraCond,
  type BacktestLogicOp,
  type BacktestLotMode,
  type BacktestResult,
  type BacktestStrategyType,
  type OHLC,
} from "@/lib/backtest";
import type { EAConfig } from "@/lib/eaBuilder";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";

// ── EA Builder → Backtester bridge ───────────────────────────────────────────

const STORE_EA_BACKTEST = "gios.eaToBacktest";

// Strategies in EA Builder that have no direct equivalent in the Backtester
const UNSUPPORTED: Record<string, BacktestStrategyType> = {
  adx_di:    "ema_cross",
  donchian:  "bb_breakout",
  williams_r:"rsi",
  engulfing: "ema_cross",
};

type EACond = EAConfig["conditions"][number];

function mapEACondToParams(c: EACond, target: { strategy: BacktestStrategyType; [k: string]: unknown }): string | undefined {
  const s = c.strategy;
  let warning: string | undefined;
  switch (s.type) {
    case "ema_cross":    target.strategy = "ema_cross"; target.fastPeriod = s.fastPeriod; target.slowPeriod = s.slowPeriod; break;
    case "sma_cross":    target.strategy = "sma_cross"; target.fastPeriod = s.fastPeriod; target.slowPeriod = s.slowPeriod; break;
    case "triple_ema":   target.strategy = "triple_ema"; target.fastPeriod = s.fast; target.midPeriod = s.mid; target.slowPeriod = s.slow; break;
    case "price_ema":    target.strategy = "price_ema"; target.fastPeriod = s.period; break;
    case "parabolic_sar":target.strategy = "parabolic_sar"; target.sarStep = s.step; target.sarMax = s.max; break;
    case "rsi":          target.strategy = "rsi"; target.rsiPeriod = s.period; target.rsiOS = s.oversold; target.rsiOB = s.overbought; break;
    case "stoch_cross":  target.strategy = "stoch"; target.stochK = s.kPeriod; target.stochD = s.dPeriod; target.stochOS = s.oversold; target.stochOB = s.overbought; break;
    case "macd":         target.strategy = "macd"; target.macdFast = s.fast; target.macdSlow = s.slow; target.macdSignal = s.signal; break;
    case "cci":          target.strategy = "cci"; target.cciPeriod = s.period; target.cciThreshold = s.threshold; break;
    case "momentum":     target.strategy = "momentum"; target.momentumPeriod = s.period; break;
    case "bb_bounce":    target.strategy = "bb_bounce"; target.bbPeriod = s.period; target.bbDev = s.deviation; break;
    case "bb_breakout":  target.strategy = "bb_breakout"; target.bbPeriod = s.period; target.bbDev = s.deviation; break;
    case "donchian":     target.strategy = "bb_breakout"; target.bbPeriod = s.period; target.bbDev = 2; warning = "Donchian → BB Breakout"; break;
    default: {
      const fallback = UNSUPPORTED[(s as { type: string }).type];
      if (fallback) { target.strategy = fallback; warning = `${(s as { type: string }).type} → ${fallback}`; }
    }
  }
  return warning;
}

function mapEAToBacktest(ea: EAConfig): { cfg: BacktestConfig; label: string; warning?: string } {
  const cfg = defaultBacktestConfig();

  cfg.direction = ea.direction as BacktestDirection;
  cfg.baseLot   = ea.lotConfig.baseLot;
  if (ea.lotConfig.mode === "martingale" || ea.lotConfig.mode === "anti_martingale") {
    cfg.lotMode       = ea.lotConfig.mode as BacktestLotMode;
    cfg.lotMultiplier = ea.lotConfig.multiplier;
    cfg.maxLotSteps   = ea.lotConfig.maxOrders;
  } else {
    cfg.lotMode = "fixed";
  }
  const PT = 0.01;
  if (ea.slConfig.type === "fixed") cfg.slPoints = Math.max(0.5, +(ea.slConfig.points * PT).toFixed(2));
  if (ea.tpConfig.type === "fixed") cfg.tpPoints = Math.max(0.5, +(ea.tpConfig.points * PT).toFixed(2));

  const enabled = ea.conditions.filter((c) => c.enabled);
  if (!enabled.length) return { cfg, label: ea.name, warning: "ไม่มีเงื่อนไขที่เปิดอยู่ — ใช้ค่า default" };

  const warnings: string[] = [];

  // Cond 1
  const w1 = mapEACondToParams(enabled[0], cfg as unknown as { strategy: BacktestStrategyType; [k: string]: unknown });
  if (w1) warnings.push(w1);

  // Cond 2
  if (enabled[1]) {
    const c2 = defaultExtraCond();
    c2.enabled = true;
    c2.logic   = "AND";
    const w2 = mapEACondToParams(enabled[1], c2 as unknown as { strategy: BacktestStrategyType; [k: string]: unknown });
    if (w2) warnings.push(w2);
    cfg.cond2 = c2;
  }

  // Cond 3
  if (enabled[2]) {
    const c3 = defaultExtraCond();
    c3.enabled = true;
    c3.logic   = "AND";
    const w3 = mapEACondToParams(enabled[2], c3 as unknown as { strategy: BacktestStrategyType; [k: string]: unknown });
    if (w3) warnings.push(w3);
    cfg.cond3 = c3;
  }

  return { cfg, label: ea.name, warning: warnings.length ? warnings.join(", ") : undefined };
}

// ── Strategy meta ─────────────────────────────────────────────────────────────

const STRATEGY_OPTS: { value: BacktestStrategyType; label: string; cat: string }[] = [
  { value: "ema_cross",     label: "EMA Cross",         cat: "Trend" },
  { value: "sma_cross",     label: "SMA Cross",         cat: "Trend" },
  { value: "triple_ema",    label: "Triple EMA",        cat: "Trend" },
  { value: "price_ema",     label: "Price vs EMA",      cat: "Trend" },
  { value: "parabolic_sar", label: "Parabolic SAR",     cat: "Trend" },
  { value: "rsi",           label: "RSI OB/OS",         cat: "Oscillator" },
  { value: "macd",          label: "MACD Cross",        cat: "Oscillator" },
  { value: "stoch",         label: "Stochastic Cross",  cat: "Oscillator" },
  { value: "cci",           label: "CCI",               cat: "Oscillator" },
  { value: "momentum",      label: "Momentum",          cat: "Oscillator" },
  { value: "bb_bounce",     label: "BB Bounce",         cat: "Volatility" },
  { value: "bb_breakout",   label: "BB Breakout",       cat: "Volatility" },
];

const CATS = ["Trend", "Oscillator", "Volatility"];

// ── Equity Curve SVG ──────────────────────────────────────────────────────────

function EquityCurve({ data, initial }: { data: { time: number; balance: number }[]; initial: number }) {
  if (data.length < 2) return <div className="flex items-center justify-center h-40 text-silver/30 text-sm">ยังไม่มีข้อมูล</div>;

  const W = 800, H = 200, PAD = 40;
  const vals = data.map((d) => d.balance);
  const minV = Math.min(...vals, initial * 0.9);
  const maxV = Math.max(...vals, initial * 1.1);
  const range = maxV - minV || 1;

  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (d.balance - minV) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });

  const fillPts = [`${PAD},${H - PAD}`, ...pts, `${W - PAD},${H - PAD}`].join(" ");
  const final = vals[vals.length - 1];
  const isProfit = final >= initial;
  const lineColor = isProfit ? "#f0b429" : "#f87171";
  const fillId = isProfit ? "grad-profit" : "grad-loss";

  // Grid lines (4 horizontal)
  const gridLines = [0, 0.33, 0.66, 1].map((pct) => {
    const y = PAD + pct * (H - PAD * 2);
    const val = maxV - pct * range;
    return { y, label: `$${val.toFixed(0)}` };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0b429" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f0b429" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="grad-loss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f87171" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={PAD} y1={g.y} x2={W - PAD} y2={g.y} stroke="white" strokeOpacity="0.05" strokeDasharray="4,4" />
          <text x={PAD - 4} y={g.y + 4} textAnchor="end" fill="#666" fontSize="11">{g.label}</text>
        </g>
      ))}
      {/* Base line */}
      {(() => {
        const baseY = PAD + (1 - (initial - minV) / range) * (H - PAD * 2);
        return <line x1={PAD} y1={baseY} x2={W - PAD} y2={baseY} stroke="white" strokeOpacity="0.15" strokeDasharray="6,3" />;
      })()}
      {/* Fill */}
      <polygon points={fillPts} fill={`url(#${fillId})`} />
      {/* Line */}
      <polyline points={pts.join(" ")} fill="none" stroke={lineColor} strokeWidth="2" />
      {/* Current dot */}
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="4" fill={lineColor} />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-silver" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="panel p-3 flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-widest text-silver/40">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-silver/30">{sub}</div>}
    </div>
  );
}

// ── Param input ───────────────────────────────────────────────────────────────

function PNum({ label, k, cfg, set, step = 1, min = 1 }: {
  label: string; k: keyof BacktestConfig; cfg: BacktestConfig;
  set: (p: Partial<BacktestConfig>) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-silver/40">{label}</label>
      <input type="number" step={step} min={min} value={cfg[k] as number}
        onChange={(e) => set({ [k]: parseFloat(e.target.value) || min } as Partial<BacktestConfig>)}
        className="w-full rounded border border-base-border bg-base-black px-2 py-1 text-xs text-silver focus:border-gold/40 focus:outline-none" />
    </div>
  );
}

// ── Strategy params — shared between BacktestConfig and BacktestExtraCond ──────

type AnyStratP = BacktestConfig | BacktestExtraCond;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StrategyParams({ cfg, set }: { cfg: AnyStratP; set: (p: any) => void }) {
  const num = (label: string, k: string, step = 1, min = 1) => (
    <div key={k} className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-silver/40">{label}</label>
      <input type="number" step={step} min={min} value={v[k] as number}
        onChange={(e) => set({ [k]: parseFloat(e.target.value) || min })}
        className="w-full rounded border border-base-border bg-base-black px-2 py-1 text-xs text-silver focus:border-gold/40 focus:outline-none" />
    </div>
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = cfg as any;
  switch (cfg.strategy) {
    case "ema_cross":     return <div className="grid grid-cols-2 gap-2">{num("Fast EMA","fastPeriod")}{num("Slow EMA","slowPeriod")}</div>;
    case "sma_cross":     return <div className="grid grid-cols-2 gap-2">{num("Fast SMA","fastPeriod")}{num("Slow SMA","slowPeriod")}</div>;
    case "triple_ema":    return <div className="grid grid-cols-3 gap-2">{num("Fast","fastPeriod")}{num("Mid","midPeriod")}{num("Slow","slowPeriod")}</div>;
    case "price_ema":     return <div className="grid grid-cols-2 gap-2">{num("EMA Period","fastPeriod")}</div>;
    case "parabolic_sar": return <div className="grid grid-cols-2 gap-2">{num("Step","sarStep",0.01,0.001)}{num("Max","sarMax",0.05,0.05)}</div>;
    case "rsi":           return <div className="grid grid-cols-3 gap-2">{num("Period","rsiPeriod")}{num("Oversold","rsiOS")}{num("Overbought","rsiOB")}</div>;
    case "macd":          return <div className="grid grid-cols-3 gap-2">{num("Fast","macdFast")}{num("Slow","macdSlow")}{num("Signal","macdSignal")}</div>;
    case "stoch":         return <div className="grid grid-cols-3 gap-2">{num("%K","stochK")}{num("%D","stochD")}{num("OS","stochOS")}</div>;
    case "cci":           return <div className="grid grid-cols-2 gap-2">{num("Period","cciPeriod")}{num("Threshold ±","cciThreshold")}</div>;
    case "momentum":      return <div className="grid grid-cols-2 gap-2">{num("Period","momentumPeriod")}</div>;
    case "bb_bounce":
    case "bb_breakout":   return <div className="grid grid-cols-2 gap-2">{num("Period","bbPeriod")}{num("Deviation","bbDev",0.1,0.1)}</div>;
    default:              return null;
  }
}

// ── Extra condition slot (cond2 / cond3) ─────────────────────────────────────

function CondSlot({ label, cond, onChange, color }: {
  label: string;
  cond: BacktestExtraCond;
  onChange: (c: BacktestExtraCond) => void;
  color: string;
}) {
  const set = (patch: Partial<BacktestExtraCond>) => onChange({ ...cond, ...patch });
  return (
    <div className={`rounded-xl border ${cond.enabled ? color : "border-base-border/30"} bg-base-panel/40 p-3 space-y-2 transition-all`}>
      <div className="flex items-center gap-2">
        <button onClick={() => set({ enabled: !cond.enabled })}
          className={`relative h-5 w-9 rounded-full transition-colors ${cond.enabled ? "bg-gold/60" : "bg-base-border"}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${cond.enabled ? "left-4" : "left-0.5"}`} />
        </button>
        <span className="text-xs font-semibold text-silver/70">{label}</span>
        {cond.enabled && (
          <div className="ml-auto flex gap-1">
            {(["AND", "OR"] as BacktestLogicOp[]).map((op) => (
              <button key={op} onClick={() => set({ logic: op })}
                className={`rounded px-2 py-0.5 text-[10px] font-bold border transition-colors ${cond.logic === op ? "bg-gold/20 text-gold border-gold/40" : "border-base-border text-silver/30 hover:text-silver"}`}>
                {op}
              </button>
            ))}
          </div>
        )}
      </div>
      {cond.enabled && (
        <div className="space-y-2">
          <select value={cond.strategy} onChange={(e) => set({ strategy: e.target.value as BacktestStrategyType })}
            className="w-full rounded border border-base-border bg-base-black px-2 py-1.5 text-xs text-silver focus:border-gold/40 focus:outline-none">
            {CATS.map((cat) => (
              <optgroup key={cat} label={`── ${cat} ──`}>
                {STRATEGY_OPTS.filter((s) => s.cat === cat).map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <StrategyParams cfg={cond} set={(p) => onChange({ ...cond, ...p })} />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TfKey = "1d" | "1h" | "4h";

const TF_META: { value: TfKey; label: string; ranges: { value: string; label: string }[] }[] = [
  {
    value: "1d",
    label: "Daily",
    ranges: [
      { value: "6mo", label: "6 เดือน" },
      { value: "1y",  label: "1 ปี" },
      { value: "2y",  label: "2 ปี" },
    ],
  },
  {
    value: "1h",
    label: "H1 (1 ชั่วโมง)",
    ranges: [
      { value: "1mo", label: "1 เดือน" },
      { value: "3mo", label: "3 เดือน" },
      { value: "6mo", label: "6 เดือน" },
    ],
  },
  {
    value: "4h",
    label: "H4 (4 ชั่วโมง)",
    ranges: [
      { value: "1mo", label: "1 เดือน" },
      { value: "3mo", label: "3 เดือน" },
      { value: "6mo", label: "6 เดือน" },
    ],
  },
];

export default function BacktestPage() {
  const [cfg, setCfg]       = useState<BacktestConfig>(defaultBacktestConfig());
  const [ohlc, setOhlc]     = useState<OHLC[]>([]);
  const [tf, setTf]         = useState<TfKey>("1d");
  const [range, setRange]   = useState("1y");
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState("");
  const [showTrades, setShowTrades] = useState(false);
  const [eaBanner, setEaBanner] = useState<{ name: string; warning?: string } | null>(null);

  // Auto-load config sent from EA Builder
  useEffect(() => {
    const raw = localStorage.getItem(STORE_EA_BACKTEST);
    if (!raw) return;
    localStorage.removeItem(STORE_EA_BACKTEST);
    try {
      const ea = JSON.parse(raw) as EAConfig;
      const { cfg: mapped, label, warning } = mapEAToBacktest(ea);
      setCfg(mapped);
      setEaBanner({ name: label, warning });
    } catch { /* ignore malformed data */ }
  }, []);

  const set = (patch: Partial<BacktestConfig>) => setCfg((c) => ({ ...c, ...patch }));

  const tfMeta = TF_META.find((t) => t.value === tf)!;

  // When TF changes, reset range to first valid option
  const handleTfChange = (newTf: TfKey) => {
    setTf(newTf);
    const meta = TF_META.find((t) => t.value === newTf)!;
    setRange(meta.ranges[1]?.value ?? meta.ranges[0].value);
  };

  // Fetch historical data
  useEffect(() => {
    setLoading(true);
    setFetchErr("");
    fetch(`/api/backtest?range=${range}&interval=${tf}`)
      .then((r) => r.json())
      .then((d) => { if (d.ohlc) setOhlc(d.ohlc); else setFetchErr(d.error ?? "Failed"); })
      .catch((e) => setFetchErr(String(e)))
      .finally(() => setLoading(false));
  }, [range, tf]);

  // Run backtest whenever cfg or ohlc changes
  const result: BacktestResult = useMemo(() => {
    if (ohlc.length < 30) return {
      trades: [], equity: [cfg.initialBalance], balanceCurve: [{ time: 0, balance: cfg.initialBalance }],
      totalPnl: 0, winRate: 0, profitFactor: 0, maxDrawdown: 0, sharpeRatio: 0,
      totalTrades: 0, wins: 0, losses: 0, avgWin: 0, avgLoss: 0, expectancy: 0, maxConsecLosses: 0,
    };
    return runBacktest(ohlc, cfg);
  }, [ohlc, cfg]);

  const inputCls = "w-full rounded-lg border border-base-border bg-base-panel px-3 py-1.5 text-sm text-silver focus:border-gold/40 focus:outline-none";
  const labelCls = "block text-[11px] uppercase tracking-widest text-silver/40 mb-1";
  const finalBal = result.equity[result.equity.length - 1] ?? cfg.initialBalance;
  const pnlColor = result.totalPnl >= 0 ? "text-emerald-400" : "text-red-400";

  const fmt = (n: number, dp = 2) => (n >= 0 ? "+" : "") + n.toFixed(dp);
  const fmtUSD = (n: number) => "$" + Math.abs(n).toFixed(2);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Strategy Backtester"
        subtitle="ทดสอบ strategy บนข้อมูลจริง XAUUSD Daily — ผลลัพธ์เปลี่ยนทันทีเมื่อปรับ parameter" />

      {/* EA Builder import banner */}
      {eaBanner && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <span className="text-lg">📊</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-emerald-300">
              โหลดจาก EA Builder: <span className="text-emerald-200">{eaBanner.name}</span>
            </div>
            {eaBanner.warning && (
              <div className="mt-0.5 text-[11px] text-amber-400">⚠ {eaBanner.warning}</div>
            )}
            <div className="mt-0.5 text-[11px] text-emerald-400/60">
              Strategy, SL/TP และ Lot mapping โหลดอัตโนมัติจาก EA ที่สร้าง — ปรับได้ด้านซ้าย
            </div>
          </div>
          <button onClick={() => setEaBanner(null)}
            className="text-silver/30 hover:text-silver/60 transition-colors text-lg leading-none">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

        {/* ── Left config ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] pr-1 [scrollbar-width:thin]">

          {/* Timeframe + Period */}
          <div className="panel p-4 space-y-3">
            <div className="stat-label">ไทม์เฟรม</div>
            <div className="flex gap-2">
              {TF_META.map((m) => (
                <button key={m.value} onClick={() => handleTfChange(m.value)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${tf === m.value ? "border-gold/60 bg-gold/15 text-gold" : "border-base-border text-silver/40 hover:text-silver"}`}>
                  {m.value === "1d" ? "Daily" : m.value.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="stat-label">ช่วงเวลา</div>
            <div className="flex gap-2">
              {tfMeta.ranges.map((r) => (
                <button key={r.value} onClick={() => setRange(r.value)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${range === r.value ? "border-gold/60 bg-gold/15 text-gold" : "border-base-border text-silver/40 hover:text-silver"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {ohlc.length > 0 && (
              <p className="text-[10px] text-silver/30">
                {ohlc.length} bars · {new Date(ohlc[0].time * 1000).toLocaleDateString("th-TH")} – {new Date(ohlc[ohlc.length - 1].time * 1000).toLocaleDateString("th-TH")}
              </p>
            )}
          </div>

          {/* Entry Conditions x3 */}
          <div className="panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="stat-label">เงื่อนไขเข้าไม้</div>
              <span className="text-[10px] text-silver/30">เงื่อนไข 2–3 ใช้ AND/OR รวมสัญญาณ</span>
            </div>

            {/* Cond 1 — always active */}
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gold" />
                <span className="text-xs font-semibold text-silver/70">เงื่อนไขที่ 1 (หลัก)</span>
              </div>
              <select value={cfg.strategy} onChange={(e) => set({ strategy: e.target.value as BacktestStrategyType })}
                className="w-full rounded border border-base-border bg-base-black px-2 py-1.5 text-xs text-silver focus:border-gold/40 focus:outline-none">
                {CATS.map((cat) => (
                  <optgroup key={cat} label={`── ${cat} ──`}>
                    {STRATEGY_OPTS.filter((s) => s.cat === cat).map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <StrategyParams cfg={cfg} set={set} />
            </div>

            {/* Cond 2 */}
            <CondSlot label="เงื่อนไขที่ 2" cond={cfg.cond2} color="border-royal/40 bg-royal/5"
              onChange={(c) => set({ cond2: c })} />

            {/* Cond 3 */}
            <CondSlot label="เงื่อนไขที่ 3" cond={cfg.cond3} color="border-emerald-500/40 bg-emerald-500/5"
              onChange={(c) => set({ cond3: c })} />

            {/* Direction */}
            <div>
              <label className={labelCls}>ทิศทาง</label>
              <div className="flex gap-1">
                {([["both","ทั้งคู่"],["buy_only","Buy"],["sell_only","Sell"]] as [BacktestDirection, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => set({ direction: v })}
                    className={`flex-1 rounded border py-1.5 text-xs transition-colors ${cfg.direction === v ? "border-gold/50 bg-gold/10 text-gold" : "border-base-border text-silver/40 hover:text-silver"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SL / TP */}
          <div className="panel p-4 space-y-3">
            <div className="stat-label">SL / TP (USD per oz)</div>
            <div className="grid grid-cols-2 gap-2">
              <PNum label="Stop Loss ($)" k="slPoints" cfg={cfg} set={set} step={0.5} min={0.5} />
              <PNum label="Take Profit ($)" k="tpPoints" cfg={cfg} set={set} step={0.5} min={0.5} />
            </div>
            <p className="text-[10px] text-silver/30">
              R:R = 1:{(cfg.tpPoints / cfg.slPoints).toFixed(2)} · SL ${cfg.slPoints} = {(cfg.slPoints * 100).toFixed(0)} pts MT4
            </p>
          </div>

          {/* Lot */}
          <div className="panel p-4 space-y-3">
            <div className="stat-label">Lot Management</div>
            <div>
              <label className={labelCls}>Lot Mode</label>
              <div className="flex flex-col gap-1">
                {(["fixed","martingale","anti_martingale"] as BacktestLotMode[]).map((m) => (
                  <button key={m} onClick={() => set({ lotMode: m })}
                    className={`rounded border px-3 py-1.5 text-left text-xs transition-colors ${cfg.lotMode === m
                      ? m==="fixed"?"border-gold/50 bg-gold/10 text-gold":m==="martingale"?"border-red-500/50 bg-red-500/10 text-red-400":"border-royal/50 bg-royal/10 text-royal"
                      : "border-base-border text-silver/40 hover:text-silver"}`}>
                    {m === "fixed" ? "Fixed Lot" : m === "martingale" ? "Martingale (×N after loss)" : "Lot Plus (×N after win)"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PNum label="Base Lot" k="baseLot" cfg={cfg} set={set} step={0.01} min={0.01} />
              {cfg.lotMode !== "fixed" && <PNum label="Multiplier" k="lotMultiplier" cfg={cfg} set={set} step={0.5} min={1} />}
              {cfg.lotMode !== "fixed" && <PNum label="Max Steps" k="maxLotSteps" cfg={cfg} set={set} step={1} min={1} />}
            </div>
            <PNum label="Initial Balance ($)" k="initialBalance" cfg={cfg} set={set} step={1000} min={1000} />
          </div>
        </div>

        {/* ── Right results ───────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {loading && (
            <div className="panel p-6 text-center text-silver/40 text-sm animate-pulse">
              กำลังโหลดข้อมูล XAUUSD historical…
            </div>
          )}
          {fetchErr && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
              {fetchErr}
            </div>
          )}

          {!loading && !fetchErr && (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total P&L"
                  value={`${result.totalPnl >= 0 ? "+" : ""}$${result.totalPnl.toFixed(2)}`}
                  sub={`Balance: $${finalBal.toFixed(2)}`}
                  color={pnlColor} />
                <StatCard label="Win Rate"
                  value={`${(result.winRate * 100).toFixed(1)}%`}
                  sub={`${result.wins}W / ${result.losses}L · ${result.totalTrades} trades`}
                  color={result.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"} />
                <StatCard label="Profit Factor"
                  value={result.profitFactor >= 999 ? "∞" : result.profitFactor.toFixed(2)}
                  sub={`Avg W: $${result.avgWin.toFixed(1)} / L: $${result.avgLoss.toFixed(1)}`}
                  color={result.profitFactor >= 1.5 ? "text-emerald-400" : result.profitFactor >= 1 ? "text-gold" : "text-red-400"} />
                <StatCard label="Max Drawdown"
                  value={`${result.maxDrawdown.toFixed(1)}%`}
                  sub={`Sharpe: ${result.sharpeRatio.toFixed(2)} · MaxL: ${result.maxConsecLosses}`}
                  color={result.maxDrawdown > 30 ? "text-red-400" : result.maxDrawdown > 15 ? "text-amber-400" : "text-emerald-400"} />
              </div>

              {/* Expectancy banner */}
              <div className={`panel p-3 flex items-center gap-3 border ${result.expectancy >= 0 ? "border-emerald-500/20" : "border-red-500/20"}`}>
                <span className="text-2xl">{result.expectancy >= 0 ? "📈" : "📉"}</span>
                <div>
                  <div className="text-xs font-semibold text-silver/70">
                    Expectancy: <span className={result.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}>${result.expectancy.toFixed(2)} ต่อ trade</span>
                  </div>
                  <div className="text-[10px] text-silver/40">
                    R:R = 1:{(cfg.tpPoints / cfg.slPoints).toFixed(2)} · ต้องการ Win Rate ≥ {(cfg.slPoints / (cfg.slPoints + cfg.tpPoints) * 100).toFixed(1)}% เพื่อ Breakeven
                  </div>
                </div>
              </div>

              {/* Equity Curve */}
              <div className="panel p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="stat-label">Equity Curve</div>
                  <span className={`text-xs font-mono font-semibold ${pnlColor}`}>
                    {fmt(((finalBal - cfg.initialBalance) / cfg.initialBalance) * 100, 1)}%
                  </span>
                </div>
                <EquityCurve data={result.balanceCurve} initial={cfg.initialBalance} />
              </div>

              {/* Trades */}
              {result.totalTrades > 0 && (
                <div className="panel p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="stat-label">Trade Log ({result.totalTrades} trades)</div>
                    <button onClick={() => setShowTrades((v) => !v)}
                      className="text-[10px] text-silver/40 hover:text-silver transition-colors">
                      {showTrades ? "ซ่อน ▲" : "แสดง ▼"}
                    </button>
                  </div>

                  {showTrades && (
                    <div className="overflow-x-auto rounded-lg border border-base-border/50">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-base-border/60 bg-base-black/40">
                            {["#","วันที่","Dir","Entry","Exit","SL","TP","Lot","P&L","เหตุผล"].map((h) => (
                              <th key={h} className="px-2 py-2 text-left font-medium text-silver/40">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.trades.slice(-50).reverse().map((t, i) => (
                            <tr key={i} className={`border-b border-base-border/20 ${t.pnl > 0 ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                              <td className="px-2 py-1.5 text-silver/40">{result.trades.length - i}</td>
                              <td className="px-2 py-1.5 text-silver/50">{new Date(t.time * 1000).toLocaleDateString("th-TH", { day:"2-digit", month:"2-digit" })}</td>
                              <td className={`px-2 py-1.5 font-semibold ${t.direction === "buy" ? "text-emerald-400" : "text-red-400"}`}>{t.direction.toUpperCase()}</td>
                              <td className="px-2 py-1.5 font-mono text-silver/70">{t.entry.toFixed(2)}</td>
                              <td className="px-2 py-1.5 font-mono text-silver/70">{t.exit.toFixed(2)}</td>
                              <td className="px-2 py-1.5 font-mono text-red-400/70">{t.sl.toFixed(2)}</td>
                              <td className="px-2 py-1.5 font-mono text-emerald-400/70">{t.tp.toFixed(2)}</td>
                              <td className="px-2 py-1.5 font-mono text-silver/50">{t.lot.toFixed(2)}</td>
                              <td className={`px-2 py-1.5 font-mono font-semibold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                              </td>
                              <td className={`px-2 py-1.5 ${t.exitReason === "tp" ? "text-emerald-400/70" : t.exitReason === "sl" ? "text-red-400/70" : "text-silver/30"}`}>
                                {t.exitReason === "tp" ? "TP ✓" : t.exitReason === "sl" ? "SL ✗" : "จบ"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {result.trades.length > 50 && (
                        <div className="px-3 py-2 text-[10px] text-silver/30">แสดง 50 trades ล่าสุด จากทั้งหมด {result.trades.length}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {result.totalTrades === 0 && !loading && (
                <div className="panel p-6 text-center text-silver/40 text-sm">
                  ไม่มี trade เกิดขึ้น — ลองปรับ strategy parameter หรือเปลี่ยน strategy
                </div>
              )}
            </>
          )}

          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
