"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/lib/i18n";
import type { Bilingual } from "@/lib/types";
import type { AgentOpinion, CouncilResult, CouncilVote, CouncilDecision, RiskGate } from "@/lib/council";
import type { OrderPlan } from "@/lib/execution";
import { appendPaperTrade, closeAllOpenPaper } from "@/lib/paperStore";

type CouncilResponse = CouncilResult & { plan: OrderPlan };

const VOTE_COLOR: Record<CouncilVote, string> = {
  BUY: "#34d399",
  SELL: "#f87171",
  WAIT: "#f5c451",
  REDUCE_LOT: "#fb923c",
  CLOSE: "#ef4444",
};

const VOTE_LABEL: Record<CouncilVote, Bilingual> = {
  BUY: { th: "ซื้อ", en: "BUY" },
  SELL: { th: "ขาย", en: "SELL" },
  WAIT: { th: "รอ", en: "WAIT" },
  REDUCE_LOT: { th: "ลดล็อต", en: "REDUCE LOT" },
  CLOSE: { th: "ปิดสถานะ", en: "CLOSE" },
};

const VOTE_ICON: Record<CouncilVote, string> = {
  BUY: "▲",
  SELL: "▼",
  WAIT: "■",
  REDUCE_LOT: "↓",
  CLOSE: "✕",
};

const GATE_STYLE: Record<RiskGate, { color: string; th: string; en: string }> = {
  pass: { color: "#34d399", th: "ผ่าน", en: "PASS" },
  caution: { color: "#fb923c", th: "ระวัง", en: "CAUTION" },
  block: { color: "#ef4444", th: "ยับยั้ง", en: "BLOCK" },
};

// Quorum progress toward the BUY/SELL threshold.
function QuorumMeter({ label, count, threshold, color }: { label: string; count: number; threshold: number; color: string }) {
  const cells = Array.from({ length: 6 });
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-bold" style={{ color }}>{label}</span>
        <span className="font-mono" style={{ color: count >= threshold ? color : "rgba(175,185,215,0.5)" }}>
          {count}/6 {count >= threshold ? "✓" : `· need ${threshold}`}
        </span>
      </div>
      <div className="flex gap-1">
        {cells.map((_, i) => (
          <div
            key={i}
            className="h-2 flex-1 rounded-full"
            style={{
              background: i < count ? color : "rgba(255,255,255,0.06)",
              outline: i === threshold - 1 ? `1px dashed ${color}80` : "none",
              outlineOffset: "1px",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent, L, lang }: { agent: AgentOpinion; L: (b: Bilingual) => string; lang: "th" | "en" }) {
  const color = VOTE_COLOR[agent.vote];
  return (
    <div
      className="rounded-2xl p-4"
      style={{ border: `1px solid ${color}25`, background: "rgba(6,9,26,0.6)", boxShadow: `0 0 30px ${color}08` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-silver/90 truncate">{L(agent.name)}</div>
          <div className="text-[10px] text-silver/40 truncate">{L(agent.role)}</div>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black"
          style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
        >
          <span>{VOTE_ICON[agent.vote]}</span>
          <span>{lang === "th" ? L(VOTE_LABEL[agent.vote]) : agent.vote}</span>
        </div>
      </div>

      {/* gate badge (risk manager) */}
      {agent.gate && (
        <div className="mt-2">
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: `${GATE_STYLE[agent.gate].color}18`, border: `1px solid ${GATE_STYLE[agent.gate].color}45`, color: GATE_STYLE[agent.gate].color }}
          >
            {lang === "th" ? `เกต: ${GATE_STYLE[agent.gate].th}` : `GATE: ${GATE_STYLE[agent.gate].en}`}
          </span>
        </div>
      )}

      {/* confidence */}
      <div className="mt-3">
        <div className="flex justify-between text-[9px] uppercase tracking-widest text-silver/35">
          <span>Confidence</span>
          <span style={{ color }}>{agent.confidence}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${agent.confidence}%`, background: color }} />
        </div>
      </div>

      {/* reasons */}
      <ul className="mt-3 space-y-1">
        {agent.reasons.map((r, i) => (
          <li key={i} className="flex gap-1.5 text-[11px] text-silver/60">
            <span style={{ color }} className="mt-0.5 shrink-0">•</span>
            <span>{L(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CouncilPage() {
  const { lang } = useI18n();
  const L = useCallback((b: Bilingual) => b[lang], [lang]);

  const [data, setData] = useState<CouncilResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [execMsg, setExecMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setExecMsg(null);
    try {
      const res = await fetch("/api/council", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json as CouncilResponse);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Execution gate → Paper Trader (simulated; never places real orders).
  const execute = useCallback(() => {
    if (!data) return;
    const plan = data.plan;
    const note = `AI Council ${data.decision} ${data.confidence}% · BUY ${data.quorum.buy}/SELL ${data.quorum.sell}`;
    try {
      if ((plan.action === "OPEN" || plan.action === "REDUCE") && plan.direction && plan.entry) {
        appendPaperTrade({
          type: plan.direction,
          lots: plan.lots,
          entryPrice: plan.entry,
          sl: plan.sl,
          tp: plan.takeProfits[1] ?? plan.takeProfits[0] ?? null, // TP2 (RR 2)
          note,
        });
        setExecMsg({
          ok: true,
          text: lang === "th"
            ? `ส่งออเดอร์ ${plan.direction === "buy" ? "ซื้อ" : "ขาย"} ${plan.lots} ล็อต เข้า Paper Trader แล้ว`
            : `Sent ${plan.direction.toUpperCase()} ${plan.lots} lots to Paper Trader`,
        });
      } else if (plan.action === "CLOSE_ALL") {
        const { closed } = closeAllOpenPaper(data.price);
        setExecMsg({
          ok: true,
          text: lang === "th" ? `ปิดสถานะที่เปิดอยู่ ${closed} รายการใน Paper Trader` : `Closed ${closed} open position(s) in Paper Trader`,
        });
      }
    } catch (e) {
      setExecMsg({ ok: false, text: String(e) });
    }
  }, [data, lang]);

  useEffect(() => {
    load();
  }, [load]);

  const decColor = data ? VOTE_COLOR[data.decision as CouncilDecision] : "#f5c451";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🏛 AI Agent Council"
        subtitle={
          lang === "th"
            ? "ทีม AI 6 ตัวประชุมกันก่อนออกไม้ · กติกา: BUY/SELL ≥ 4 จาก 6 และ Risk Manager ต้องผ่าน"
            : "6 AI analysts confer before any order · rule: BUY/SELL ≥ 4 of 6 AND Risk Manager passes"
        }
        right={
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-40"
            style={{ background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}
          >
            {loading ? (lang === "th" ? "⏳ กำลังประชุม…" : "⏳ Convening…") : lang === "th" ? "🔄 เรียกประชุมใหม่" : "🔄 Re-convene"}
          </button>
        }
      />

      {err && (
        <div className="panel mb-5 px-5 py-4 text-sm" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>
          {err}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-4">
          <div className="panel h-44 animate-pulse rounded-2xl" style={{ opacity: 0.4 }} />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="panel h-40 animate-pulse rounded-2xl" style={{ opacity: 0.35 }} />
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Consensus hero */}
          <div
            className="mb-5 rounded-2xl p-5"
            style={{ border: `1px solid ${decColor}35`, background: `${decColor}08`, boxShadow: `0 0 50px ${decColor}0f` }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-black"
                  style={{ background: `${decColor}18`, border: `2px solid ${decColor}55`, color: decColor }}
                >
                  {VOTE_ICON[data.decision as CouncilVote]}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-silver/40">
                    {lang === "th" ? "มติสภา" : "Council Decision"} · {data.symbol}
                  </div>
                  <div className="text-3xl font-black" style={{ color: decColor }}>
                    {L(VOTE_LABEL[data.decision as CouncilVote])}
                  </div>
                  {data.overridden && (
                    <div className="mt-0.5 text-[10px] font-semibold" style={{ color: "#fb923c" }}>
                      {lang === "th" ? "⚠ ปรับโดยผู้จัดการความเสี่ยง/ข่าว" : "⚠ Adjusted by Risk/News gate"}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-silver/40">Confidence</div>
                <div className="font-mono text-3xl font-black" style={{ color: decColor }}>
                  {data.confidence}%
                </div>
                <div className="text-[11px] text-silver/40">${data.price.toFixed(2)}</div>
              </div>
            </div>

            {/* Quorum meters */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <QuorumMeter label={lang === "th" ? "โหวตซื้อ" : "BUY votes"} count={data.quorum.buy} threshold={data.quorum.threshold} color={VOTE_COLOR.BUY} />
              <QuorumMeter label={lang === "th" ? "โหวตขาย" : "SELL votes"} count={data.quorum.sell} threshold={data.quorum.threshold} color={VOTE_COLOR.SELL} />
            </div>

            {/* Risk gate status */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-silver/40">{lang === "th" ? "ประตูความเสี่ยง:" : "Risk gate:"}</span>
              {(() => {
                const gate = data.agents.find((a) => a.id === "risk")?.gate ?? "pass";
                const g = GATE_STYLE[gate];
                return (
                  <span className="rounded-md px-2 py-0.5 font-bold" style={{ background: `${g.color}18`, border: `1px solid ${g.color}45`, color: g.color }}>
                    {lang === "th" ? g.th : g.en}
                  </span>
                );
              })()}
              <span className="text-silver/30">·</span>
              <span className="text-silver/40">
                {lang === "th" ? `รอ ${data.counts.WAIT} · ลดล็อต ${data.counts.REDUCE_LOT} · ปิด ${data.counts.CLOSE}` : `WAIT ${data.counts.WAIT} · REDUCE ${data.counts.REDUCE_LOT} · CLOSE ${data.counts.CLOSE}`}
              </span>
            </div>

            <div className="mt-3 text-xs text-silver/60">{L(data.summary)}</div>

            {data.riskFlags.length > 0 && (
              <div className="mt-3 space-y-1 rounded-xl px-3 py-2" style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.2)" }}>
                {data.riskFlags.map((f, i) => (
                  <div key={i} className="text-[11px]" style={{ color: "#fdba74" }}>{L(f)}</div>
                ))}
              </div>
            )}
          </div>

          {/* Execution gate */}
          {(() => {
            const plan = data.plan;
            const actColor =
              plan.action === "OPEN" ? (plan.direction === "buy" ? "#34d399" : "#f87171")
              : plan.action === "REDUCE" ? "#fb923c"
              : plan.action === "CLOSE_ALL" ? "#ef4444"
              : "#64748b";
            const canAct = plan.action !== "NONE";
            const btnLabel =
              plan.action === "CLOSE_ALL"
                ? (lang === "th" ? "⛔ ปิดสถานะทั้งหมด (Paper)" : "⛔ Close all (Paper)")
                : (lang === "th" ? "▶ ส่งเข้า Paper Trader" : "▶ Send to Paper Trader");
            return (
              <div className="mb-5 rounded-2xl p-5" style={{ border: `1px solid ${actColor}30`, background: "rgba(6,9,26,0.5)" }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-widest text-silver/40">
                    {lang === "th" ? "🎯 ประตูออกออเดอร์ (Execution)" : "🎯 Execution gate"}
                  </div>
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${actColor}18`, border: `1px solid ${actColor}45`, color: actColor }}>
                    {plan.action}
                  </span>
                </div>

                <div className="text-sm font-bold" style={{ color: actColor }}>{L(plan.headline)}</div>

                {plan.action !== "NONE" && plan.action !== "CLOSE_ALL" && (
                  <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-4" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {[
                      { k: "Lots", v: `${plan.lots}`, c: actColor },
                      { k: "Entry", v: plan.entry ? `$${plan.entry.toFixed(2)}` : "—", c: "rgba(175,185,215,0.9)" },
                      { k: "SL", v: plan.sl ? `$${plan.sl.toFixed(2)}` : "—", c: "#f87171" },
                      { k: `Risk (${plan.riskPct}%)`, v: `$${plan.riskAmount}`, c: "#fb923c" },
                    ].map((cell) => (
                      <div key={cell.k} className="px-3 py-2" style={{ background: "rgba(6,9,26,0.6)" }}>
                        <div className="text-[9px] uppercase tracking-widest text-silver/35">{cell.k}</div>
                        <div className="font-mono text-sm font-bold" style={{ color: cell.c }}>{cell.v}</div>
                      </div>
                    ))}
                  </div>
                )}

                <ul className="mt-3 space-y-1">
                  {plan.notes.map((n, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] text-silver/55">
                      <span style={{ color: actColor }} className="mt-0.5 shrink-0">•</span>
                      <span>{L(n)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={execute}
                    disabled={!canAct}
                    className="rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-30"
                    style={{ background: `${actColor}18`, border: `1px solid ${actColor}45`, color: actColor }}
                  >
                    {canAct ? btnLabel : (lang === "th" ? "— ไม่มีออเดอร์ —" : "— No order —")}
                  </button>
                  <a href="/paper" className="text-[11px] underline text-silver/40 hover:text-silver/70">
                    {lang === "th" ? "เปิด Paper Trader →" : "Open Paper Trader →"}
                  </a>
                  {execMsg && (
                    <span className="text-[11px] font-semibold" style={{ color: execMsg.ok ? "#34d399" : "#f87171" }}>
                      {execMsg.ok ? "✓ " : "✕ "}{execMsg.text}
                    </span>
                  )}
                </div>

                <div className="mt-2 text-[10px] text-silver/30">
                  {lang === "th" ? "หมายเหตุ: เป็นการเทรดจำลอง (Paper) เท่านั้น ไม่ส่งออเดอร์จริงเข้า MT5" : "Note: paper (simulated) only — no real MT5 orders are placed."}
                </div>
              </div>
            );
          })()}

          {/* Agents */}
          <div className="mb-2 text-[10px] uppercase tracking-widest text-silver/35">
            {lang === "th" ? `สมาชิกสภา (${data.agents.length})` : `Council members (${data.agents.length})`}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.agents.map((a) => (
              <AgentCard key={a.id} agent={a} L={L} lang={lang} />
            ))}
          </div>

          {/* Disclaimer */}
          <div
            className="mt-6 rounded-xl px-4 py-3 text-[10px]"
            style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.12)", color: "rgba(175,185,215,0.4)" }}
          >
            ⚠️ {L(data.disclaimer)}
          </div>
        </>
      )}
    </div>
  );
}
