"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Bilingual } from "@/lib/types";
import type { AgentOpinion, CouncilResult } from "@/lib/council";
import type { LearningStats } from "@/lib/councilLearning";

type Council = CouncilResult;
type Learning = LearningStats;

// ── status derivation ────────────────────────────────────────────────────────
type LedState = "work" | "idle" | "warn" | "danger";
const LED: Record<LedState, string> = { work: "#34d399", idle: "#64748b", warn: "#f5c451", danger: "#f87171" };

function agentStatus(a: AgentOpinion, loading: boolean): { led: LedState; th: string; en: string } {
  if (loading) return { led: "warn", th: "กำลังวิเคราะห์", en: "ANALYZING" };
  if (a.id === "risk") {
    if (a.gate === "block") return { led: "danger", th: "ยับยั้งการเทรด", en: "BLOCKING" };
    if (a.gate === "caution") return { led: "warn", th: "เฝ้าระวัง", en: "CAUTION" };
    return { led: "work", th: "เฝ้าดูความเสี่ยง", en: "MONITORING" };
  }
  if (a.vote === "BUY") return { led: "work", th: "สัญญาณ: ซื้อ", en: "SIGNAL: BUY" };
  if (a.vote === "SELL") return { led: "danger", th: "สัญญาณ: ขาย", en: "SIGNAL: SELL" };
  if (a.vote === "REDUCE_LOT") return { led: "warn", th: "ลดขนาดล็อต", en: "REDUCE SIZE" };
  if (a.vote === "CLOSE") return { led: "danger", th: "สั่งปิดสถานะ", en: "CLOSE ALL" };
  return { led: "idle", th: "สแตนด์บาย", en: "STANDBY" };
}

// EA Factory pipeline stations (on-demand capabilities).
const FACTORY: { id: string; icon: string; name: Bilingual; job: Bilingual; href: string }[] = [
  { id: "gen", icon: "🧠", name: { th: "Strategy Generator", en: "Strategy Generator" }, job: { th: "สร้างกลยุทธ์ EA", en: "Generate EA strategies" }, href: "/ai-ea" },
  { id: "bt", icon: "🧪", name: { th: "Backtest Engine", en: "Backtest Engine" }, job: { th: "ทดสอบย้อนหลัง", en: "Backtest on history" }, href: "/backtest" },
  { id: "opt", icon: "⚙️", name: { th: "Optimizer", en: "Optimizer" }, job: { th: "จูนพารามิเตอร์", en: "Tune parameters" }, href: "/ai-ea" },
  { id: "rob", icon: "🛡️", name: { th: "Robustness", en: "Robustness" }, job: { th: "กรอง Overfit (WF+MC)", en: "Filter overfit (WF+MC)" }, href: "/robustness" },
  { id: "port", icon: "🧩", name: { th: "Portfolio Manager", en: "Portfolio Manager" }, job: { th: "จัดสรรพอร์ต EA", en: "Allocate EA portfolio" }, href: "/ea-portfolio" },
];

function Led({ state, pulse }: { state: LedState; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: LED[state] }} />}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: LED[state], boxShadow: `0 0 8px ${LED[state]}` }} />
    </span>
  );
}

function useClock(): string {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("en-GB"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export default function CommandCenterPage() {
  const { lang } = useI18n();
  const L = useCallback((b: Bilingual) => b[lang], [lang]);
  const clock = useClock();

  const [council, setCouncil] = useState<Council | null>(null);
  const [learning, setLearning] = useState<Learning | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [lastSync, setLastSync] = useState<string>("—");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        fetch("/api/council", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/council/learning", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (c && !c.error) { setCouncil(c as Council); setOnline(true); }
      else setOnline(false);
      if (l && !l.error) setLearning(l as Learning);
      setLastSync(new Date().toLocaleTimeString("en-GB"));
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000); // re-convene the council periodically
    return () => clearInterval(id);
  }, [load]);

  const relById = (id: string) => learning?.agents.find((a) => a.id === id);
  const agents = council?.agents ?? [];
  const councilOnline = 6;
  const factoryOnline = FACTORY.length;
  const avgAcc = learning && learning.agents.length
    ? Math.round(learning.agents.filter((a) => a.samples > 0).reduce((s, a, _, arr) => s + a.hitRate / arr.length, 0))
    : null;

  const panel = "rounded-2xl border" as const;
  const border = "1px solid rgba(56,189,248,0.18)";
  const bg = "rgba(6,11,26,0.7)";

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
      {/* ── HUD header bar ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
        style={{ border, background: "linear-gradient(90deg, rgba(56,189,248,0.08), rgba(168,85,247,0.06))" }}>
        <div className="flex items-center gap-3">
          <span className="text-lg">🛰️</span>
          <div>
            <div className="font-mono text-sm font-black tracking-widest" style={{ color: "#7dd3fc" }}>AI COMMAND CENTER <span className="text-silver/30">v1.0</span></div>
            <div className="text-[10px] text-silver/40">{lang === "th" ? "ศูนย์บัญชาการ AI · ข้อมูลสด XAUUSD" : "Live AI operations · XAUUSD"}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-silver/35">Time</div>
            <div className="font-mono text-sm font-bold text-silver/80">{clock}</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1" style={{ background: online ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${online ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}` }}>
            <Led state={loading ? "warn" : online ? "work" : "danger"} pulse={loading} />
            <span className="font-mono text-[11px] font-bold" style={{ color: loading ? "#f5c451" : online ? "#34d399" : "#f87171" }}>
              {loading ? "SYNCING" : online ? "OPTIMAL" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
        {/* ── TEAM STATUS rail ── */}
        <div className={panel} style={{ border, background: bg }}>
          <div className="border-b px-4 py-2.5 text-[10px] uppercase tracking-widest text-silver/40" style={{ borderColor: "rgba(56,189,248,0.12)" }}>
            {lang === "th" ? "สถานะทีม" : "Team Status"}
          </div>
          <div className="p-2">
            {agents.map((a) => {
              const st = agentStatus(a, loading);
              return (
                <div key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                  <Led state={st.led} pulse={loading} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-silver/80">{L(a.name)}</div>
                    <div className="truncate font-mono text-[9px]" style={{ color: LED[st.led] }}>{lang === "th" ? st.th : st.en}</div>
                  </div>
                </div>
              );
            })}
            {agents.length === 0 && <div className="px-2 py-3 text-[10px] text-silver/30">{loading ? "…" : "—"}</div>}
            <div className="my-1 border-t" style={{ borderColor: "rgba(56,189,248,0.1)" }} />
            {FACTORY.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <Led state="idle" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-silver/70">{L(f.name)}</div>
                  <div className="truncate font-mono text-[9px] text-silver/35">READY</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── main ── */}
        <div className="space-y-4">
          {/* Council decision banner */}
          {council && (
            <div className={panel} style={{ border, background: bg }}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-silver/40">{lang === "th" ? "มติสภา" : "Council Verdict"}</span>
                  <span className="font-mono text-lg font-black" style={{ color: council.decision === "BUY" ? "#34d399" : council.decision === "SELL" || council.decision === "CLOSE" ? "#f87171" : council.decision === "REDUCE_LOT" ? "#fb923c" : "#f5c451" }}>
                    {council.decision}
                  </span>
                  <span className="font-mono text-sm text-silver/60">{council.confidence}%</span>
                </div>
                <div className="font-mono text-[11px] text-silver/40">
                  BUY {council.quorum.buy}/6 · SELL {council.quorum.sell}/6 · ${council.price.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* ── 1. Trading Council ── */}
          <div className={panel} style={{ border, background: bg }}>
            <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: "rgba(56,189,248,0.12)" }}>
              <span className="font-mono text-[11px] font-black tracking-widest" style={{ color: "#7dd3fc" }}>1 · TRADING COUNCIL</span>
              <span className="text-[10px] text-silver/35">{councilOnline} {lang === "th" ? "ตัว" : "agents"}</span>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => {
                const st = agentStatus(a, loading);
                const rel = relById(a.id);
                return (
                  <div key={a.id} className="rounded-xl p-3" style={{ border: `1px solid ${LED[st.led]}30`, background: "rgba(6,9,26,0.6)" }}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Led state={st.led} pulse={loading} />
                        <span className="text-[12px] font-bold text-silver/90">{L(a.name)}</span>
                      </div>
                      <span className="font-mono text-[9px]" style={{ color: LED[st.led] }}>{lang === "th" ? st.th : st.en}</span>
                    </div>
                    <div className="mb-2 text-[9px] text-silver/35">{L(a.role)}</div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-silver/50">conf {a.confidence}%</span>
                      {a.reliability != null && a.reliability !== 1 && (
                        <span className="font-mono" style={{ color: a.reliability > 1 ? "#34d399" : "#f87171" }}>trust ×{a.reliability.toFixed(2)}</span>
                      )}
                      {rel && rel.samples > 0 && <span className="font-mono text-silver/40">acc {rel.hitRate}%</span>}
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${a.confidence}%`, background: LED[st.led] }} />
                    </div>
                  </div>
                );
              })}
              {agents.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }} />
              ))}
            </div>
          </div>

          {/* ── 2. EA Factory pipeline ── */}
          <div className={panel} style={{ border, background: bg }}>
            <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: "rgba(56,189,248,0.12)" }}>
              <span className="font-mono text-[11px] font-black tracking-widest" style={{ color: "#c084fc" }}>2 · EA FACTORY</span>
              <span className="text-[10px] text-silver/35">{factoryOnline} {lang === "th" ? "สถานี" : "stations"}</span>
            </div>
            <div className="flex flex-wrap items-stretch gap-2 p-3">
              {FACTORY.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <a href={f.href} className="group flex w-[150px] flex-col rounded-xl p-3 transition-all hover:scale-[1.02]"
                    style={{ border: "1px solid rgba(168,85,247,0.22)", background: "rgba(6,9,26,0.6)" }}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-base">{f.icon}</span>
                      <span className="flex items-center gap-1 font-mono text-[8px] text-silver/40"><Led state="idle" /> READY</span>
                    </div>
                    <div className="text-[11px] font-bold text-silver/85 group-hover:text-white">{L(f.name)}</div>
                    <div className="text-[9px] text-silver/40">{L(f.job)}</div>
                  </a>
                  {i < FACTORY.length - 1 && <span className="text-silver/25">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* ── 3. System metrics ── */}
          <div className={panel} style={{ border, background: "linear-gradient(90deg, rgba(56,189,248,0.06), rgba(6,11,26,0.7))" }}>
            <div className="border-b px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-silver/40" style={{ borderColor: "rgba(56,189,248,0.12)" }}>
              {lang === "th" ? "เมตริกระบบ" : "System Metrics"}
            </div>
            <div className="grid grid-cols-2 gap-px sm:grid-cols-4 lg:grid-cols-6" style={{ background: "rgba(56,189,248,0.08)" }}>
              {[
                { k: lang === "th" ? "AI ทำงาน" : "Agents", v: `${councilOnline + factoryOnline}`, c: "#34d399" },
                { k: lang === "th" ? "มติสะสม" : "Decisions", v: learning ? `${learning.totalEntries}` : "—", c: "#7dd3fc" },
                { k: lang === "th" ? "ประเมินแล้ว" : "Scored", v: learning ? `${learning.evaluatedEntries}` : "—", c: "#c084fc" },
                { k: lang === "th" ? "แม่นเฉลี่ย" : "Avg Acc", v: avgAcc != null ? `${avgAcc}%` : "—", c: avgAcc != null && avgAcc >= 55 ? "#34d399" : "#f5c451" },
                { k: lang === "th" ? "มติปัจจุบัน" : "Consensus", v: council ? `${council.decision}` : "—", c: "#f5c451" },
                { k: "Data Flow", v: online ? "LIVE" : "—", c: online ? "#34d399" : "#f87171" },
              ].map((m) => (
                <div key={m.k} className="px-3 py-2.5" style={{ background: "rgba(6,11,26,0.85)" }}>
                  <div className="text-[8px] uppercase tracking-widest text-silver/35">{m.k}</div>
                  <div className="font-mono text-sm font-black" style={{ color: m.c }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 py-2 text-[9px] text-silver/30">
              <span>{lang === "th" ? "อัปเดตทุก 30 วินาที" : "Auto-refresh 30s"} · {lang === "th" ? "ซิงก์ล่าสุด" : "last sync"} {lastSync}</span>
              <button onClick={load} disabled={loading} className="font-mono text-[10px] disabled:opacity-40" style={{ color: "#7dd3fc" }}>
                {loading ? "⟳ SYNC…" : "⟳ SYNC NOW"}
              </button>
            </div>
          </div>

          <div className="rounded-xl px-4 py-2 text-[9px] text-silver/30" style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.1)" }}>
            ⚠️ {lang === "th" ? "สถานะ agent เป็นข้อมูลวิเคราะห์สด ไม่ใช่คำแนะนำการลงทุน · โรงงาน EA ทำงานตามคำสั่ง (คลิกเพื่อเปิด)" : "Live analysis, not investment advice · EA Factory stations run on demand (click to open)"}
          </div>
        </div>
      </div>
    </div>
  );
}
