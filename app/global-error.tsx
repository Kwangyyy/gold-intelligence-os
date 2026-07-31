"use client";

// Last-resort boundary. app/error.tsx cannot catch a failure in the root layout
// itself — if that throws, React unmounts everything and only this runs, which
// is why it has to ship its own <html> and <body> and inline styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body style={{ margin: 0, background: "#06091a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 560, margin: "12vh auto", padding: "0 16px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#f87171", margin: "0 0 8px" }}>
            ระบบมีข้อผิดพลาดร้ายแรง
          </h1>
          <p style={{ fontSize: 12, color: "rgba(175,185,215,0.55)", margin: "0 0 16px" }}>
            โหลดหน้าใหม่อีกครั้ง — ถ้ายังเกิดซ้ำ กด Ctrl+Shift+R เพื่อล้าง cache
          </p>
          <div style={{
            background: "rgba(0,0,0,0.35)", border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: 8, padding: "8px 12px", textAlign: "left",
            fontFamily: "ui-monospace, monospace", fontSize: 10,
            color: "rgba(248,113,113,0.85)", wordBreak: "break-word", marginBottom: 20,
          }}>
            {error?.message || "Unknown error"}
            {error?.digest && (
              <div style={{ marginTop: 4, color: "rgba(175,185,215,0.4)" }}>digest: {error.digest}</div>
            )}
          </div>
          <button
            onClick={reset}
            style={{
              background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)",
              color: "#f5c451", borderRadius: 12, padding: "8px 16px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
