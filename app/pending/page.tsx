"use client";

import { signOut, useSession } from "next-auth/react";

export default function PendingPage() {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1526 100%)" }}>
      <div className="w-full max-w-md text-center space-y-6">

        {/* Icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: "#f5c451" }} />
          <div className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{ background: "rgba(245,196,81,0.08)", border: "2px solid rgba(245,196,81,0.25)" }}>
            ⏳
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-xl font-black" style={{ color: "#f5c451" }}>
            Awaiting Approval
          </h1>
          <p className="text-sm mt-1" style={{ color: "#f5c451", opacity: 0.6 }}>
            รอการอนุมัติจากผู้ดูแลระบบ
          </p>
        </div>

        {/* Message box */}
        <div className="rounded-xl px-6 py-5 text-left space-y-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,196,81,0.12)" }}>
          {session?.user && (
            <div className="flex items-center gap-3 pb-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="w-9 h-9 rounded-full" />
              )}
              <div>
                <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {session.user.name}
                </div>
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                  {session.user.email}
                </div>
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
            บัญชีของคุณถูกสร้างแล้ว แต่ยังรอการอนุมัติจากผู้ดูแลระบบ
            โปรดรอและลองเข้าสู่ระบบอีกครั้งในภายหลัง
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.35)" }}>
            Your account has been created and is pending admin approval.
            Please wait and try signing in again later.
          </p>
        </div>

        {/* Steps */}
        {[
          { n: 1, label: "สมัครเข้าใช้ด้วย Google", done: true },
          { n: 2, label: "ผู้ดูแลระบบได้รับแจ้งเตือนแล้ว", done: true },
          { n: 3, label: "ผู้ดูแลระบบอนุมัติบัญชีของคุณ", done: false },
          { n: 4, label: "เข้าใช้งานได้ทันที", done: false },
        ].map(s => (
          <div key={s.n} className="flex items-center gap-3 text-left">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black"
              style={{
                background: s.done ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${s.done ? "#34d39940" : "rgba(255,255,255,0.08)"}`,
                color: s.done ? "#34d399" : "rgba(175,185,215,0.3)",
              }}>
              {s.done ? "✓" : s.n}
            </div>
            <span className="text-[11px]"
              style={{ color: s.done ? "rgba(52,211,153,0.7)" : "rgba(175,185,215,0.35)" }}>
              {s.label}
            </span>
          </div>
        ))}

        {/* Sign out */}
        <button onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full py-2.5 rounded-lg text-xs font-bold transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(175,185,215,0.4)" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
