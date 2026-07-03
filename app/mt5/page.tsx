"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MT5Account, MT5AccountMeta } from "@/lib/mt5Store";

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const ago = (ms: number) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

interface AccountRow extends MT5AccountMeta {
  connected: boolean;
  data: MT5Account | null;
}
interface AccountsResponse {
  tier: string;
  isAdmin: boolean;
  limit: number;
  used: number;
  accounts: AccountRow[];
}

const TIER_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" };

export default function MT5Page() {
  const [resp, setResp]       = useState<AccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding]   = useState(false);
  const [reveal, setReveal]   = useState<Record<string, boolean>>({});
  const [copied, setCopied]   = useState<string | null>(null);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/mt5/accounts", { cache: "no-store" });
      if (r.ok) setResp(await r.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const addAccount = async () => {
    setBusy("add");
    const r = await fetch("/api/mt5/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim() }),
    });
    const j = await r.json();
    setBusy(null);
    if (j.ok) { setNewLabel(""); setAdding(false); flash("เพิ่มพอร์ตแล้ว ✓", true); await load(); }
    else flash(j.error ?? "เพิ่มพอร์ตไม่สำเร็จ", false);
  };

  const removeAccount = async (id: string, label: string) => {
    if (!confirm(`ลบพอร์ต "${label}"? EA ที่ใช้ token นี้จะหยุดส่งข้อมูล`)) return;
    setBusy(id);
    const r = await fetch(`/api/mt5/accounts?id=${id}`, { method: "DELETE" });
    setBusy(null);
    if (r.ok) { flash("ลบพอร์ตแล้ว", true); await load(); }
  };

  const regen = async (id: string) => {
    if (!confirm("สร้าง token ใหม่? token เดิมจะใช้ไม่ได้ทันที — ต้องอัปเดตใน EA")) return;
    setBusy(id);
    const r = await fetch("/api/mt5/accounts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate", id }),
    });
    setBusy(null);
    if (r.ok) { flash("สร้าง token ใหม่แล้ว", true); await load(); }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 1500);
  };

  const atLimit = resp ? resp.used >= resp.limit : false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-sm font-bold shadow-xl"
          style={toast.ok
            ? { background: "rgba(16,60,40,0.95)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399" }
            : { background: "rgba(70,20,20,0.95)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between">
        <PageHeader title="MT5 Bridge 🔌"
          subtitle="เชื่อมต่อหลายพอร์ต MetaTrader 5 — ข้อมูลของคุณแยกเฉพาะบัญชีคุณ ไม่ปนกับคนอื่น" />
        {resp && (
          <div className="mt-1 text-right shrink-0">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.35)" }}>
              {TIER_LABEL[resp.tier] ?? resp.tier} Plan
            </div>
            <div className="text-lg font-black" style={{ color: atLimit ? "#f5c451" : "#34d399" }}>
              {resp.used}/{resp.limit} <span className="text-[10px] font-normal" style={{ color: "rgba(175,185,215,0.4)" }}>พอร์ต</span>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3" style={{ color: "rgba(175,185,215,0.3)" }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "rgba(245,196,81,0.3)", borderTopColor: "transparent" }} />
          <span className="text-sm">กำลังโหลดพอร์ต…</span>
        </div>
      )}

      {resp && !loading && (
        <div className="mt-5 space-y-4">
          {/* Tier limit banner */}
          <div className="rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[11px]" style={{ color: "rgba(175,185,215,0.5)" }}>
              📊 โควตาพอร์ตตามแพ็กเกจ: <span style={{ color: "#9ca3af" }}>Free 1</span> ·
              <span style={{ color: "#f5c451" }}> Premium 5</span> ·
              <span style={{ color: "#c084fc" }}> Pro 10</span>
            </div>
            {!atLimit ? (
              <button onClick={() => setAdding(a => !a)}
                className="rounded-lg px-4 py-1.5 text-xs font-bold"
                style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399" }}>
                + เพิ่มพอร์ต
              </button>
            ) : (
              <span className="text-[11px] font-bold" style={{ color: "#f5c451" }}>
                ⚡ เต็มโควตาแล้ว — อัปเกรดเพื่อเพิ่มพอร์ต
              </span>
            )}
          </div>

          {/* Add account form */}
          {adding && !atLimit && (
            <div className="rounded-xl px-4 py-4 space-y-3"
              style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.2)" }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.4)" }}>
                ตั้งชื่อพอร์ตใหม่
              </div>
              <div className="flex gap-2">
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder='เช่น "พอร์ตหลัก" หรือ "Prop Firm 1"'
                  maxLength={40}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />
                <button onClick={addAccount} disabled={busy === "add"}
                  className="rounded-lg px-4 py-2 text-xs font-bold shrink-0"
                  style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", opacity: busy === "add" ? 0.5 : 1 }}>
                  {busy === "add" ? "…" : "สร้างพอร์ต"}
                </button>
              </div>
            </div>
          )}

          {/* No accounts yet */}
          {resp.accounts.length === 0 && (
            <div className="rounded-xl px-6 py-10 text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}>
              <div className="text-4xl mb-3 opacity-30">🔌</div>
              <div className="text-sm font-bold mb-1" style={{ color: "rgba(175,185,215,0.5)" }}>ยังไม่มีพอร์ตที่เชื่อมต่อ</div>
              <div className="text-[11px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                กด &quot;+ เพิ่มพอร์ต&quot; ด้านบนเพื่อสร้าง token แล้วนำไปใส่ใน EA บน MT5
              </div>
            </div>
          )}

          {/* Account cards */}
          {resp.accounts.map((acc, idx) => {
            const d = acc.data;
            const connected = acc.connected && !!d;
            const shown = reveal[acc.id];
            const maskedToken = shown ? acc.token : `${acc.token.slice(0, 9)}${"•".repeat(18)}`;
            return (
              <div key={acc.id} className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${connected ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.07)"}` }}>
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{
                      background: connected ? "#34d399" : "#475569",
                      boxShadow: connected ? "0 0 8px rgba(52,211,153,0.6)" : "none",
                      animation: connected ? "pulse 2s infinite" : "none",
                    }} />
                    <span className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{acc.label}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.4)" }}>
                      #{idx + 1}
                    </span>
                    {connected
                      ? <span className="text-[10px]" style={{ color: "rgba(52,211,153,0.8)" }}>● เชื่อมต่อ · {ago(d!.lastUpdate)}</span>
                      : <span className="text-[10px]" style={{ color: "rgba(175,185,215,0.35)" }}>○ รอ EA ส่งข้อมูล</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={`/api/mt5/ea?token=${acc.token}`}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-bold"
                      style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}>
                      ⬇ EA
                    </a>
                    <button onClick={() => regen(acc.id)} disabled={busy === acc.id}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-bold"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(175,185,215,0.5)" }}>
                      ↻ Token
                    </button>
                    <button onClick={() => removeAccount(acc.id, acc.label)} disabled={busy === acc.id}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-bold"
                      style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
                      🗑
                    </button>
                  </div>
                </div>

                {/* Live stats (if connected) */}
                {connected && d && (
                  <div className="px-5 py-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                      <Stat label="Balance" value={`${d.currency} ${fmt(d.balance)}`} />
                      <Stat label="Equity" value={`${d.currency} ${fmt(d.equity)}`} color={d.equity >= d.balance ? "#34d399" : "#f87171"} />
                      <Stat label="Floating P/L" value={`${d.floating >= 0 ? "+" : ""}${fmt(d.floating)}`} color={d.floating >= 0 ? "#34d399" : "#f87171"} />
                      <Stat label="Positions" value={String(d.positions.length)} sub={`${d.server} · #${d.account}`} />
                    </div>
                  </div>
                )}

                {/* Token + setup */}
                <div className="px-5 py-3" style={{ background: "rgba(0,0,0,0.15)" }}>
                  <div className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                    Account Token (ใส่ในช่อง InpAccountToken ของ EA)
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg px-3 py-2 text-[11px] font-mono truncate"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#c084fc" }}>
                      {maskedToken}
                    </code>
                    <button onClick={() => setReveal(r => ({ ...r, [acc.id]: !r[acc.id] }))}
                      className="rounded-lg px-2.5 py-2 text-[10px]" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(175,185,215,0.5)" }}>
                      {shown ? "🙈" : "👁"}
                    </button>
                    <button onClick={() => copy(acc.token, acc.id)}
                      className="rounded-lg px-3 py-2 text-[10px] font-bold"
                      style={{ background: "rgba(192,132,252,0.12)", border: "1px solid rgba(192,132,252,0.3)", color: "#c084fc" }}>
                      {copied === acc.id ? "✓ คัดลอกแล้ว" : "คัดลอก"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Setup instructions */}
          <div className="rounded-xl px-5 py-4 text-[11px]"
            style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.12)" }}>
            <div className="font-bold mb-2" style={{ color: "rgba(192,132,252,0.7)" }}>📖 วิธีเชื่อมต่อแต่ละพอร์ต</div>
            <ol className="list-decimal list-inside space-y-1" style={{ color: "rgba(175,185,215,0.5)" }}>
              <li>กด <strong style={{ color: "#34d399" }}>+ เพิ่มพอร์ต</strong> ตั้งชื่อ → ระบบสร้าง token เฉพาะพอร์ตนั้น</li>
              <li>กด <strong style={{ color: "#f5c451" }}>⬇ EA</strong> ของพอร์ตนั้น — ไฟล์ .mq5 จะฝัง token ให้อัตโนมัติ</li>
              <li>ใน MT5 → File → Open Data Folder → MQL5/Experts วางไฟล์ แล้ว Compile (F7)</li>
              <li>MT5 → Tools → Options → Expert Advisors → เปิด &quot;Allow WebRequest&quot; แล้วเพิ่ม URL: <code style={{ color: "#c084fc" }}>{typeof window !== "undefined" ? window.location.origin : ""}/api/mt5/push</code></li>
              <li>ลาก EA ลงชาร์ตใดก็ได้ของพอร์ตนั้น → ข้อมูลจะขึ้นที่นี่ภายใน ~15 วิ</li>
            </ol>
            <div className="mt-2 pt-2 text-[10px]" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(175,185,215,0.35)" }}>
              💡 มีหลายพอร์ต? เปิด MT5 หลาย instance หรือใส่ EA แต่ละพอร์ตด้วย token ของพอร์ตนั้น — ข้อมูลจะแยกกันชัดเจน
            </div>
          </div>
        </div>
      )}

      <style jsx>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>{label}</div>
      <div className="font-mono text-sm font-black" style={{ color: color ?? "#e2e8f0" }}>{value}</div>
      {sub && <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>{sub}</div>}
    </div>
  );
}
