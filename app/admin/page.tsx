"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

type Tier = "free" | "premium" | "pro";

interface UserRow {
  email:   string;
  tier:    Tier;
  isAdmin: boolean;
}

interface AdminData {
  superAdmins:   string[];
  dynamicAdmins: string[];
  users:         UserRow[];
}

interface PendingUser {
  email:        string;
  name:         string;
  picture:      string;
  registeredAt: string;
}

const TIER_COLORS: Record<Tier, string> = {
  free:    "#9ca3af",
  premium: "#f5c451",
  pro:     "#c084fc",
};
const TIER_BG: Record<Tier, string> = {
  free:    "rgba(156,163,175,0.12)",
  premium: "rgba(245,196,81,0.12)",
  pro:     "rgba(192,132,252,0.12)",
};

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
      style={{ background: TIER_BG[tier], color: TIER_COLORS[tier], border: `1px solid ${TIER_COLORS[tier]}40` }}>
      {tier}
    </span>
  );
}

function StatusMsg({ msg, ok }: { msg: string; ok: boolean }) {
  if (!msg) return null;
  return (
    <div className="rounded-lg px-4 py-2 text-xs font-bold"
      style={{ background: ok ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", color: ok ? "#34d399" : "#f87171", border: `1px solid ${ok ? "#34d39930" : "#f8717130"}` }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data,         setData]         = useState<AdminData | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [msg,          setMsg]          = useState({ text: "", ok: true });
  const [approveTier,  setApproveTier]  = useState<Record<string, Tier>>({});

  const addEmailRef  = useRef<HTMLInputElement>(null);
  const userEmailRef = useRef<HTMLInputElement>(null);
  const [userTier,   setUserTier]   = useState<Tier>("premium");

  // Guard: redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.replace("/"); return; }
    const u = session?.user as { isAdmin?: boolean } | undefined;
    if (!u?.isAdmin) { router.replace("/"); }
  }, [status, session, router]);

  const loadPending = useCallback(async () => {
    const r = await fetch("/api/admin/pending-users", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      setPendingUsers(j.users ?? []);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        loadPending(),
      ]);
      if (!r.ok) { router.replace("/"); return; }
      setData(await r.json());
    } finally { setLoading(false); }
  }, [router, loadPending]);

  useEffect(() => { load(); }, [load]);

  async function callApi(body: object) {
    setMsg({ text: "", ok: true });
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    setMsg({ text: j.message ?? j.error ?? "Done", ok: r.ok });
    if (r.ok) load();
  }

  async function callPendingApi(body: object) {
    setMsg({ text: "", ok: true });
    const r = await fetch("/api/admin/pending-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    setMsg({ text: j.message ?? j.error ?? "Done", ok: r.ok });
    if (r.ok) { loadPending(); load(); }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>🔐 กำลังโหลด…</div>
      </div>
    );
  }

  if (!data) return null;

  const allAdmins = [...new Set([...data.superAdmins, ...data.dynamicAdmins])].sort();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🔐 Admin Panel"
        subtitle="จัดการ Admin และสิทธิ์ผู้ใช้งาน — เฉพาะ Admin เท่านั้น"
      />

      {msg.text && (
        <div className="mb-4">
          <StatusMsg msg={msg.text} ok={msg.ok} />
        </div>
      )}

      {/* ── ส่วนที่ 0: Pending Approval Queue ─────────────────── */}
      <div className="panel px-5 py-5 space-y-4 mb-5"
        style={{ border: pendingUsers.length > 0 ? "1px solid rgba(245,196,81,0.25)" : undefined }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
              🔔 รอการอนุมัติ
            </div>
            {pendingUsers.length > 0 && (
              <span className="text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse"
                style={{ background: "rgba(245,196,81,0.15)", color: "#f5c451", border: "1px solid rgba(245,196,81,0.3)" }}>
                {pendingUsers.length} รายการ
              </span>
            )}
          </div>
          <button onClick={loadPending}
            className="text-[9px] px-3 py-1.5 rounded-lg font-bold"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
            🔄
          </button>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="text-center py-6 text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
            ✓ ไม่มีผู้ใช้รอการอนุมัติ
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map(u => {
              const tierForUser = approveTier[u.email] ?? "free";
              return (
                <div key={u.email} className="rounded-xl px-4 py-3 space-y-3"
                  style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.12)" }}>
                  <div className="flex items-center gap-3">
                    {u.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.picture} alt="" className="w-9 h-9 rounded-full shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg"
                        style={{ background: "rgba(245,196,81,0.08)" }}>👤</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold truncate" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {u.name}
                      </div>
                      <div className="text-[9px] truncate" style={{ color: "rgba(175,185,215,0.4)" }}>
                        {u.email}
                      </div>
                      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
                        สมัคร: {new Date(u.registeredAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={tierForUser}
                      onChange={e => setApproveTier(prev => ({ ...prev, [u.email]: e.target.value as Tier }))}
                      className="rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: TIER_COLORS[tierForUser] }}>
                      <option value="free">free</option>
                      <option value="premium">premium</option>
                      <option value="pro">pro</option>
                    </select>
                    <button
                      onClick={() => callPendingApi({ action: "approve", email: u.email, tier: tierForUser })}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                      style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}>
                      ✓ อนุมัติ
                    </button>
                    <button
                      onClick={() => callPendingApi({ action: "reject", email: u.email })}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                      style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
                      ✗ ปฏิเสธ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ส่วนที่ 1: Admin list ─────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-4 mb-5">
        <div className="flex items-center justify-between">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
            👑 Admin ทั้งหมด ({allAdmins.length})
          </div>
        </div>

        <div className="space-y-2">
          {allAdmins.map(email => {
            const isSuper = data.superAdmins.includes(email);
            return (
              <div key={email} className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: isSuper ? "rgba(245,196,81,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${isSuper ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.06)"}` }}>
                <div className="text-lg">{isSuper ? "👑" : "🛡️"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold truncate" style={{ color: isSuper ? "#f5c451" : "rgba(255,255,255,0.7)" }}>
                    {email}
                  </div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                    {isSuper ? "Super Admin (ตั้งค่าใน ADMIN_EMAILS env)" : "Admin (เพิ่มผ่าน Admin Panel)"}
                  </div>
                </div>
                <TierBadge tier="pro" />
                {!isSuper && (
                  <button
                    onClick={() => callApi({ action: "remove_admin", email })}
                    className="text-[9px] px-2 py-1 rounded-lg font-bold transition-all hover:opacity-80"
                    style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                    ลบ
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add admin form */}
        <div className="border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
            ➕ เพิ่ม Admin ใหม่
          </div>
          <div className="flex gap-2">
            <input
              ref={addEmailRef}
              type="email"
              placeholder="email@example.com"
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.8)" }}
            />
            <button
              onClick={() => {
                const e = addEmailRef.current?.value?.trim();
                if (e) callApi({ action: "add_admin", email: e });
              }}
              className="rounded-xl px-4 py-2 text-xs font-bold shrink-0"
              style={{ background: "rgba(192,132,252,0.15)", border: "1px solid rgba(192,132,252,0.35)", color: "#c084fc" }}>
              เพิ่ม Admin
            </button>
          </div>
          <div className="text-[8px] mt-1.5" style={{ color: "rgba(175,185,215,0.3)" }}>
            Admin ใหม่จะได้รับ tier Pro โดยอัตโนมัติ และสามารถเข้าถึงฟีเจอร์ครบทุกอย่าง
          </div>
        </div>
      </div>

      {/* ── ส่วนที่ 2: Set user tier ──────────────────────────── */}
      <div className="panel px-5 py-5 space-y-4 mb-5">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🎛️ ตั้ง Tier ให้ผู้ใช้
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={userEmailRef}
            type="email"
            placeholder="user@example.com"
            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-xs outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.8)" }}
          />
          <select
            value={userTier}
            onChange={e => setUserTier(e.target.value as Tier)}
            className="rounded-xl px-3 py-2 text-xs font-bold outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: TIER_COLORS[userTier] }}>
            <option value="free">free</option>
            <option value="premium">premium</option>
            <option value="pro">pro</option>
          </select>
          <button
            onClick={() => {
              const e = userEmailRef.current?.value?.trim();
              if (e) callApi({ action: "set_tier", email: e, tier: userTier });
            }}
            className="rounded-xl px-4 py-2 text-xs font-bold shrink-0"
            style={{ background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}>
            บันทึก Tier
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[9px] text-center">
          {(["free", "premium", "pro"] as Tier[]).map(t => (
            <div key={t} className="rounded-lg px-2 py-2" style={{ background: TIER_BG[t], border: `1px solid ${TIER_COLORS[t]}25` }}>
              <div className="font-black mb-0.5" style={{ color: TIER_COLORS[t] }}>{t.toUpperCase()}</div>
              <div style={{ color: "rgba(175,185,215,0.4)" }}>
                {t === "free" ? "หน้าพื้นฐาน" : t === "premium" ? "Premium features" : "ทุกฟีเจอร์"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ส่วนที่ 3: Users table ───────────────────────────── */}
      <div className="panel px-5 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
            👥 ผู้ใช้ทั้งหมด ({data.users.length})
          </div>
          <button onClick={load}
            className="text-[9px] px-3 py-1.5 rounded-lg font-bold"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
            🔄 รีเฟรช
          </button>
        </div>

        {data.users.length === 0 ? (
          <div className="text-center py-8 text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            ยังไม่มีผู้ใช้ในระบบ<br />
            <span className="text-[8px]">ผู้ใช้จะปรากฏเมื่อ login ผ่าน Google และมีการตั้ง tier</span>
          </div>
        ) : (
          <div className="space-y-2">
            {data.users.map(u => (
              <div key={u.email} className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-sm">{u.isAdmin ? "🛡️" : "👤"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] truncate" style={{ color: u.isAdmin ? "#f5c451" : "rgba(255,255,255,0.6)" }}>
                    {u.email}
                  </div>
                </div>
                <TierBadge tier={u.tier} />
                {/* Quick tier buttons */}
                <div className="flex gap-1">
                  {(["free", "premium", "pro"] as Tier[]).filter(t => t !== u.tier).map(t => (
                    <button key={t}
                      onClick={() => callApi({ action: "set_tier", email: u.email, tier: t })}
                      className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: TIER_BG[t], color: TIER_COLORS[t], border: `1px solid ${TIER_COLORS[t]}30` }}>
                      → {t}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="mt-4 rounded-xl px-4 py-3 text-[9px] space-y-1"
        style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.12)" }}>
        <div className="font-bold" style={{ color: "rgba(168,85,247,0.6)" }}>💡 หมายเหตุ</div>
        <div style={{ color: "rgba(175,185,215,0.45)" }}>
          • <strong style={{ color: "rgba(175,185,215,0.6)" }}>Super Admin</strong> (👑) กำหนดใน <code>ADMIN_EMAILS</code> ใน Vercel/env — ลบไม่ได้จาก UI
        </div>
        <div style={{ color: "rgba(175,185,215,0.45)" }}>
          • <strong style={{ color: "rgba(175,185,215,0.6)" }}>Admin</strong> (🛡️) เพิ่มผ่าน UI นี้ — เก็บใน Redis/in-memory — สามารถลบได้
        </div>
        <div style={{ color: "rgba(175,185,215,0.45)" }}>
          • Admin ทุกคนได้ tier <strong style={{ color: "#c084fc" }}>Pro</strong> โดยอัตโนมัติ — เข้าถึงได้ครบทุกหน้า
        </div>
        <div style={{ color: "rgba(175,185,215,0.45)" }}>
          • การเปลี่ยน tier มีผลหลัง session refresh (~5 นาที) หรือ logout/login ใหม่
        </div>
      </div>
    </div>
  );
}
