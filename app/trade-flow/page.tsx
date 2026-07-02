"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { HubSummary, TradeFlowPayload, TradeRoute } from "@/app/api/trade-flow/route";

const ROLE_ICONS: Record<string, string> = {
  refining_hub:   "⚗️",
  consumer:       "🛍️",
  producer:       "⛏️",
  financial_hub:  "🏛️",
};

function RouteCard({ r }: { r: TradeRoute }) {
  const sizeColor = r.significance === "major" ? "#f5c451" : r.significance === "moderate" ? "#9ca3af" : "#4b5563";
  const dir = r.yoyChangePct >= 0;
  return (
    <div className="rounded-xl px-4 py-3 space-y-2"
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${r.goldImpact === "bullish" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.05)"}` }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">{r.fromFlag}</span>
          <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>→</span>
          <span className="text-sm">{r.toFlag}</span>
          <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
            {r.fromTh} → {r.toTh}
          </span>
          <span className="text-[7px] px-1 rounded" style={{ background: `${sizeColor}20`, color: sizeColor }}>
            {r.significance.toUpperCase()}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-black" style={{ color: "#f5c451" }}>{r.tonnesQ1}t</div>
          <div className="text-[8px] font-bold" style={{ color: dir ? "#34d399" : "#f87171" }}>
            {dir ? "+" : ""}{r.yoyChangePct.toFixed(1)}% YoY
          </div>
        </div>
      </div>
      <div className="text-[8px] font-bold" style={{ color: r.goldImpact === "bullish" ? "#34d399" : r.goldImpact === "bearish" ? "#f87171" : "#9ca3af" }}>
        🪙 {r.goldImpactTh}
      </div>
      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{r.note}</div>
    </div>
  );
}

function HubCard({ h }: { h: HubSummary }) {
  const isNetImport = h.netImport > 0;
  return (
    <div className="rounded-xl px-4 py-3 space-y-2"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{h.flag}</span>
          <div>
            <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>{h.countryTh}</div>
            <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
              {ROLE_ICONS[h.role]} {h.roleTh}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold" style={{ color: isNetImport ? "#34d399" : "#f87171" }}>
            {isNetImport ? "Net Import" : "Net Export"}
          </div>
          <div className="text-xs font-black" style={{ color: "#f5c451" }}>{Math.abs(h.netImport)}t</div>
        </div>
      </div>
      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>{h.description}</div>
      <div className="text-[8px]" style={{ color: h.yoyChangePct >= 0 ? "#34d399" : "#f87171" }}>
        YoY: {h.yoyChangePct >= 0 ? "+" : ""}{h.yoyChangePct.toFixed(1)}%
      </div>
    </div>
  );
}

function FlowBar({ routes }: { routes: TradeRoute[] }) {
  const max = Math.max(...routes.map(r => r.tonnesQ1));
  return (
    <div className="space-y-2">
      {routes.map(r => (
        <div key={`${r.from}-${r.to}`} className="flex items-center gap-3">
          <div className="w-24 text-[8px] truncate" style={{ color: "rgba(175,185,215,0.5)" }}>
            {r.fromFlag}{r.toFlag} {r.fromTh.slice(0, 6)}→{r.toTh.slice(0, 4)}
          </div>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-full" style={{
              width: `${(r.tonnesQ1 / max) * 100}%`,
              background: r.goldImpact === "bullish" ? "rgba(52,211,153,0.7)" : r.goldImpact === "bearish" ? "rgba(248,113,113,0.7)" : "rgba(245,196,81,0.5)",
            }} />
          </div>
          <div className="w-10 text-right text-[8px] font-bold" style={{ color: "#f5c451" }}>{r.tonnesQ1}t</div>
        </div>
      ))}
    </div>
  );
}

export default function TradeFlowPage() {
  const [data, setData]       = useState<TradeFlowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [tab, setTab]         = useState<"routes" | "hubs">("routes");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/trade-flow", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🌊 Gold Trade Flow"
        subtitle="กระแสการค้าทองคำโลก — เส้นทางการนำเข้า/ส่งออกและศูนย์กลาง Q1 2026"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🌊 กำลังโหลด trade flow…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Total Flow Q1</div>
                <div className="text-2xl font-black" style={{ color: "#f5c451" }}>{data.totalFlowQ1}t</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>YoY Change</div>
                <div className="text-2xl font-black" style={{ color: data.yoyChangePct >= 0 ? "#34d399" : "#f87171" }}>
                  {data.yoyChangePct >= 0 ? "+" : ""}{data.yoyChangePct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
                <div className="text-2xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
              </div>
            </div>

            <div className="rounded-xl px-4 py-3" style={{ background: `${data.flowColor}10`, border: `1px solid ${data.flowColor}30` }}>
              <div className="text-xs font-bold" style={{ color: data.flowColor }}>🌊 {data.flowSignalTh}</div>
            </div>

            <div className="text-[9px] space-y-0.5">
              <div style={{ color: "rgba(175,185,215,0.4)" }}>Hotspot ล่าสุด:</div>
              <div className="font-bold" style={{ color: "#f5c451" }}>{data.hotspot}</div>
            </div>
          </div>

          {/* Volume bar chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>เส้นทางการค้า Q1 (ปริมาณ tonnes)</div>
            <FlowBar routes={data.routes} />
            <div className="flex gap-3 mt-3 text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              <span><span style={{ color: "#34d399" }}>■</span> Bullish ต่อทอง</span>
              <span><span style={{ color: "#f5c451" }}>■</span> Neutral</span>
              <span><span style={{ color: "#f87171" }}>■</span> Bearish</span>
            </div>
          </div>

          {/* Tab: Routes / Hubs */}
          <div className="flex gap-1">
            {(["routes", "hubs"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="rounded-lg px-3 py-1.5 text-[10px] font-bold"
                style={{
                  background: tab === t ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${tab === t ? "rgba(245,196,81,0.4)" : "rgba(255,255,255,0.06)"}`,
                  color: tab === t ? "#f5c451" : "rgba(175,185,215,0.4)",
                }}>
                {t === "routes" ? "🗺️ เส้นทาง" : "🏛️ ศูนย์กลาง"}
              </button>
            ))}
          </div>

          {tab === "routes" ? (
            <div className="space-y-3">
              {data.routes.map(r => <RouteCard key={`${r.from}-${r.to}`} r={r} />)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.hubs.map(h => <HubCard key={h.country} h={h} />)}
            </div>
          )}

          {/* Education */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 วิธีอ่าน Trade Flow
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ Flow เพิ่มสู่ China/India → consumer demand เพิ่ม → bullish</li>
              <li>→ US → UK export เพิ่มผิดปกติ → COMEX/LBMA arbitrage → watch basis</li>
              <li>→ Russia → China flow เพิ่ม → de-dollarization signal</li>
              <li>→ Swiss import เพิ่ม = raw gold เข้ากลั่น; Swiss export = refined demand</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ ข้อมูลอ้างอิง UN Comtrade, WGC Q1 2026 estimates
            </p>
            <button onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
