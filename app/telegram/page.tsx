"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

interface LinkState {
  linked: boolean;
  linkedAt: number | null;
  name: string | null;
  tier: string;
  botUrl: string;
  error?: string;
}

interface Issued {
  deepLink: string;
  botUrl: string;
  code: string;
  expiresInMin: number;
}

export default function TelegramConnectPage() {
  const [state, setState] = useState<LinkState | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/telegram/link", { cache: "no-store" });
      if (r.status === 401) { setErr("กรุณาเข้าสู่ระบบก่อน"); return; }
      setState(await r.json());
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Issued on demand rather than on page load: a code is a credential with a
  // fifteen-minute life, and minting one for every visit would leave a trail of
  // live codes belonging to people who only came to look.
  const connect = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/telegram/link", { method: "POST" });
      if (!r.ok) throw new Error("ออกรหัสไม่สำเร็จ");
      const j: Issued = await r.json();
      setIssued(j);
      window.open(j.deepLink, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="รับแจ้งเตือนทาง Telegram 🔔"
        subtitle="ข่าวที่กระทบราคาทอง และโครงสร้างคลื่นระดับใหญ่ ส่งตรงถึงมือถือคุณ"
      />

      {err && (
        <div className="panel mb-4 p-4 text-sm" style={{ color: "#f87171" }}>{err}</div>
      )}

      <div className="panel mb-4 p-6">
        {state?.linked ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="text-sm font-bold" style={{ color: "#34d399" }}>เชื่อมต่อแล้ว</span>
            </div>
            <div className="text-[12px] text-silver/50">
              บัญชี Telegram: <b>{state.name}</b>
              {state.linkedAt && ` · ผูกเมื่อ ${new Date(state.linkedAt).toLocaleDateString("th-TH")}`}
            </div>
            <div className="mt-1 text-[12px] text-silver/50">
              ระดับสมาชิก: <b style={{ color: "#f5c451" }}>{state.tier}</b>
              {state.tier === "free"
                ? " — ได้รับแจ้งเตือนข่าว (อัปเกรดเป็น Premium เพื่อรับแจ้งเตือนคลื่นด้วย)"
                : " — ได้รับทั้งข่าวและโครงสร้างคลื่น"}
            </div>
            <a
              href={state.botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}
            >
              💬 เปิดแชทกับบอท
            </a>
            <div className="mt-3 text-[11px] text-silver/30">
              พิมพ์ <code>/stop</code> ในแชทเพื่อหยุดรับได้ทุกเมื่อ
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 text-[13px] leading-relaxed text-silver/60">
              กดปุ่มด้านล่าง Telegram จะเปิดขึ้นพร้อมผูกกับบัญชีของคุณให้อัตโนมัติ
              กด <b>START</b> ในแอปเป็นอันเสร็จ
            </div>

            <button
              onClick={connect}
              disabled={busy}
              className="rounded-xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-40"
              style={{ background: "rgba(56,139,253,0.15)", border: "1px solid rgba(56,139,253,0.35)", color: "#5eaaff" }}
            >
              {busy ? "กำลังเตรียม…" : "🔗 เชื่อมต่อ Telegram"}
            </button>

            {issued && (
              <div className="mt-4 text-[11px] leading-relaxed text-silver/40">
                ถ้า Telegram ไม่เปิดขึ้นเอง{" "}
                <a href={issued.deepLink} target="_blank" rel="noopener noreferrer" style={{ color: "#5eaaff" }}>
                  กดที่นี่
                </a>
                {" "}หรือเปิดแชทบอทแล้วพิมพ์:
                <div
                  className="mt-1 select-all break-all rounded-lg px-2.5 py-1.5 font-mono text-[11px]"
                  style={{ background: "rgba(148,163,184,0.08)", color: "rgba(175,185,215,0.75)" }}
                >
                  /link {issued.code}
                </div>
                <div className="mt-1">รหัสนี้ใช้ได้ครั้งเดียว หมดอายุใน {issued.expiresInMin} นาที — อย่าส่งต่อให้ใคร</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="panel p-5 text-[12px] leading-relaxed text-silver/50">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-silver/35">คุณจะได้รับอะไร</div>
        <ul className="space-y-2">
          <li>
            📰 <b>ข่าวที่อาจกระทบราคาทอง</b> พร้อมทิศทางว่าหนุนหรือกดราคา
            <span className="ml-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(148,163,184,0.12)", color: "rgba(175,185,215,0.7)" }}>
              ทุกระดับ
            </span>
          </li>
          <li>
            〰️ <b>โครงสร้างคลื่นระดับใหญ่เปลี่ยน</b> — เฉลี่ยราว 4 วันครั้ง ไม่ใช่ทุกวัน
            <span className="ml-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(245,196,81,0.14)", color: "#f5c451" }}>
              Premium ขึ้นไป
            </span>
          </li>
        </ul>
        <div className="mt-3 text-[11px] text-silver/30">
          วิเคราะห์ประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน
        </div>
      </div>
    </div>
  );
}
