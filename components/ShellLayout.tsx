"use client";

import { useState } from "react";
import { SideNav } from "./SideNav";

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

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
    </div>
  );
}
