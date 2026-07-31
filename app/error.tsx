"use client";

import { useEffect } from "react";

// Route-level error boundary.
//
// Without this, any thrown error in a client component replaced the whole app
// with Next.js's bare "Application error: a client-side exception has occurred"
// — no sidebar, no navigation, and no way to tell what actually failed. One
// broken panel took the entire product down and left nothing to diagnose from.
// This keeps the failure visible and recoverable, and prints the real message.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="panel px-6 py-8 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-lg font-black mb-2" style={{ color: "#f87171" }}>
          หน้านี้มีข้อผิดพลาด
        </h1>
        <p className="text-xs mb-4" style={{ color: "rgba(175,185,215,0.55)" }}>
          ส่วนอื่นของระบบยังใช้งานได้ปกติ — ลองโหลดใหม่ หรือกลับไปหน้าอื่นก่อน
        </p>

        {/* The actual message, so a failure can be reported instead of guessed at. */}
        <div
          className="mb-5 rounded-lg px-3 py-2 text-left font-mono text-[10px] break-words"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(248,113,113,0.25)", color: "rgba(248,113,113,0.85)" }}
        >
          {error?.message || "Unknown error"}
          {error?.digest && (
            <div className="mt-1" style={{ color: "rgba(175,185,215,0.4)" }}>digest: {error.digest}</div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-xl px-4 py-2 text-xs font-bold"
            style={{ background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}
          >
            ลองใหม่
          </button>
          <a
            href="/"
            className="rounded-xl px-4 py-2 text-xs font-bold"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(175,185,215,0.6)" }}
          >
            กลับหน้าแรก
          </a>
        </div>

        <p className="mt-4 text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          ถ้าเกิดซ้ำหลัง deploy ใหม่ ให้กด Ctrl+Shift+R เพื่อล้าง JS chunk เก่าที่ค้างอยู่
        </p>
      </div>
    </div>
  );
}
