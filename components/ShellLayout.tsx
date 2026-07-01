"use client";

import { useEffect, useRef, useState } from "react";
import { SideNav } from "./SideNav";

const SIG_COLORS: Record<string, string> = { BUY: "#34d399", SELL: "#f87171", HOLD: "#f5c451" };

function SignalToast({ prev, curr, onDismiss }: { prev: string; curr: string; onDismiss: () => void }) {
  const color = SIG_COLORS[curr] ?? "#f5c451";
  return (
    <div className="fixed bottom-5 right-5 z-[999]" style={{ animation: "slideUp 0.35s ease" }}>
      <style>{`@keyframes slideUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div className="flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl"
        style={{ background: "rgba(6,9,26,0.97)", border: `1px solid ${color}50`, minWidth: 270, backdropFilter: "blur(20px)" }}>
        <div>
          <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>🧠 AI Signal เปลี่ยน</div>
          <div className="flex items-center gap-2 text-sm font-black">
            <span style={{ color: SIG_COLORS[prev] ?? "#64748b" }}>{prev}</span>
            <span className="font-normal" style={{ color: "rgba(175,185,215,0.3)" }}>→</span>
            <span style={{ color }}>{curr}</span>
          </div>
        </div>
        <a href="/ai-model" className="ml-auto rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all"
          style={{ background: `${color}15`, border: `1px solid ${color}35`, color }}>ดู →</a>
        <button onClick={onDismiss} className="text-xs ml-1" style={{ color: "rgba(175,185,215,0.25)" }}>✕</button>
      </div>
    </div>
  );
}

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ prev: string; curr: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function check() {
      try {
        const raw = localStorage.getItem("gold-ai-model-meta");
        if (!raw) return;
        const curr: string | undefined = JSON.parse(raw)?.signal?.decision;
        if (!curr) return;
        const seen = localStorage.getItem("_gios_sig_seen");
        if (seen && seen !== curr) {
          setToast({ prev: seen, curr });
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setToast(null), 7000);
        }
        localStorage.setItem("_gios_sig_seen", curr);
      } catch {}
    }
    check();
    const id = setInterval(check, 30_000);
    return () => { clearInterval(id); if (timer.current) clearTimeout(timer.current); };
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <SideNav open={open} onClose={() => setOpen(false)} />

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main — offset on desktop */}
      <div className="flex min-w-0 flex-1 flex-col md:ml-[232px]">
        {/* Mobile top bar */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 md:hidden"
          style={{
            background: "rgba(6, 9, 26, 0.92)",
            backdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(245,196,81,0.14)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <button
            onClick={() => setOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
            style={{
              border: "1px solid rgba(168,85,247,0.35)",
              color: "rgba(175,185,215,0.8)",
            }}
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <span
            className="text-sm font-bold"
            style={{
              background: "linear-gradient(95deg, #fbe6a2 0%, #f5c451 48%, #c084fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Gold Intelligence OS
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>

      {toast && <SignalToast prev={toast.prev} curr={toast.curr} onDismiss={() => setToast(null)} />}
    </div>
  );
}
