"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/lib/i18n";
import type { Bilingual } from "@/lib/types";
import type { AgentOpinion, CouncilResult, CouncilVote } from "@/lib/council";
import type { LearningStats } from "@/lib/councilLearning";

type Council = CouncilResult;
type Learning = LearningStats;

type LedState = "work" | "idle" | "warn" | "danger";
const LED: Record<LedState, string> = { work: "#34d399", idle: "#8090b5", warn: "#f5c451", danger: "#f87171" };

const VOTE_COLOR: Record<CouncilVote, string> = {
  BUY: "#34d399", SELL: "#f87171", WAIT: "#f5c451", REDUCE_LOT: "#fb923c", CLOSE: "#f87171",
};
const VOTE_LABEL: Record<CouncilVote, Bilingual> = {
  BUY: { th: "ซื้อ", en: "BUY" }, SELL: { th: "ขาย", en: "SELL" }, WAIT: { th: "รอ", en: "WAIT" },
  REDUCE_LOT: { th: "ลดล็อต", en: "REDUCE" }, CLOSE: { th: "ปิด", en: "CLOSE" },
};

function agentStatus(a: AgentOpinion, loading: boolean): { led: LedState; th: string; en: string } {
  if (loading) return { led: "warn", th: "กำลังวิเคราะห์", en: "Analyzing" };
  if (a.id === "risk") {
    if (a.gate === "block") return { led: "danger", th: "ยับยั้งการเทรด", en: "Blocking" };
    if (a.gate === "caution") return { led: "warn", th: "เฝ้าระวัง", en: "Caution" };
    return { led: "work", th: "เฝ้าดูความเสี่ยง", en: "Monitoring" };
  }
  if (a.vote === "BUY") return { led: "work", th: "ให้สัญญาณซื้อ", en: "Signals buy" };
  if (a.vote === "SELL") return { led: "danger", th: "ให้สัญญาณขาย", en: "Signals sell" };
  if (a.vote === "REDUCE_LOT") return { led: "warn", th: "แนะลดขนาด", en: "Reduce size" };
  if (a.vote === "CLOSE") return { led: "danger", th: "สั่งปิดสถานะ", en: "Close all" };
  return { led: "idle", th: "รอจังหวะ", en: "Standby" };
}

const FACTORY: { id: string; icon: string; name: Bilingual; job: Bilingual; href: string }[] = [
  { id: "gen", icon: "🧠", name: { th: "Strategy Generator", en: "Strategy Generator" }, job: { th: "สร้างกลยุทธ์ EA", en: "Generate EA strategies" }, href: "/ai-ea" },
  { id: "bt", icon: "🧪", name: { th: "Backtest Engine", en: "Backtest Engine" }, job: { th: "ทดสอบย้อนหลัง", en: "Backtest on history" }, href: "/backtest" },
  { id: "opt", icon: "⚙️", name: { th: "Optimizer", en: "Optimizer" }, job: { th: "จูนพารามิเตอร์", en: "Tune parameters" }, href: "/ai-ea" },
  { id: "rob", icon: "🛡️", name: { th: "Robustness", en: "Robustness" }, job: { th: "กรอง Overfit", en: "Filter overfit" }, href: "/robustness" },
  { id: "port", icon: "🧩", name: { th: "Portfolio Manager", en: "Portfolio Manager" }, job: { th: "จัดสรรพอร์ต EA", en: "Allocate portfolio" }, href: "/ea-portfolio" },
];

function Led({ state, pulse }: { state: LedState; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: LED[state] }} />}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: LED[state], boxShadow: `0 0 8px ${LED[state]}` }} />
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="panel px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-widest text-silver/35">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-black" style={{ color: color ?? "rgba(200,208,230,0.95)" }}>{value}</div>
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
  const [lastSync, setLastSync] = useState("—");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        fetch("/api/council", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/council/learning", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (c && !c.error) { setCouncil(c as Council); setOnline(true); } else setOnline(false);
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
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const relById = (id: string) => learning?.agents.find((a) => a.id === id);
  const agents = council?.agents ?? [];
  const avgAcc = learning && learning.agents.some((a) => a.samples > 0)
    ? Math.round(learning.agents.filter((a) => a.samples > 0).reduce((s, a, _, arr) => s + a.hitRate / arr.length, 0))
    : null;
  const decColor = council ? VOTE_COLOR[council.decision] : "#f5c451";
  const working = loading ? "warn" : online ? "work" : "danger";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🛰️ AI Command Center"
        subtitle={lang === "th" ? "ดูสดว่า AI แต่ละตัวกำลังทำอะไร · สภาเทรด + โรงงาน EA" : "Live view of what every AI agent is doing · council + EA factory"}
        right={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
              style={{ background: `${LED[working as LedState]}14`, border: `1px solid ${LED[working as LedState]}38`, color: LED[working as LedState] }}>
              <Led state={working as LedState} pulse={loading} />
              {loading ? (lang === "th" ? "กำลังซิงก์" : "Syncing") : online ? (lang === "th" ? "ออนไลน์" : "Online") : (lang === "th" ? "ออฟไลน์" : "Offline")}
            </span>
            <button onClick={load} disabled={loading}
              className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}>
              {loading ? "⟳" : (lang === "th" ? "🔄 ซิงก์" : "🔄 Sync")}
            </button>
          </div>
        }
      />

      {/* Metrics */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={lang === "th" ? "AI ทำงาน" : "Agents"} value={`${6 + FACTORY.length}`} color="#34d399" />
        <Stat label={lang === "th" ? "มติสะสม" : "Decisions"} value={learning ? `${learning.totalEntries}` : "—"} color="#c084fc" />
        <Stat label={lang === "th" ? "ประเมินแล้ว" : "Scored"} value={learning ? `${learning.evaluatedEntries}` : "—"} color="#c084fc" />
        <Stat label={lang === "th" ? "แม่นเฉลี่ย" : "Avg Acc"} value={avgAcc != null ? `${avgAcc}%` : "—"} color={avgAcc != null && avgAcc >= 55 ? "#34d399" : "#f5c451"} />
        <Stat label={lang === "th" ? "มติปัจจุบัน" : "Consensus"} value={council ? L(VOTE_LABEL[council.decision]) : "—"} color={decColor} />
        <Stat label={lang === "th" ? "ราคา" : "Price"} value={council ? `$${council.price.toFixed(0)}` : "—"} color="#f5c451" />
      </div>

      {/* Consensus banner */}
      {council && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
          style={{ border: `1px solid ${decColor}35`, background: `${decColor}0c` }}>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-silver/40">{lang === "th" ? "มติสภา" : "Council verdict"}</span>
            <span className="text-2xl font-black" style={{ color: decColor }}>{L(VOTE_LABEL[council.decision])}</span>
            <span className="font-mono text-sm text-silver/60">{council.confidence}%</span>
            {council.quorum.reliabilityApplied && (
              <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>
                🧠 {lang === "th" ? "ถ่วงด้วยความแม่น" : "accuracy-weighted"}
              </span>
            )}
          </div>
          <div className="font-mono text-[11px] text-silver/40">BUY {council.quorum.buy}/6 · SELL {council.quorum.sell}/6</div>
        </div>
      )}

      {/* Trading Council agents */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-silver/35">{lang === "th" ? "สภาเทรด · 6 ตัว" : "Trading Council · 6 agents"}</div>
        <div className="text-[10px] text-silver/25">{lang === "th" ? "ซิงก์ล่าสุด" : "last sync"} {lastSync}</div>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const st = agentStatus(a, loading);
          const rel = relById(a.id);
          return (
            <div key={a.id} className="rounded-2xl p-4" style={{ border: `1px solid ${LED[st.led]}2e`, background: "rgba(13,18,30,0.7)", boxShadow: `0 0 26px ${LED[st.led]}0a` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Led state={st.led} pulse={loading} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-silver/90">{L(a.name)}</div>
                    <div className="truncate text-[10px] text-silver/40">{L(a.role)}</div>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-black"
                  style={{ background: `${LED[st.led]}16`, border: `1px solid ${LED[st.led]}3a`, color: LED[st.led] }}>
                  {lang === "th" ? st.th : st.en}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px]">
                <span className="font-mono text-silver/45">conf {a.confidence}%</span>
                <div className="flex items-center gap-2">
                  {a.reliability != null && a.reliability !== 1 && (
                    <span className="font-mono" style={{ color: a.reliability > 1 ? "#34d399" : "#f87171" }}>×{a.reliability.toFixed(2)}</span>
                  )}
                  {rel && rel.samples > 0 && <span className="font-mono text-silver/40">acc {rel.hitRate}%</span>}
                </div>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${a.confidence}%`, background: LED[st.led] }} />
              </div>
            </div>
          );
        })}
        {agents.length === 0 && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl" style={{ background: "rgba(255,255,255,0.03)" }} />
        ))}
      </div>

      {/* EA Factory pipeline */}
      <div className="mb-2 text-[10px] uppercase tracking-widest text-silver/35">{lang === "th" ? "โรงงาน EA · ทำงานตามคำสั่ง" : "EA Factory · on demand"}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {FACTORY.map((f) => (
          <a key={f.id} href={f.href}
            className="group rounded-2xl p-4 transition-all hover:scale-[1.02]"
            style={{ border: "1px solid rgba(168,85,247,0.22)", background: "rgba(13,18,30,0.7)" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xl">{f.icon}</span>
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-silver/40"><Led state="idle" /> {lang === "th" ? "พร้อม" : "Ready"}</span>
            </div>
            <div className="text-xs font-bold text-silver/85 group-hover:text-white">{L(f.name)}</div>
            <div className="mt-0.5 text-[10px] text-silver/40">{L(f.job)}</div>
          </a>
        ))}
      </div>

      <div className="mt-6 rounded-xl px-4 py-3 text-[10px]" style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.12)", color: "rgba(175,185,215,0.4)" }}>
        ⚠️ {lang === "th"
          ? "สถานะ agent เป็นการวิเคราะห์สด ไม่ใช่คำแนะนำการลงทุน · โรงงาน EA ทำงานเมื่อสั่ง (คลิกการ์ดเพื่อเปิด)"
          : "Live analysis, not investment advice · EA Factory runs on demand (click a card to open)"}
      </div>
    </div>
  );
}
