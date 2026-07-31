"use client";

import { useEffect, useState } from "react";
import type { OiLevelsPayload } from "@/app/api/oi-levels/route";

// Compact OI / expected-range readout.
//
// This exists as a panel rather than a chart overlay because /chart embeds
// TradingView in an iframe — a cross-origin document we cannot draw into. The
// levels are listed so they can be typed into TradingView by hand, and the same
// data is drawn directly on the NeoWave chart, which we render ourselves.
export function OiLevelsPanel({ pollMs = 60_000 }: { pollMs?: number }) {
  const [oi, setOi] = useState<OiLevelsPayload | null>(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/oi-levels?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(String(j.error)); else { setOi(j); setAt(new Date()); } })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  // Refresh as soon as the tab is looked at again — background timers get
  // throttled to a minute or more, so returning to the tab otherwise showed a
  // stale "LIVE" time until the next tick landed.
  useEffect(() => {
    const wake = () => { if (document.visibilityState === "visible") setTick((t) => t + 1); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => { document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, []);

  if (err) return (
    <div className="panel p-4 text-xs text-red-400">โหลด OI ไม่สำเร็จ: {err}</div>
  );
  // Guard on the fields we actually dereference, not just on `oi` being truthy.
  // A 200 response with an unexpected shape would otherwise throw inside render
  // (spreading undefined, calling toFixed on undefined) and, with no boundary
  // above it, blank the whole page instead of just this panel.
  if (!oi || !Array.isArray(oi.strikes) || !oi.expectedRange?.sd1) return (
    <div className="panel p-4 text-xs animate-pulse" style={{ color: "rgba(175,185,215,0.4)" }}>
      กำลังโหลด option chain…
    </div>
  );

  const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const rows = [...oi.strikes].sort((a, b) => num(b.total) - num(a.total)).slice(0, 12).sort((a, b) => num(b.strike) - num(a.strike));

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.35)" }}>
            🎯 Option OI · Expected Range
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "rgba(175,185,215,0.5)" }}>
            {oi.expiry} · อีก {oi.dte} วัน · ATM IV {(oi.atmIv * 100).toFixed(1)}%
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[9px] px-2 py-1 rounded-lg"
          style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#34d399" }} />
          LIVE{at ? ` · ${at.toLocaleTimeString("th-TH")}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
        {[
          { l: "Call Wall", v: `$${num(oi.callWall).toLocaleString()}`, c: "#f87171" },
          { l: "Put Wall",  v: `$${num(oi.putWall).toLocaleString()}`,  c: "#34d399" },
          { l: "Max Pain",  v: `$${num(oi.maxPain).toLocaleString()}`,  c: "#e2e8f0" },
          { l: "γ Flip",    v: `$${num(oi.gammaFlip).toLocaleString()}`, c: "#fb923c" },
          { l: "Net GEX",   v: `${num(oi.totalGex) >= 0 ? "+" : ""}${num(oi.totalGex).toFixed(1)}`, c: oi.gammaRegime === "long" ? "#34d399" : "#f87171" },
        ].map((s) => (
          <div key={s.l}>
            <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>{s.l}</div>
            <div className="font-mono text-sm font-black" style={{ color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1 mb-3">
        {([["1SD", oi.expectedRange.sd1, "#38bdf8"], ["2SD", oi.expectedRange.sd2, "#c084fc"], ["3SD", oi.expectedRange.sd3, "#94a3b8"]] as const)
          .filter(([, b]) => b && typeof b.low === "number")
          .map(([l, b, c]) => (
          <div key={l} className="flex items-center gap-2 text-[10px]">
            <span className="w-8 font-bold" style={{ color: c }}>{l}</span>
            <span className="font-mono" style={{ color: "#34d399" }}>${num(b.low).toLocaleString()}</span>
            <div className="flex-1 h-0.5 rounded" style={{ background: `${c}44` }} />
            <span className="font-mono" style={{ color: "#f87171" }}>${num(b.high).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr style={{ color: "rgba(175,185,215,0.35)" }}>
              {["Strike", "Calls", "Puts", "รวม", "GEX", "SD"].map((h) => (
                <th key={h} className="text-right py-1 px-1.5 font-normal uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.strikeGld} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: Math.abs(num(s.pctFromSpot)) < 1 ? "rgba(245,196,81,0.07)" : undefined }}>
                <td className="text-right py-1 px-1.5 font-mono font-bold" style={{ color: s.side === "call" ? "#f87171" : s.side === "put" ? "#34d399" : "#f5c451" }}>${num(s.strike).toLocaleString()}</td>
                <td className="text-right py-1 px-1.5 font-mono" style={{ color: "rgba(248,113,113,0.75)" }}>{num(s.calls).toLocaleString()}</td>
                <td className="text-right py-1 px-1.5 font-mono" style={{ color: "rgba(52,211,153,0.75)" }}>{num(s.puts).toLocaleString()}</td>
                <td className="text-right py-1 px-1.5 font-mono font-bold" style={{ color: "#e2e8f0" }}>{num(s.total).toLocaleString()}</td>
                <td className="text-right py-1 px-1.5 font-mono" style={{ color: num(s.gex) >= 0 ? "rgba(52,211,153,0.75)" : "rgba(248,113,113,0.75)" }}>{num(s.gex) >= 0 ? "+" : ""}{num(s.gex).toFixed(1)}</td>
                <td className="text-right py-1 px-1.5 font-bold" style={{ color: s.sd === 1 ? "#38bdf8" : s.sd === 2 ? "#c084fc" : "#94a3b8" }}>{s.sd}SD</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 pt-2 text-[9px] leading-relaxed" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(175,185,215,0.4)" }}>
        <div style={{ color: "rgba(251,146,60,0.75)" }}>
          ⓘ กราฟด้านบนเป็น TradingView (iframe) วาดเส้นทับไม่ได้ — ดูเส้น OI บนกราฟจริงได้ที่หน้า NeoWave
        </div>
        <div className="mt-0.5">{oi.sourceNoteTh}</div>
      </div>
    </div>
  );
}
