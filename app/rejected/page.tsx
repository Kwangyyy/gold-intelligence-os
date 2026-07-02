"use client";

import { signOut } from "next-auth/react";

export default function RejectedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1526 100%)" }}>
      <div className="w-full max-w-md text-center space-y-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto"
          style={{ background: "rgba(248,113,113,0.08)", border: "2px solid rgba(248,113,113,0.2)" }}>
          🚫
        </div>
        <div>
          <h1 className="text-xl font-black" style={{ color: "#f87171" }}>Access Denied</h1>
          <p className="text-sm mt-1" style={{ color: "#f87171", opacity: 0.6 }}>ไม่ได้รับอนุญาตให้เข้าใช้งาน</p>
        </div>
        <div className="rounded-xl px-6 py-4 text-[11px] leading-relaxed space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(248,113,113,0.12)", color: "rgba(175,185,215,0.4)" }}>
          <p>คำขอเข้าใช้งานของคุณไม่ได้รับการอนุมัติจากผู้ดูแลระบบ</p>
          <p>Your access request was not approved by the administrator.</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full py-2.5 rounded-lg text-xs font-bold"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
