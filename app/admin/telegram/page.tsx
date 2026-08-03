"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

interface Status {
  expectedUrl: string;
  registeredUrl: string | null;
  pendingUpdateCount: number | null;
  lastError: string | null;
  lastErrorAt: string | null;
  subscribers: number;
  names: string[];
  durableStore?: boolean;
  lastAccepted?: { at: number; cmd: string; replied: boolean; replyError: string | null } | null;
  lastRejected?: { at: number; hadHeader: boolean } | null;
  error?: string;
}

export default function TelegramAdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/telegram/setup", { cache: "no-store" });
      setStatus(await r.json());
    } catch (e) {
      setStatus({ error: String(e) } as Status);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Registering is a POST because it changes something at Telegram. That is the
  // right method and it is also why this page exists — the alternative was
  // telling someone to open a browser console and paste a fetch call.
  const register = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/telegram/setup", { method: "POST" });
      const j = await r.json();
      setMsg(j.ok ? "✅ ลงทะเบียนสำเร็จ — ทักบอทแล้วพิมพ์ /start เพื่อทดสอบ" : `❌ ${j.error ?? "ไม่สำเร็จ"}`);
      await load();
    } catch (e) {
      setMsg(`❌ ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const registered = !!status?.registeredUrl;
  const correct = registered && status?.registeredUrl === status?.expectedUrl;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Telegram 🤖"
        subtitle="ตั้งค่าบอทและดูรายชื่อผู้รับแจ้งเตือน"
      />

      {loading && <div className="panel p-6 text-sm text-silver/40">กำลังโหลด…</div>}

      {status?.error && (
        <div className="panel p-6 text-sm" style={{ color: "#f87171" }}>{status.error}</div>
      )}

      {status && !status.error && (
        <>
          <div className="panel mb-4 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-silver/35">สถานะ Webhook</div>
              <div
                className="rounded-full px-3 py-1 text-[10px] font-bold"
                style={{
                  background: correct ? "rgba(52,211,153,0.12)" : "rgba(245,196,81,0.12)",
                  color: correct ? "#34d399" : "#f5c451",
                }}
              >
                {correct ? "เชื่อมต่อแล้ว" : registered ? "ชี้ผิดที่" : "ยังไม่ได้ลงทะเบียน"}
              </div>
            </div>

            <dl className="space-y-2 text-[11px]">
              <div className="flex gap-3">
                <dt className="w-32 shrink-0 text-silver/35">ควรชี้ไปที่</dt>
                <dd className="break-all font-mono text-silver/60">{status.expectedUrl}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-32 shrink-0 text-silver/35">ชี้อยู่จริง</dt>
                <dd className="break-all font-mono" style={{ color: correct ? "#34d399" : "#f5c451" }}>
                  {status.registeredUrl ?? "— ยังไม่ได้ตั้ง —"}
                </dd>
              </div>
              {/* Telegram's own view of whether deliveries are landing. A count
                  stuck above zero means they are not, which is otherwise
                  invisible until somebody notices the bot ignoring them. */}
              <div className="flex gap-3">
                <dt className="w-32 shrink-0 text-silver/35">ค้างส่ง</dt>
                <dd className="font-mono text-silver/60">{status.pendingUpdateCount ?? "—"}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-32 shrink-0 text-silver/35">ที่เก็บถาวร</dt>
                <dd style={{ color: status.durableStore ? "#34d399" : "#f87171" }}>
                  {status.durableStore
                    ? "พร้อม"
                    : "ไม่พร้อม — secret จะถูกสร้างใหม่ทุกครั้ง ทำให้ Telegram ส่งเข้ามาไม่ผ่านทุกครั้ง"}
                </dd>
              </div>
              {/* Whether Telegram has ever reached the handler, and what happened
                  when it did. A bot that does not answer looks the same whether
                  it was never called, refused, or replied to and the reply
                  failed — and those need different fixes. */}
              <div className="flex gap-3">
                <dt className="w-32 shrink-0 text-silver/35">รับล่าสุด</dt>
                <dd className="text-silver/60">
                  {status.lastAccepted
                    ? `${status.lastAccepted.cmd} · ${new Date(status.lastAccepted.at).toLocaleString("th-TH")} · ${
                        status.lastAccepted.replied ? "ตอบกลับแล้ว" : `ตอบกลับไม่สำเร็จ: ${status.lastAccepted.replyError ?? "ไม่ทราบสาเหตุ"}`
                      }`
                    : "— ยังไม่เคยมีข้อความเข้ามาเลย —"}
                </dd>
              </div>
              {status.lastRejected && (
                <div className="flex gap-3">
                  <dt className="w-32 shrink-0 text-silver/35">ปฏิเสธล่าสุด</dt>
                  <dd style={{ color: "#f5c451" }}>
                    {new Date(status.lastRejected.at).toLocaleString("th-TH")} ·{" "}
                    {status.lastRejected.hadHeader ? "secret ไม่ตรง" : "ไม่มี secret มาด้วย"}
                  </dd>
                </div>
              )}
              {status.lastError && (
                <div className="flex gap-3">
                  <dt className="w-32 shrink-0 text-silver/35">ข้อผิดพลาดล่าสุด</dt>
                  <dd style={{ color: "#f87171" }}>
                    {status.lastError}
                    {status.lastErrorAt && ` · ${new Date(status.lastErrorAt).toLocaleString("th-TH")}`}
                  </dd>
                </div>
              )}
            </dl>

            <button
              onClick={register}
              disabled={busy}
              className="mt-4 rounded-xl px-4 py-2 text-xs font-bold transition-opacity disabled:opacity-40"
              style={{ background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}
            >
              {busy ? "กำลังลงทะเบียน…" : correct ? "🔄 ลงทะเบียนใหม่" : "🔗 ลงทะเบียน Webhook"}
            </button>

            {msg && <div className="mt-3 text-[11px] text-silver/60">{msg}</div>}
          </div>

          <div className="panel p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[10px] uppercase tracking-widest text-silver/35">ผู้รับแจ้งเตือน</div>
              <div className="font-mono text-2xl font-black text-gold">{status.subscribers}</div>
            </div>
            {status.names.length === 0 ? (
              <div className="text-[11px] text-silver/35">
                ยังไม่มีใครสมัคร — ส่งลิงก์บอทให้เพื่อน แล้วให้พิมพ์ <code>/start</code>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {status.names.map((n, i) => (
                  <span
                    key={i}
                    className="rounded-lg px-2.5 py-1 text-[11px]"
                    style={{ background: "rgba(148,163,184,0.08)", color: "rgba(175,185,215,0.7)" }}
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
            {/* Names only. A chat id identifies someone's Telegram account and a
                dashboard has no reason to hand them out. */}
            <div className="mt-3 text-[10px] text-silver/25">
              แสดงเฉพาะชื่อ — chat id ไม่ถูกส่งมาที่หน้านี้
            </div>
          </div>
        </>
      )}
    </div>
  );
}
