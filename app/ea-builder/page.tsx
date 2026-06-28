"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultConfig,
  generateCode,
  getFileExtension,
  LOT_MODE_META,
  STRATEGY_CATEGORIES,
  STRATEGY_DEFAULTS,
  STRATEGY_META,
  TF_OPTIONS,
  type Direction,
  type EAConfig,
  type EntryCondition,
  type Language,
  type LotConfig,
  type LotMode,
  type LogicOp,
  type SlType,
  type StrategyConfig,
  type StrategyType,
  type TpType,
} from "@/lib/eaBuilder";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";

// ── Syntax highlight ──────────────────────────────────────────────────────────

function highlight(code: string): string {
  const e = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return e.split("\n").map((line) => {
    if (/^\s*\/\//.test(line)) return `<span style="color:#6a9955">${line}</span>`;
    let l = line.replace(/(\/\/[^<]*)/, '<span style="color:#6a9955">$1</span>');
    l = l.replace(/"([^"]*)"/g, '<span style="color:#ce9178">"$1"</span>');
    l = l.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#b5cea8">$1</span>');
    l = l.replace(/#(property|include|define)\b/g, '<span style="color:#c586c0">#$1</span>');
    l = l.replace(/\b(input|extern|void|int|double|bool|string|return|if|else|for|while|true|false|NULL|static|datetime|ulong|long)\b/g, '<span style="color:#569cd6">$1</span>');
    l = l.replace(/\b(iMA|iRSI|iMACD|iBands|iStochastic|iCCI|iWPR|iMomentum|iSAR|iADX|iATR|iHighest|iLowest|OrderSend|OrderSelect|OrderModify|OrderClose|CTrade|CopyBuffer|CopyClose|CopyOpen|CopyHigh|CopyLow|PositionGetTicket|NormalizeDouble|IndicatorRelease|Print|ArraySetAsSeries|ArrayMaximum|ArrayMinimum|ArrayResize|HistorySelect|HistoryDealGetTicket|HistoryDealGetString|HistoryDealGetInteger|HistoryDealGetDouble|HistoryDealsTotal|AccountInfoDouble|SymbolInfoDouble|MarketInfo|AccountBalance)\b/g, '<span style="color:#4ec9b0">$1</span>');
    l = l.replace(/\b(INIT_SUCCEEDED|INIT_FAILED|INVALID_HANDLE|OP_BUY|OP_SELL|SELECT_BY_POS|MODE_TRADES|MODE_HISTORY|MODE_EMA|MODE_SMA|MODE_MAIN|MODE_SIGNAL|MODE_UPPER|MODE_LOWER|MODE_SMA|MODE_PLUSDI|MODE_MINUSDI|PRICE_CLOSE|PRICE_TYPICAL|PERIOD_CURRENT|DBL_MAX|POSITION_MAGIC|POSITION_SYMBOL|POSITION_TYPE|POSITION_TYPE_BUY|POSITION_TYPE_SELL|POSITION_PRICE_OPEN|POSITION_SL|POSITION_TP|SYMBOL_ASK|SYMBOL_BID|SYMBOL_TRADE_TICK_VALUE|SYMBOL_TRADE_TICK_SIZE|SYMBOL_VOLUME_MIN|STO_LOWHIGH|DEAL_SYMBOL|DEAL_MAGIC|DEAL_PROFIT|ACCOUNT_BALANCE|MODE_LOW|MODE_HIGH|clrDodgerBlue|clrOrangeRed|clrGreen|clrRed|clrGray)\b/g, '<span style="color:#9cdcfe">$1</span>');
    return l;
  }).join("\n");
}

// ── Strategy params editor ────────────────────────────────────────────────────

function StrategyParams({ s, onChange }: { s: StrategyConfig; onChange: (s: StrategyConfig) => void }) {
  const num = (label: string, key: string, step = 1, min = 1) => {
    const val = (s as Record<string, unknown>)[key] as number;
    return (
      <div key={key} className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-silver/40">{label}</label>
        <input type="number" step={step} min={min} value={val}
          onChange={(e) => onChange({ ...s, [key]: parseFloat(e.target.value) || min } as StrategyConfig)}
          className="w-full rounded border border-base-border bg-base-black px-2 py-1 text-xs text-silver focus:border-gold/40 focus:outline-none" />
      </div>
    );
  };
  switch (s.type) {
    case "ema_cross":     return <div className="grid grid-cols-2 gap-2">{num("Fast EMA","fastPeriod")}{num("Slow EMA","slowPeriod")}</div>;
    case "sma_cross":     return <div className="grid grid-cols-2 gap-2">{num("Fast SMA","fastPeriod")}{num("Slow SMA","slowPeriod")}</div>;
    case "triple_ema":    return <div className="grid grid-cols-3 gap-2">{num("Fast","fast")}{num("Mid","mid")}{num("Slow","slow")}</div>;
    case "price_ema":     return <div className="grid grid-cols-2 gap-2">{num("EMA Period","period")}</div>;
    case "parabolic_sar": return <div className="grid grid-cols-2 gap-2">{num("Step","step",0.01,0.01)}{num("Max","max",0.1,0.1)}</div>;
    case "adx_di":        return <div className="grid grid-cols-2 gap-2">{num("ADX Period","period")}{num("Min ADX","minAdx")}</div>;
    case "rsi":           return <div className="grid grid-cols-3 gap-2">{num("Period","period")}{num("Oversold","oversold")}{num("Overbought","overbought")}</div>;
    case "stoch_cross":   return <div className="grid grid-cols-3 gap-2">{num("%K","kPeriod")}{num("%D","dPeriod")}{num("Slow","slowing")}{num("OS","oversold")}{num("OB","overbought")}</div>;
    case "macd":          return <div className="grid grid-cols-3 gap-2">{num("Fast","fast")}{num("Slow","slow")}{num("Signal","signal")}</div>;
    case "cci":           return <div className="grid grid-cols-2 gap-2">{num("Period","period")}{num("Threshold ±","threshold")}</div>;
    case "williams_r":    return <div className="grid grid-cols-3 gap-2">{num("Period","period")}{num("OS level","oversold",-1,-100)}{num("OB level","overbought",-1,-100)}</div>;
    case "momentum":      return <div className="grid grid-cols-2 gap-2">{num("Period","period")}</div>;
    case "bb_bounce":
    case "bb_breakout":   return <div className="grid grid-cols-2 gap-2">{num("Period","period")}{num("Deviation","deviation",0.1,0.1)}</div>;
    case "donchian":      return <div className="grid grid-cols-2 gap-2">{num("Period","period")}</div>;
    case "engulfing":     return <p className="text-[10px] text-silver/35 italic">ไม่มี parameter — ใช้ raw candle OHLC</p>;
    default:              return null;
  }
}

// ── Strategy dropdown (grouped by category) ───────────────────────────────────

function StrategySelect({ value, onChange }: { value: StrategyType; onChange: (t: StrategyType) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as StrategyType)}
      className="w-full rounded border border-base-border bg-base-black px-2 py-1.5 text-xs text-silver focus:border-gold/40 focus:outline-none">
      {STRATEGY_CATEGORIES.map((cat) => (
        <optgroup key={cat} label={`── ${cat} ──`}>
          {(Object.entries(STRATEGY_META) as [StrategyType, { label: string; category: string }][])
            .filter(([, v]) => v.category === cat)
            .map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Single condition slot ────────────────────────────────────────────────────

function ConditionSlot({ index, cond, onChange }: { index: number; cond: EntryCondition; onChange: (c: EntryCondition) => void }) {
  const badges = [
    "border-gold/40 bg-gold/5",
    "border-royal/40 bg-royal/5",
    "border-emerald-500/40 bg-emerald-500/5",
  ];
  const dots = ["bg-gold", "bg-royal", "bg-emerald-500"];
  const label = ["เงื่อนไขที่ 1", "เงื่อนไขที่ 2", "เงื่อนไขที่ 3"][index];

  return (
    <div className={`rounded-xl border ${cond.enabled ? badges[index] : "border-base-border/30"} bg-base-panel/40 p-3 transition-all`}>
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => onChange({ ...cond, enabled: !cond.enabled })}
          className={`relative h-5 w-9 rounded-full transition-colors ${cond.enabled ? "bg-gold/60" : "bg-base-border"}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${cond.enabled ? "left-4" : "left-0.5"}`} />
        </button>
        <span className={`h-2 w-2 rounded-full ${cond.enabled ? dots[index] : "bg-silver/20"}`} />
        <span className="text-xs font-semibold text-silver/70">{label}</span>
        {index > 0 && cond.enabled && (
          <div className="ml-auto flex gap-1">
            {(["AND","OR"] as LogicOp[]).map((op) => (
              <button key={op} onClick={() => onChange({ ...cond, logic: op })}
                className={`rounded px-2 py-0.5 text-[10px] font-bold border transition-colors ${cond.logic===op ? "bg-gold/20 text-gold border-gold/40" : "border-base-border text-silver/30 hover:text-silver"}`}>
                {op}
              </button>
            ))}
          </div>
        )}
      </div>
      {cond.enabled && (
        <div className="space-y-2">
          <StrategySelect value={cond.strategy.type}
            onChange={(t) => onChange({ ...cond, strategy: STRATEGY_DEFAULTS[t] })} />
          <p className="text-[10px] text-silver/30">{STRATEGY_META[cond.strategy.type].desc}</p>
          <StrategyParams s={cond.strategy}
            onChange={(s) => onChange({ ...cond, strategy: s })} />
        </div>
      )}
    </div>
  );
}

// ── TP / SL panel ────────────────────────────────────────────────────────────

function TpSlPanel({ cfg, onChange }: { cfg: EAConfig; onChange: (c: EAConfig) => void }) {
  const ni = (label: string, val: number, onCh: (v: number) => void, step = 1, min = 1) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-silver/40">{label}</label>
      <input type="number" step={step} min={min} value={val} onChange={(e) => onCh(parseFloat(e.target.value)||min)}
        className="w-full rounded border border-base-border bg-base-black px-2 py-1 text-xs text-silver focus:border-gold/40 focus:outline-none" />
    </div>
  );
  const TP_OPTS: { value: TpType; label: string; desc: string }[] = [
    { value:"fixed",    label:"Fixed pts", desc:"TP คงที่เป็น points" },
    { value:"atr_mult", label:"ATR × N",  desc:"TP = ATR × ตัวคูณ (adaptive)" },
    { value:"no_tp",    label:"ไม่มี TP", desc:"ออกด้วย Trailing หรือ manual" },
  ];
  const SL_OPTS: { value: SlType; label: string; desc: string }[] = [
    { value:"fixed",    label:"Fixed pts",  desc:"SL คงที่เป็น points" },
    { value:"atr_mult", label:"ATR × N",   desc:"SL = ATR × ตัวคูณ" },
    { value:"swing_hl", label:"Swing H/L", desc:"SL วาง beyond Swing High/Low" },
  ];
  const { tpConfig:tp, slConfig:sl } = cfg;
  return (
    <div className="space-y-3">
      {/* TP */}
      <div className="rounded-lg border border-base-border/50 bg-base-panel/40 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Take Profit</div>
        <div className="grid grid-cols-3 gap-1">
          {TP_OPTS.map(o=>(
            <button key={o.value} onClick={()=>onChange({...cfg,tpConfig:{...tp,type:o.value}})}
              className={`rounded border py-1.5 text-[10px] font-medium transition-colors ${tp.type===o.value?"border-emerald-500/50 bg-emerald-500/15 text-emerald-400":"border-base-border text-silver/30 hover:text-silver"}`}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-silver/30">{TP_OPTS.find(o=>o.value===tp.type)?.desc}</p>
        <div className="grid grid-cols-2 gap-2">
          {tp.type==="fixed"    && ni("TP (points)",tp.points,   v=>onChange({...cfg,tpConfig:{...tp,points:v}}))}
          {tp.type==="atr_mult" && ni("ATR Period", tp.atrPeriod,v=>onChange({...cfg,tpConfig:{...tp,atrPeriod:v}}))}
          {tp.type==="atr_mult" && ni("Multiplier", tp.atrMult,  v=>onChange({...cfg,tpConfig:{...tp,atrMult:v}}),0.5,0.5)}
        </div>
      </div>
      {/* SL */}
      <div className="rounded-lg border border-base-border/50 bg-base-panel/40 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-red-400/70">Stop Loss</div>
        <div className="grid grid-cols-3 gap-1">
          {SL_OPTS.map(o=>(
            <button key={o.value} onClick={()=>onChange({...cfg,slConfig:{...sl,type:o.value}})}
              className={`rounded border py-1.5 text-[10px] font-medium transition-colors ${sl.type===o.value?"border-red-500/50 bg-red-500/15 text-red-400":"border-base-border text-silver/30 hover:text-silver"}`}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-silver/30">{SL_OPTS.find(o=>o.value===sl.type)?.desc}</p>
        <div className="grid grid-cols-2 gap-2">
          {sl.type==="fixed"    && ni("SL (points)",    sl.points,        v=>onChange({...cfg,slConfig:{...sl,points:v}}))}
          {sl.type==="atr_mult" && ni("ATR Period",     sl.atrPeriod,     v=>onChange({...cfg,slConfig:{...sl,atrPeriod:v}}))}
          {sl.type==="atr_mult" && ni("Multiplier",     sl.atrMult,       v=>onChange({...cfg,slConfig:{...sl,atrMult:v}}),0.5,0.5)}
          {sl.type==="swing_hl" && ni("Lookback (bars)",sl.swingLookback, v=>onChange({...cfg,slConfig:{...sl,swingLookback:v}}))}
          {sl.type==="swing_hl" && ni("Buffer (pts)",   sl.swingBuffer,   v=>onChange({...cfg,slConfig:{...sl,swingBuffer:v}}))}
        </div>
      </div>
    </div>
  );
}

// ── Lot Management panel ──────────────────────────────────────────────────────

function LotPanel({ cfg, onChange }: { cfg: EAConfig; onChange: (c: EAConfig) => void }) {
  const lc = cfg.lotConfig;
  const set = (patch: Partial<LotConfig>) => onChange({ ...cfg, lotConfig: { ...lc, ...patch } });
  const ni = (label: string, val: number, onCh: (v: number) => void, step = 0.01, min = 0.01) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-silver/40">{label}</label>
      <input type="number" step={step} min={min} value={val} onChange={(e)=>onCh(parseFloat(e.target.value)||min)}
        className="w-full rounded border border-base-border bg-base-black px-2 py-1 text-xs text-silver focus:border-gold/40 focus:outline-none"/>
    </div>
  );

  const LOT_MODES: LotMode[] = ["fixed","risk_pct","martingale","anti_martingale","grid"];
  const modeColor: Record<LotMode,string> = {
    fixed:"border-gold/50 bg-gold/15 text-gold",
    risk_pct:"border-emerald-500/50 bg-emerald-500/15 text-emerald-400",
    martingale:"border-red-500/50 bg-red-500/15 text-red-400",
    anti_martingale:"border-royal/50 bg-royal/15 text-royal",
    grid:"border-cyan-400/50 bg-cyan-400/15 text-cyan-400",
  };

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="grid grid-cols-1 gap-1.5">
        {LOT_MODES.map(m=>(
          <button key={m} onClick={()=>set({mode:m})}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${lc.mode===m ? modeColor[m] : "border-base-border/50 text-silver/40 hover:border-base-border hover:text-silver/70"}`}>
            <div>
              <div className={`text-xs font-semibold ${lc.mode===m?"":"text-silver/50"}`}>{LOT_MODE_META[m].label}</div>
              <div className="text-[10px] opacity-70 leading-snug">{LOT_MODE_META[m].desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Mode-specific params */}
      <div className="grid grid-cols-2 gap-2">
        {ni("Base Lot",lc.baseLot,v=>set({baseLot:v}))}
        {lc.mode==="risk_pct"        && ni("Risk %",     lc.riskPct,     v=>set({riskPct:v}),    0.1,0.1)}
        {(lc.mode==="martingale"||lc.mode==="anti_martingale") && ni("Multiplier", lc.multiplier, v=>set({multiplier:v}),0.5,1)}
        {(lc.mode==="martingale"||lc.mode==="anti_martingale") && ni("Max Steps",  lc.maxOrders,  v=>set({maxOrders:Math.round(v)}),1,1)}
        {lc.mode==="grid" && ni("Grid Step (pts)",   lc.gridStep,       v=>set({gridStep:Math.round(v)}),   10,10)}
        {lc.mode==="grid" && ni("Max Orders",        lc.gridMaxOrders,  v=>set({gridMaxOrders:Math.round(v)}),1,1)}
        {lc.mode==="grid" && ni("Grid TP (pts)",     lc.gridTakeProfit, v=>set({gridTakeProfit:Math.round(v)}),10,10)}
      </div>

      {lc.mode==="grid" && (
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[10px] text-cyan-300/70">
          Grid เปิด order ทุก {lc.gridStep} pts · max {lc.gridMaxOrders} orders · ปิดทั้งหมดเมื่อ avg entry ± {lc.gridTakeProfit} pts<br/>
          ⚠ Grid ไม่ใช้ TP/SL ด้านล่าง — ปิดรวมด้วย avg+GridTP เท่านั้น
        </div>
      )}
      {lc.mode==="martingale" && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-[10px] text-red-300/70">
          ⚠ Martingale มีความเสี่ยงสูง — lot เพิ่มเป็น {lc.baseLot} × {lc.multiplier}^N ทุกครั้งที่ขาดทุน<br/>
          ต้อง backtest และกำหนด Max Steps อย่างระมัดระวัง
        </div>
      )}
    </div>
  );
}

// ── Preset management ─────────────────────────────────────────────────────────

const STORE_PRESETS      = "gios.eaPresets";
const STORE_EA_BACKTEST  = "gios.eaToBacktest";

interface EAPreset {
  name: string;
  config: EAConfig;
  savedAt: number;
}

function loadPresets(): EAPreset[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_PRESETS) ?? "[]");
  } catch { return []; }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EABuilderPage() {
  const [cfg, setCfg] = useState<EAConfig>(defaultConfig());
  const [code, setCode] = useState(() => generateCode(defaultConfig()));
  const [copied, setCopied] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceErr, setEnhanceErr] = useState("");
  const [presets, setPresets] = useState<EAPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetSaved, setPresetSaved] = useState(false);

  useEffect(() => { setPresets(loadPresets()); }, []);

  const update = useCallback((next: EAConfig) => {
    setCfg(next);
    setCode(generateCode(next));
    setEnhanceErr("");
  }, []);

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const entry: EAPreset = { name, config: cfg, savedAt: Date.now() };
    const next = [entry, ...presets.filter((p) => p.name !== name)];
    setPresets(next);
    localStorage.setItem(STORE_PRESETS, JSON.stringify(next));
    setPresetName("");
    setPresetSaved(true);
    setTimeout(() => setPresetSaved(false), 1800);
  }

  function applyPreset(p: EAPreset) {
    update(p.config);
  }

  function deletePreset(savedAt: number) {
    const next = presets.filter((p) => p.savedAt !== savedAt);
    setPresets(next);
    localStorage.setItem(STORE_PRESETS, JSON.stringify(next));
  }

  function updateCond(i: number, c: EntryCondition) {
    const next = [...cfg.conditions] as EAConfig["conditions"];
    next[i] = c;
    update({ ...cfg, conditions: next });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const ext = getFileExtension(cfg.language);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = `${cfg.name.replace(/\s+/g,"_")}.${ext}`;
    a.click();
  }

  function handleSendToBacktest() {
    localStorage.setItem(STORE_EA_BACKTEST, JSON.stringify(cfg));
    window.location.href = "/backtest";
  }

  async function handleEnhance() {
    setEnhancing(true); setEnhanceErr("");
    try {
      const strategies = cfg.conditions.filter(c=>c.enabled).map(c=>STRATEGY_META[c.strategy.type].label).join(" + ");
      const res = await fetch("/api/ea-enhance",{ method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ code, strategy: strategies, language: cfg.language }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setCode(data.code);
    } catch(e) { setEnhanceErr(e instanceof Error ? e.message : "AI enhancement failed"); }
    finally { setEnhancing(false); }
  }

  const inputCls = "w-full rounded-lg border border-base-border bg-base-panel px-3 py-1.5 text-sm text-silver focus:border-gold/40 focus:outline-none";
  const labelCls = "block text-[11px] uppercase tracking-widest text-silver/40 mb-1";
  const lines = code.split("\n").length;
  const active = cfg.conditions.filter(c=>c.enabled).length;
  const isGrid = cfg.lotConfig.mode === "grid";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="EA Code Generator"
        subtitle="สร้าง Expert Advisor สำหรับ XAUUSD — 16 strategies, 5 lot modes, TP/SL แบบ custom" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

        {/* ── Left config panel ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] pr-1 [scrollbar-width:thin]">

          {/* Presets */}
          <div className="panel p-4 space-y-3">
            <div className="stat-label">Preset บันทึก / โหลด</div>
            <div className="flex gap-2">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePreset()}
                placeholder="ชื่อ preset…"
                className="flex-1 rounded border border-base-border bg-base-black px-2 py-1.5 text-xs text-silver focus:border-gold/40 focus:outline-none"
              />
              <button
                onClick={savePreset}
                disabled={!presetName.trim()}
                className="rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20 disabled:opacity-40 transition-colors"
              >
                บันทึก
              </button>
            </div>
            {presetSaved && (
              <div className="text-[11px] text-emerald-400">✓ บันทึก preset สำเร็จ</div>
            )}
            {presets.length === 0 ? (
              <p className="text-[11px] text-silver/30">ยังไม่มี preset — บันทึกการตั้งค่าปัจจุบัน</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto [scrollbar-width:thin]">
                {presets.map((p) => (
                  <div key={p.savedAt} className="flex items-center gap-2 rounded border border-base-border/50 bg-base-black/30 px-2.5 py-1.5">
                    <span className="flex-1 truncate text-xs text-silver/80">{p.name}</span>
                    <button
                      onClick={() => applyPreset(p)}
                      className="rounded border border-royal/40 px-2 py-0.5 text-[11px] text-royal hover:bg-royal/10 transition-colors"
                    >
                      โหลด
                    </button>
                    <button
                      onClick={() => deletePreset(p.savedAt)}
                      className="rounded border border-red-500/25 px-2 py-0.5 text-[11px] text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Basic */}
          <div className="panel p-4 space-y-3">
            <div className="stat-label">ตั้งค่าพื้นฐาน</div>
            {/* Language */}
            <div className="flex gap-2">
              {(["mql4","mql5"] as Language[]).map(l=>(
                <button key={l} onClick={()=>update({...cfg,language:l})}
                  className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-colors ${cfg.language===l?"border-gold/60 bg-gold/15 text-gold":"border-base-border text-silver/40 hover:text-silver"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <div>
              <label className={labelCls}>ชื่อ EA</label>
              <input value={cfg.name} onChange={e=>update({...cfg,name:e.target.value})} className={inputCls}/>
            </div>
            {/* Timeframe */}
            <div>
              <label className={labelCls}>Timeframe</label>
              <div className="flex flex-wrap gap-1">
                {TF_OPTIONS.map(tf=>(
                  <button key={tf.value} onClick={()=>update({...cfg,timeframe:tf.value})}
                    className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${cfg.timeframe===tf.value?"bg-gold/20 text-gold border-gold/40":"border-base-border text-silver/40 hover:text-silver"}`}>
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Direction */}
            <div>
              <label className={labelCls}>ทิศทาง</label>
              <div className="flex gap-1">
                {([["both","ทั้งคู่"],["buy_only","Buy"],["sell_only","Sell"]] as [Direction,string][]).map(([v,l])=>(
                  <button key={v} onClick={()=>update({...cfg,direction:v})}
                    className={`flex-1 rounded border py-1.5 text-xs transition-colors ${cfg.direction===v?"border-gold/50 bg-gold/10 text-gold":"border-base-border text-silver/40 hover:text-silver"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Magic Number</label>
              <input type="number" value={cfg.magic} onChange={e=>update({...cfg,magic:parseInt(e.target.value)||1})} className={inputCls}/>
            </div>
          </div>

          {/* Entry Conditions */}
          <div className="panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="stat-label">เงื่อนไขเข้าไม้ ({active}/3)</div>
            </div>
            <p className="text-[10px] text-silver/30">เงื่อนไขที่ 2–3 เลือก AND/OR เพื่อรวมสัญญาณ · code จะรวม logic อัตโนมัติ</p>
            {cfg.conditions.map((cond,i)=>(
              <ConditionSlot key={i} index={i} cond={cond} onChange={c=>updateCond(i,c)}/>
            ))}
          </div>

          {/* Lot Management */}
          <div className="panel p-4 space-y-3">
            <div className="stat-label">การจัดการ Lot</div>
            <LotPanel cfg={cfg} onChange={update}/>
          </div>

          {/* TP / SL — hidden for grid */}
          {!isGrid && (
            <div className="panel p-4 space-y-3">
              <div className="stat-label">TP / SL</div>
              <TpSlPanel cfg={cfg} onChange={update}/>
            </div>
          )}

          {/* Trailing Stop */}
          {!isGrid && (
            <div className="panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="stat-label">Trailing Stop</div>
                <button onClick={()=>update({...cfg,useTrailing:!cfg.useTrailing})}
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold border transition-colors ${cfg.useTrailing?"border-emerald-500/40 bg-emerald-500/15 text-emerald-400":"border-base-border text-silver/40"}`}>
                  {cfg.useTrailing?"เปิด":"ปิด"}
                </button>
              </div>
              {cfg.useTrailing && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>เริ่ม (pts)</label>
                    <input type="number" step="10" min="10" value={cfg.trailStart}
                      onChange={e=>update({...cfg,trailStart:parseInt(e.target.value)||10})} className={inputCls}/>
                  </div>
                  <div>
                    <label className={labelCls}>ระยะ (pts)</label>
                    <input type="number" step="10" min="10" value={cfg.trailStep}
                      onChange={e=>update({...cfg,trailStep:parseInt(e.target.value)||10})} className={inputCls}/>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Code panel ───────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500/70"/>
              <span className="h-2 w-2 rounded-full bg-amber-500/70"/>
              <span className="h-2 w-2 rounded-full bg-emerald-500/70"/>
            </div>
            <span className="font-mono text-xs text-silver/40">{cfg.name}.{getFileExtension(cfg.language)}</span>
            <span className="text-[10px] text-silver/25">{lines} lines · {LOT_MODE_META[cfg.lotConfig.mode].label}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={handleSendToBacktest} disabled={active === 0}
                className="rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors">
                📊 ทดสอบใน Backtester
              </button>
              <button onClick={handleEnhance} disabled={enhancing}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${enhancing?"opacity-50 border-royal/30 text-royal/60":"border-royal/50 text-royal hover:bg-royal/10"}`}>
                {enhancing?"🤖 กำลังปรับ…":"🤖 AI Enhance"}
              </button>
              <button onClick={handleCopy}
                className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20 transition-colors">
                {copied?"✓ คัดลอก":"📋 Copy"}
              </button>
              <button onClick={handleDownload}
                className="rounded-lg border border-base-border px-3 py-1.5 text-xs text-silver/60 hover:text-silver hover:border-silver/30 transition-colors">
                ⬇ .{getFileExtension(cfg.language)}
              </button>
            </div>
          </div>

          {enhanceErr && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-400">{enhanceErr}</div>
          )}
          {active===0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-400">
              ⚠ เปิดอย่างน้อย 1 เงื่อนไขด้านซ้ายก่อน
            </div>
          )}

          {/* Code block */}
          <div className="rounded-xl border border-base-border/60 bg-[#1e1e1e] overflow-hidden shadow-royalglow flex-1">
            <div className="flex overflow-auto h-[calc(100vh-250px)] min-h-[500px]">
              <div className="select-none border-r border-white/5 px-3 pt-5 text-right font-mono text-[11px] leading-[1.65] text-silver/20 min-w-[3rem]">
                {code.split("\n").map((_,i)=><div key={i}>{i+1}</div>)}
              </div>
              <pre
                className="flex-1 overflow-x-auto px-4 pt-5 text-[12px] leading-[1.65] font-mono"
                style={{ fontFamily:"'Cascadia Code','Fira Code','JetBrains Mono','Consolas',monospace" }}
                dangerouslySetInnerHTML={{ __html: highlight(code) }}
              />
            </div>
          </div>

          {/* Tips */}
          <div className="panel p-3 text-[10px] text-silver/35 space-y-1">
            <p>💡 Copy → MetaEditor ใน MT4/5 → New Expert Advisor → Paste → Compile (F7)</p>
            <p>📊 XAUUSD ขนาด 100 pts ≈ $1.00 ราคา · ปรับ SL/TP ตาม broker และทศนิยม</p>
            <p>⚠ Backtest บน Strategy Tester ก่อนเปิด live เสมอ · EA นี้ไม่การันตีกำไร</p>
            <p>🤖 AI Enhance — Gemini เพิ่ม comment, error handling และ best practices</p>
          </div>
        </div>
      </div>

      <div className="mt-4"><Disclaimer/></div>
    </div>
  );
}
