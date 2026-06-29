"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

function EnvRow({ label, envKey, set, note }: { label: string; envKey: string; set: boolean; note: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-4 transition-all"
      style={{ borderColor: set ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.2)", background: set ? "rgba(52,211,153,0.04)" : "rgba(248,113,113,0.04)" }}>
      <span className="mt-0.5 text-lg">{set ? "✅" : "❌"}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-xs font-mono font-bold text-silver/80">{envKey}</code>
          <span className="text-[10px] font-bold" style={{ color: set ? "#34d399" : "#f87171" }}>
            {set ? "พร้อมใช้งาน" : "ยังไม่ได้ตั้งค่า"}
          </span>
        </div>
        <div className="text-xs text-silver/50">{label}</div>
        <div className="text-[10px] text-silver/30 mt-1">{note}</div>
      </div>
    </div>
  );
}

export default function BroadcastPage() {
  const [testing,  setTesting]  = useState(false);
  const [testMsg,  setTestMsg]  = useState("");
  const [testOk,   setTestOk]   = useState<boolean | null>(null);
  const [status,   setStatus]   = useState<{ botSet: boolean; channelSet: boolean } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  async function checkStatus() {
    setLoadingStatus(true);
    try {
      const r = await fetch("/api/broadcast/status");
      const d = await r.json();
      setStatus(d);
    } finally { setLoadingStatus(false); }
  }

  async function sendTest() {
    setTesting(true); setTestMsg(""); setTestOk(null);
    try {
      const r  = await fetch("/api/broadcast/test", { method: "POST" });
      const d  = await r.json();
      setTestOk(d.ok);
      setTestMsg(d.ok ? "✅ ส่ง test signal สำเร็จ! เช็ค Telegram channel ของคุณ" : `❌ ${d.error ?? "Unknown error"}`);
    } catch (e) {
      setTestOk(false);
      setTestMsg(`❌ ${e}`);
    } finally { setTesting(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Broadcast Settings 📢"
        subtitle="ตั้งค่าการส่ง AI signal อัตโนมัติไป Telegram Channel"
      />

      {/* Step guide */}
      <div className="panel p-5 mb-6">
        <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-4">วิธีตั้งค่า</div>
        <ol className="flex flex-col gap-4 text-sm text-silver/70">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
              style={{ background:"rgba(245,196,81,0.15)", border:"1px solid rgba(245,196,81,0.3)", color:"#f5c451" }}>1</span>
            <div>
              <div className="font-semibold text-silver/90 mb-1">สร้าง Telegram Bot</div>
              <div className="text-[12px] text-silver/50">เปิด Telegram → ค้นหา <code className="text-gold">@BotFather</code> → พิมพ์ <code className="text-gold">/newbot</code> → ตั้งชื่อ → คัดลอก Token</div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
              style={{ background:"rgba(245,196,81,0.15)", border:"1px solid rgba(245,196,81,0.3)", color:"#f5c451" }}>2</span>
            <div>
              <div className="font-semibold text-silver/90 mb-1">เพิ่ม ENV ที่ Vercel</div>
              <div className="text-[12px] text-silver/50">Vercel Dashboard → Project → Settings → Environment Variables → เพิ่ม 2 ตัว:</div>
              <div className="mt-2 rounded-lg p-3 font-mono text-[11px]" style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-emerald-400">TELEGRAM_BOT_TOKEN=<span className="text-silver/50">1234567890:AAF...</span></div>
                <div className="text-emerald-400 mt-1">TELEGRAM_CHANNEL_ID=<span className="text-silver/50">@mychannel</span></div>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
              style={{ background:"rgba(245,196,81,0.15)", border:"1px solid rgba(245,196,81,0.3)", color:"#f5c451" }}>3</span>
            <div>
              <div className="font-semibold text-silver/90 mb-1">Add Bot เข้า Channel</div>
              <div className="text-[12px] text-silver/50">เปิด channel ของคุณ → Edit → Administrators → Add Administrator → ค้นหา bot ที่สร้าง → เพิ่มสิทธิ์ <b>Post Messages</b></div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
              style={{ background:"rgba(245,196,81,0.15)", border:"1px solid rgba(245,196,81,0.3)", color:"#f5c451" }}>4</span>
            <div>
              <div className="font-semibold text-silver/90 mb-1">Redeploy + Test</div>
              <div className="text-[12px] text-silver/50">Vercel → Deployments → Redeploy หลังเพิ่ม ENV แล้วกด Test Broadcast ด้านล่าง</div>
            </div>
          </li>
        </ol>
      </div>

      {/* Behavior */}
      <div className="panel p-5 mb-6">
        <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">เงื่อนไข Auto Broadcast</div>
        <div className="flex flex-col gap-2 text-sm text-silver/60">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> Signal <b>BUY / SELL</b> เท่านั้น (ไม่ broadcast WAIT)
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> Confidence <b>≥ 65%</b> ขึ้นไป
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> เฉพาะ <b>cache miss</b> (signal ใหม่เท่านั้น — ไม่ซ้ำทุก 15 นาที)
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gold">★</span> ข้อความรวม Entry / SL / TP1 / TP2 / R:R + เหตุผล AI
          </div>
        </div>
      </div>

      {/* Test button */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-4">ทดสอบระบบ</div>
        <button onClick={sendTest} disabled={testing}
          className="w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50"
          style={{ background:"rgba(245,196,81,0.12)", border:"1px solid rgba(245,196,81,0.35)", color:"#f5c451" }}>
          {testing ? "กำลังส่ง…" : "📢 Send Test Signal to Channel"}
        </button>
        {testMsg && (
          <div className="mt-3 rounded-xl p-3 text-sm"
            style={{ background: testOk ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${testOk ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
              color: testOk ? "#34d399" : "#f87171" }}>
            {testMsg}
          </div>
        )}
        <p className="mt-3 text-[10px] text-silver/25 text-center">
          ต้องตั้งค่า TELEGRAM_BOT_TOKEN และ TELEGRAM_CHANNEL_ID ใน Vercel ENV ก่อน
        </p>
      </div>
    </div>
  );
}
