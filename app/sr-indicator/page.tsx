"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

const PARAMS = [
  { key:"InpSwingBars", label:"Swing Lookback", default:"5", tip:"จำนวน bar ที่ใช้หา Swing High/Low" },
  { key:"InpMaxLevels", label:"Max Levels/Side", default:"8", tip:"แนวรับ/แนวต้านสูงสุดกี่เส้น" },
  { key:"InpMergeZone", label:"Merge Zone (× ATR)", default:"0.3", tip:"รวมแนวที่ใกล้กัน" },
  { key:"InpAlertPct",  label:"Alert Distance (%)", default:"0.1", tip:"แจ้งเตือนเมื่อราคาใกล้แนว" },
];

function StepCard({ num, text, sub }: { num: string; text: string; sub: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
        style={{ background:"rgba(245,196,81,0.15)", border:"1px solid rgba(245,196,81,0.3)", color:"#f5c451" }}>
        {num}
      </span>
      <div>
        <div className="text-sm font-semibold text-silver/90">{text}</div>
        <div className="text-[11px] text-silver/45 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

export default function SrIndicatorPage() {
  const [copied, setCopied] = useState<"mt4"|"mt5"|"">("");

  const download = (type: "mt4"|"mt5") => {
    window.open(`/api/sr-indicator?type=${type}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Auto S/R Indicator 📐"
        subtitle="แนวรับ/แนวต้านอัตโนมัติ สำหรับ MT4 และ MT5 — วาดจาก Swing High/Low + Pivot Points"
      />

      {/* Download cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        {/* MT5 */}
        <div className="panel p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">🖥</div>
            <div>
              <div className="font-bold text-white">MetaTrader 5</div>
              <div className="text-[10px] text-silver/40">GIOS_SR_Levels.mq5</div>
            </div>
          </div>
          <p className="text-[11px] text-silver/50 mb-4 leading-relaxed">
            รองรับ MT5 ทุก build · ใช้ CopyHigh/CopyLow · วาดหลาย timeframe พร้อมกัน
          </p>
          <button onClick={() => download("mt5")}
            className="w-full rounded-xl py-2.5 text-sm font-bold transition-all"
            style={{ background:"rgba(245,196,81,0.12)", border:"1px solid rgba(245,196,81,0.35)", color:"#f5c451" }}>
            ⬇ Download .mq5 (MT5)
          </button>
        </div>

        {/* MT4 */}
        <div className="panel p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">💻</div>
            <div>
              <div className="font-bold text-white">MetaTrader 4</div>
              <div className="text-[10px] text-silver/40">GIOS_SR_Levels.mq4</div>
            </div>
          </div>
          <p className="text-[11px] text-silver/50 mb-4 leading-relaxed">
            รองรับ MT4 ทุก build · syntax MQL4 · ใช้ iHigh/iLow arrays
          </p>
          <button onClick={() => download("mt4")}
            className="w-full rounded-xl py-2.5 text-sm font-bold transition-all"
            style={{ background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.35)", color:"#60a5fa" }}>
            ⬇ Download .mq4 (MT4)
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="panel p-5 mb-6">
        <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-4">ฟีเจอร์</div>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          {[
            ["📈", "Swing High/Low", "หา pivot จาก 2 timeframes พร้อมกัน (D1 + H4 default)"],
            ["🎯", "Auto Merge", "รวมแนวที่ใกล้กัน (ตาม ATR zone) ไม่ให้หนาแน่นเกินไป"],
            ["🔔", "Price Alert", "แจ้งเตือนเมื่อราคาใกล้แนวตามที่ตั้ง %"],
            ["📐", "Daily Pivots", "PP, R1/R2, S1/S2 จาก H-L-C เมื่อวาน"],
            ["🔄", "Auto Refresh", "Redraw ทุก 5 นาทีอัตโนมัติ"],
            ["🎨", "ปรับสีได้", "สีแนวรับ/แนวต้าน/pivot แยกกัน"],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex gap-2 items-start rounded-xl p-3"
              style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-base">{icon}</span>
              <div>
                <div className="font-semibold text-silver/80">{title}</div>
                <div className="text-[10px] text-silver/40 mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Install guide */}
      <div className="panel p-5 mb-6">
        <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-4">วิธีติดตั้ง</div>
        <div className="flex flex-col gap-4">
          <StepCard num="1" text="Download ไฟล์ที่ตรงกับ platform ของคุณ"
            sub="MT5 → .mq5 / MT4 → .mq4" />
          <StepCard num="2" text='วางไฟล์ใน MQL5/Indicators/ หรือ MQL4/Indicators/'
            sub='MT5: File → Open Data Folder → MQL5 → Indicators' />
          <StepCard num="3" text="เปิด MetaEditor (F4) → กด Compile (F7)"
            sub="ต้องไม่มี error — จะเห็น 0 errors 0 warnings" />
          <StepCard num="4" text="กลับ MT4/MT5 → Navigator → Indicators → GIOS_SR_Levels"
            sub="ลากวางบน Chart ที่ต้องการ" />
          <StepCard num="5" text="ตั้งค่าพารามิเตอร์ตามต้องการ แล้วกด OK"
            sub="แนวรับ = น้ำเงิน · แนวต้าน = แดง · Pivot = ทอง" />
        </div>
      </div>

      {/* Parameters reference */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Parameters Reference</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-base-border/20 text-[9px] uppercase tracking-widest text-silver/30">
                <th className="pb-2 text-left">Parameter</th>
                <th className="pb-2 text-center">Default</th>
                <th className="pb-2 text-left">คำอธิบาย</th>
              </tr>
            </thead>
            <tbody>
              {PARAMS.map(p => (
                <tr key={p.key} className="border-b border-base-border/10 hover:bg-white/[0.015] transition-colors">
                  <td className="py-2 font-mono text-gold/80">{p.key}</td>
                  <td className="py-2 text-center font-mono text-silver/60">{p.default}</td>
                  <td className="py-2 text-silver/50">{p.tip}</td>
                </tr>
              ))}
              <tr className="border-b border-base-border/10">
                <td className="py-2 font-mono text-gold/80">InpMajorTF</td>
                <td className="py-2 text-center font-mono text-silver/60">PERIOD_D1</td>
                <td className="py-2 text-silver/50">Timeframe หลักสำหรับ Swing levels</td>
              </tr>
              <tr className="border-b border-base-border/10">
                <td className="py-2 font-mono text-gold/80">InpShowPivot</td>
                <td className="py-2 text-center font-mono text-silver/60">true</td>
                <td className="py-2 text-silver/50">แสดง Daily Pivot Points</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
