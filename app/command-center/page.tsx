"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Bilingual } from "@/lib/types";
import type { AgentOpinion, CouncilResult, CouncilVote } from "@/lib/council";
import type { LearningStats } from "@/lib/councilLearning";

type Council = CouncilResult;
type Learning = LearningStats;

// ── retro palette ────────────────────────────────────────────────────────────
const CY = "#38bdf8";   // cyan
const MG = "#e879f9";   // magenta
const GR = "#34d399";   // green
const AM = "#fbbf24";   // amber
const RD = "#f87171";   // red
const INK = "rgba(8,13,34,0.72)";
const LINE = "rgba(56,189,248,0.22)";

type LedState = "work" | "idle" | "warn" | "danger";
const LED: Record<LedState, string> = { work: GR, idle: "#64748b", warn: AM, danger: RD };

const VOTE_COLOR: Record<CouncilVote, string> = { BUY: GR, SELL: RD, WAIT: AM, REDUCE_LOT: "#fb923c", CLOSE: RD };
const VOTE_LABEL: Record<CouncilVote, Bilingual> = {
  BUY: { th: "ซื้อ", en: "BUY" }, SELL: { th: "ขาย", en: "SELL" }, WAIT: { th: "รอ", en: "WAIT" },
  REDUCE_LOT: { th: "ลดล็อต", en: "REDUCE" }, CLOSE: { th: "ปิด", en: "CLOSE" },
};

function agentState(a: AgentOpinion, loading: boolean): { led: LedState; label: string } {
  if (loading) return { led: "warn", label: "WORKING" };
  if (a.id === "risk") {
    if (a.gate === "block") return { led: "danger", label: "ALERT" };
    if (a.gate === "caution") return { led: "warn", label: "CAUTION" };
    return { led: "work", label: "WATCHING" };
  }
  if (a.vote === "BUY") return { led: "work", label: "BUY SIG" };
  if (a.vote === "SELL") return { led: "danger", label: "SELL SIG" };
  if (a.vote === "REDUCE_LOT") return { led: "warn", label: "REDUCE" };
  if (a.vote === "CLOSE") return { led: "danger", label: "CLOSE" };
  return { led: "idle", label: "STANDBY" };
}

const FACTORY: { id: string; icon: string; name: string; href: string }[] = [
  { id: "gen", icon: "🧠", name: "STRATEGY", href: "/ai-ea" },
  { id: "bt", icon: "🧪", name: "BACKTEST", href: "/backtest" },
  { id: "opt", icon: "⚙️", name: "OPTIMIZE", href: "/ai-ea" },
  { id: "rob", icon: "🛡️", name: "ROBUST", href: "/robustness" },
  { id: "port", icon: "🧩", name: "PORTFOLIO", href: "/ea-portfolio" },
];

// A blocky pixel robot, tinted by status.
function PixelBot({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" width="30" height="30" shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }}>
      <rect x="6" y="0" width="1" height="2" fill={color} />
      <rect x="3" y="2" width="10" height="8" fill="#131c3a" stroke="#31507e" strokeWidth="0.5" />
      <rect x="5" y="4" width="2" height="2" fill={color} />
      <rect x="9" y="4" width="2" height="2" fill={color} />
      <rect x="5" y="7" width="6" height="1" fill={color} opacity="0.7" />
      <rect x="4" y="10" width="8" height="5" fill="#0c1430" stroke="#26406a" strokeWidth="0.5" />
      <rect x="6" y="12" width="4" height="1" fill={color} opacity="0.6" />
    </svg>
  );
}

function Led({ state, pulse }: { state: LedState; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: LED[state] }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: LED[state], boxShadow: `0 0 6px ${LED[state]}` }} />
    </span>
  );
}

// Sci-fi panel with corner brackets + terminal title.
function Panel({ title, accent = CY, children, className = "" }: { title: string; accent?: string; children: React.ReactNode; className?: string }) {
  const corner = (pos: string) => (
    <span className="pointer-events-none absolute h-2.5 w-2.5" style={{ [pos.includes("t") ? "top" : "bottom"]: -1, [pos.includes("l") ? "left" : "right"]: -1, borderTop: pos.includes("t") ? `2px solid ${accent}` : undefined, borderBottom: pos.includes("b") ? `2px solid ${accent}` : undefined, borderLeft: pos.includes("l") ? `2px solid ${accent}` : undefined, borderRight: pos.includes("r") ? `2px solid ${accent}` : undefined } as React.CSSProperties} />
  );
  return (
    <div className={`relative ${className}`} style={{ border: `1px solid ${accent}33`, background: INK }}>
      {corner("tl")}{corner("tr")}{corner("bl")}{corner("br")}
      <div className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accent, borderBottom: `1px solid ${accent}22`, textShadow: `0 0 8px ${accent}66` }}>{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export default function CommandCenterPage() {
  const { lang } = useI18n();
  const L = useCallback((b: Bilingual) => b[lang], [lang]);

  const [council, setCouncil] = useState<Council | null>(null);
  const [learning, setLearning] = useState<Learning | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const t = () => setClock(new Date().toLocaleTimeString("en-GB"));
    t(); const id = setInterval(t, 1000); return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        fetch("/api/council", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/council/learning", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (c && !c.error) { setCouncil(c as Council); setOnline(true); } else setOnline(false);
      if (l && !l.error) setLearning(l as Learning);
    } catch { setOnline(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const agents = council?.agents ?? [];
  const relById = (id: string) => learning?.agents.find((a) => a.id === id);
  const avgAcc = learning && learning.agents.some((a) => a.samples > 0)
    ? Math.round(learning.agents.filter((a) => a.samples > 0).reduce((s, a, _, arr) => s + a.hitRate / arr.length, 0)) : null;
  const decColor = council ? VOTE_COLOR[council.decision] : AM;
  const sys: LedState = loading ? "warn" : online ? "work" : "danger";
  const totalAgents = 6 + FACTORY.length;

  return (
    <div className="relative min-h-screen font-mono text-slate-200" style={{ background: "#060a1a" }}>
      {/* grid + scanlines */}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`, backgroundSize: "26px 26px", opacity: 0.35 }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)" }} />
      <style>{`@keyframes flow{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes blink{50%{opacity:.35}}`}</style>

      <div className="relative mx-auto max-w-6xl px-3 py-4 sm:px-5">
        {/* ── header ── */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5" style={{ border: `1px solid ${CY}44`, background: "linear-gradient(90deg, rgba(56,189,248,0.1), rgba(232,121,249,0.06))" }}>
          <div className="flex items-center gap-2.5">
            <span style={{ animation: "blink 1.4s steps(1) infinite" }}>▮</span>
            <div className="text-sm font-black uppercase tracking-[0.25em]" style={{ color: CY, textShadow: `0 0 10px ${CY}77` }}>AI OFFICE <span style={{ color: MG }}>v1.0</span></div>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-2"><span className="text-slate-500">TIME</span><span className="font-bold" style={{ color: CY }}>{clock}</span></div>
            <div className="flex items-center gap-1.5 px-2 py-1" style={{ border: `1px solid ${LED[sys]}55`, background: `${LED[sys]}14` }}>
              <Led state={sys} pulse={loading} />
              <span className="font-bold uppercase tracking-widest" style={{ color: LED[sys] }}>{loading ? "SYNC" : online ? "OPTIMAL" : "OFFLINE"}</span>
            </div>
          </div>
        </div>

        {/* ── 3-column deck ── */}
        <div className="grid gap-3 lg:grid-cols-[210px_1fr_230px]">
          {/* LEFT: team status + company metrics */}
          <div className="space-y-3">
            <Panel title="Team Status" accent={CY}>
              <div className="space-y-1">
                {agents.map((a) => {
                  const st = agentState(a, loading);
                  return (
                    <div key={a.id} className="flex items-center gap-2 py-0.5">
                      <Led state={st.led} pulse={loading} />
                      <span className="flex-1 truncate text-[10px] text-slate-300">{L(a.name)}</span>
                      <span className="text-[8px] font-bold" style={{ color: LED[st.led] }}>[{st.label}]</span>
                    </div>
                  );
                })}
                {agents.length === 0 && <div className="py-2 text-[10px] text-slate-600">BOOTING…</div>}
              </div>
            </Panel>

            <Panel title="Company Metrics" accent={MG}>
              <div className="space-y-1.5 text-[11px]">
                {[
                  { k: "DECISIONS", v: learning ? `${learning.totalEntries}` : "—", c: CY },
                  { k: "AGENTS", v: `${totalAgents}`, c: GR },
                  { k: "STRATEGIES", v: "7", c: MG },
                  { k: "SCORED", v: learning ? `${learning.evaluatedEntries}` : "—", c: AM },
                  { k: "UPTIME", v: online ? "99.9%" : "—", c: online ? GR : RD },
                ].map((m) => (
                  <div key={m.k} className="flex items-center justify-between">
                    <span className="text-slate-500">{m.k}</span>
                    <span className="font-bold" style={{ color: m.c }}>{m.v}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* CENTER: command center + bot factory + review room */}
          <div className="space-y-3">
            <Panel title="1 · Command Center" accent={CY}>
              {council ? (
                <div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-slate-500">Council Verdict · {council.symbol}</div>
                      <div className="text-3xl font-black uppercase" style={{ color: decColor, textShadow: `0 0 14px ${decColor}66` }}>{L(VOTE_LABEL[council.decision])}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-widest text-slate-500">Confidence</div>
                      <div className="text-2xl font-black" style={{ color: decColor }}>{council.confidence}%</div>
                    </div>
                  </div>
                  {/* vote bars */}
                  <div className="mt-3 space-y-1.5">
                    {([["BUY", council.quorum.buy, GR], ["SELL", council.quorum.sell, RD]] as const).map(([k, n, c]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-9 text-[10px]" style={{ color: c }}>{k}</span>
                        <div className="flex flex-1 gap-1">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-2.5 flex-1" style={{ background: i < n ? c : "rgba(255,255,255,0.06)", boxShadow: i < n ? `0 0 6px ${c}` : undefined, outline: i === council.quorum.threshold - 1 ? `1px dashed ${c}77` : "none" }} />
                          ))}
                        </div>
                        <span className="w-7 text-right text-[10px] text-slate-500">{n}/6</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400">
                    ${council.price.toFixed(2)} · RISK {(agents.find((a) => a.id === "risk")?.gate ?? "—").toUpperCase()}
                    {council.quorum.reliabilityApplied && <span style={{ color: MG }}> · 🧠 ACCURACY-WEIGHTED</span>}
                  </div>
                </div>
              ) : <div className="py-6 text-center text-[11px] text-slate-600" style={{ animation: "blink 1s steps(1) infinite" }}>CONVENING COUNCIL…</div>}
            </Panel>

            <Panel title="2 · Bot Factory · EA Pipeline" accent={MG}>
              <div className="flex items-center gap-1 overflow-x-auto">
                {FACTORY.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-1">
                    <a href={f.href} className="flex w-[74px] flex-col items-center gap-1 border p-2 transition-all hover:scale-105" style={{ borderColor: `${MG}33`, background: "rgba(10,16,40,0.6)" }}>
                      <span className="text-base">{f.icon}</span>
                      <span className="text-[8px] font-bold text-slate-300">{f.name}</span>
                      <span className="flex items-center gap-1 text-[7px] text-slate-500"><Led state="idle" /> READY</span>
                    </a>
                    {i < FACTORY.length - 1 && <span style={{ color: MG }}>▸</span>}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="3 · Review Room · Self-Learning" accent={GR}>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "TESTS", v: learning ? `${learning.evaluatedEntries}` : "—", c: CY },
                  { k: "PENDING", v: learning ? `${learning.pendingEntries}` : "—", c: AM },
                  { k: "QUALITY", v: avgAcc != null ? `${avgAcc}%` : "—", c: avgAcc != null && avgAcc >= 55 ? GR : AM },
                ].map((m) => (
                  <div key={m.k} className="border py-2" style={{ borderColor: "rgba(52,211,153,0.2)", background: "rgba(10,16,40,0.5)" }}>
                    <div className="text-[8px] uppercase tracking-widest text-slate-500">{m.k}</div>
                    <div className="text-lg font-black" style={{ color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* RIGHT: agent rooms */}
          <div className="space-y-3">
            <Panel title="Agent Rooms" accent={MG}>
              <div className="space-y-2">
                {agents.map((a) => {
                  const st = agentState(a, loading);
                  const rel = relById(a.id);
                  return (
                    <div key={a.id} className="flex items-center gap-2 border p-2" style={{ borderColor: `${LED[st.led]}30`, background: "rgba(10,16,40,0.5)" }}>
                      <PixelBot color={LED[st.led]} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-bold text-slate-200">{L(a.name)}</div>
                        <div className="flex items-center gap-1 text-[8px]">
                          <Led state={st.led} pulse={loading} />
                          <span style={{ color: LED[st.led] }}>[{st.label}]</span>
                        </div>
                        <div className="text-[8px] text-slate-500">c{a.confidence}%{a.reliability != null && a.reliability !== 1 ? ` ·×${a.reliability.toFixed(1)}` : ""}{rel && rel.samples > 0 ? ` ·${rel.hitRate}%` : ""}</div>
                      </div>
                    </div>
                  );
                })}
                {agents.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse border" style={{ borderColor: LINE, background: "rgba(255,255,255,0.03)" }} />
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {/* ── bottom status bar ── */}
        <div className="mt-3 grid grid-cols-2 gap-3 border px-4 py-2.5 sm:grid-cols-4" style={{ borderColor: `${CY}33`, background: "linear-gradient(90deg, rgba(56,189,248,0.06), rgba(6,10,26,0.7))" }}>
          <div>
            <div className="text-[8px] uppercase tracking-widest text-slate-500">System Status</div>
            <div className="flex items-center gap-1.5"><Led state={sys} pulse={loading} /><span className="text-[11px] font-bold uppercase" style={{ color: LED[sys] }}>{online ? "OPTIMAL" : loading ? "SYNC" : "OFFLINE"}</span></div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-widest text-slate-500">AI Agents</div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold" style={{ color: GR }}>{online ? totalAgents : 0}/{totalAgents}</span>
              <div className="flex gap-0.5">{Array.from({ length: totalAgents }).map((_, i) => <span key={i} className="h-2 w-1" style={{ background: online ? GR : "#334155", boxShadow: online ? `0 0 4px ${GR}` : undefined }} />)}</div>
            </div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-widest text-slate-500">Consensus</div>
            <div className="mt-1 h-2 w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full transition-[width] duration-700" style={{ width: `${council?.confidence ?? 0}%`, background: decColor, boxShadow: `0 0 8px ${decColor}` }} />
            </div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-widest text-slate-500">Data Flow</div>
            <div className="mt-1 h-4 overflow-hidden">
              <svg width="200%" height="16" viewBox="0 0 200 16" preserveAspectRatio="none" style={{ animation: "flow 3s linear infinite", width: "200%" }}>
                <path d="M0 8 Q5 2 10 8 T20 8 T30 8 T40 8 T50 8 T60 8 T70 8 T80 8 T90 8 T100 8 T110 8 T120 8 T130 8 T140 8 T150 8 T160 8 T170 8 T180 8 T190 8 T200 8" fill="none" stroke={online ? CY : "#334155"} strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-3 text-center text-[9px] text-slate-600">
          ⚠️ {lang === "th" ? "การวิเคราะห์สด ไม่ใช่คำแนะนำการลงทุน · โรงงาน EA ทำงานเมื่อสั่ง" : "Live analysis, not investment advice · EA Factory runs on demand"}
        </div>
      </div>
    </div>
  );
}
