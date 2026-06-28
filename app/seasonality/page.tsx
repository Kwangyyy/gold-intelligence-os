"use client";

import { useEffect, useState } from "react";
import type { SeasonalityResult, MonthStat, DayStat, YearStat } from "@/lib/seasonality";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { useI18n } from "@/lib/i18n";

// ── Colour helpers ────────────────────────────────────────────────────────────

function retColor(r: number): { bg: string; border: string; text: string } {
  if (r >= 3)  return { bg: "rgba(16,185,129,0.28)", border: "rgba(52,211,153,0.5)", text: "#34d399" };
  if (r >= 1)  return { bg: "rgba(16,185,129,0.16)", border: "rgba(52,211,153,0.3)", text: "#6ee7b7" };
  if (r > 0)   return { bg: "rgba(16,185,129,0.08)", border: "rgba(52,211,153,0.15)", text: "#a7f3d0" };
  if (r === 0) return { bg: "rgba(71,85,105,0.15)",  border: "rgba(71,85,105,0.25)",  text: "#64748b" };
  if (r > -1)  return { bg: "rgba(239,68,68,0.08)",  border: "rgba(248,113,113,0.15)", text: "#fca5a5" };
  if (r > -3)  return { bg: "rgba(239,68,68,0.16)",  border: "rgba(248,113,113,0.3)",  text: "#f87171" };
  return             { bg: "rgba(239,68,68,0.28)",   border: "rgba(248,113,113,0.5)",  text: "#ef4444" };
}

function sign(v: number) { return v >= 0 ? "+" : ""; }

// ── Monthly heatmap ───────────────────────────────────────────────────────────

function MonthCard({ m, isCurrent }: { m: MonthStat; isCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  const { bg, border, text } = retColor(m.avgReturn);
  return (
    <div
      className="cursor-pointer rounded-xl p-3 transition-all hover:scale-[1.02]"
      style={{ background: bg, border: `1px solid ${border}`, outline: isCurrent ? `2px solid rgba(245,196,81,0.6)` : undefined }}
      onClick={() => setOpen(v => !v)}
    >
      {isCurrent && (
        <div className="mb-1 text-center text-[9px] font-bold tracking-widest" style={{ color: "#f5c451" }}>
          ▲ เดือนนี้
        </div>
      )}
      <div className="text-center">
        <div className="text-xs font-bold text-silver/50 mb-0.5">{m.nameEn}</div>
        <div className="text-sm font-black" style={{ color: text }}>
          {sign(m.avgReturn)}{m.avgReturn.toFixed(2)}%
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: text, opacity: 0.7 }}>
          {m.winRate}% win
        </div>
      </div>

      {/* Bar chart mini */}
      <div className="mt-2 flex items-end gap-[2px] h-8 justify-center">
        {m.returns.slice(-10).map((d, i) => {
          const max = 8;
          const h   = Math.min(Math.abs(d.ret) / max, 1) * 28 + 2;
          const c   = d.ret >= 0 ? "#34d399" : "#f87171";
          return (
            <div key={i} title={`${d.year}: ${sign(d.ret)}${d.ret}%`}
              className="rounded-sm transition-all"
              style={{ width: 5, height: h, background: c, opacity: 0.7 }} />
          );
        })}
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="mt-3 border-t pt-2" style={{ borderColor: border }}>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-silver/40">Median</span>
            <span style={{ color: text }}>{sign(m.medReturn)}{m.medReturn}%</span>
            <span className="text-silver/40">Best</span>
            <span className="text-emerald-400">{m.best.year}: +{m.best.ret}%</span>
            <span className="text-silver/40">Worst</span>
            <span className="text-red-400">{m.worst.year}: {m.worst.ret}%</span>
            <span className="text-silver/40">N</span>
            <span className="text-silver/60">{m.count} ปี</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Year bar chart ────────────────────────────────────────────────────────────

function YearChart({ years }: { years: YearStat[] }) {
  const maxAbs = Math.max(...years.map(y => Math.abs(y.ret)), 1);
  return (
    <div className="space-y-1.5">
      {years.map(y => {
        const { bg, border, text } = retColor(y.ret);
        const pct = (Math.abs(y.ret) / maxAbs) * 100;
        const pos = y.ret >= 0;
        return (
          <div key={y.year} className="flex items-center gap-2">
            <span className="w-10 text-right text-[11px] font-mono text-silver/40">{y.year}</span>
            <div className="flex flex-1 items-center">
              {pos ? (
                <>
                  <div className="w-1/2 flex justify-end pr-1">
                    <div style={{ width: `${pct / 2}%`, minWidth: 2, background: text, height: 16, borderRadius: 3, opacity: 0.8 }} />
                  </div>
                  <div className="w-1/2" />
                </>
              ) : (
                <>
                  <div className="w-1/2" />
                  <div className="w-1/2 pl-1">
                    <div style={{ width: `${pct / 2}%`, minWidth: 2, background: text, height: 16, borderRadius: 3, opacity: 0.8 }} />
                  </div>
                </>
              )}
            </div>
            <span className="w-16 text-[11px] font-bold" style={{ color: text }}>
              {sign(y.ret)}{y.ret.toFixed(1)}%
            </span>
            <span className="w-20 text-right text-[10px] text-silver/30 font-mono">${y.endPrice.toFixed(0)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Day of week bars ──────────────────────────────────────────────────────────

function DayChart({ days }: { days: DayStat[] }) {
  const maxAbs = Math.max(...days.map(d => Math.abs(d.avgReturn)), 0.01);
  return (
    <div className="flex items-end justify-around h-32 gap-2">
      {days.map(d => {
        const { bg, border, text } = retColor(d.avgReturn * 50);
        const pct = (Math.abs(d.avgReturn) / maxAbs) * 100;
        const pos = d.avgReturn >= 0;
        return (
          <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-[10px] font-mono font-bold" style={{ color: text }}>
              {sign(d.avgReturn)}{(d.avgReturn * 100).toFixed(1)}bp
            </span>
            <div className="w-full flex justify-center">
              <div
                className="rounded-t-md w-8"
                style={{
                  height: `${Math.max(pct * 0.7, 4)}px`,
                  background: text,
                  opacity: 0.75,
                  border: `1px solid ${border}`,
                  borderBottom: pos ? "none" : undefined,
                  borderTop: pos ? undefined : "none",
                  alignSelf: pos ? "flex-end" : "flex-start",
                }}
              />
            </div>
            <span className="text-[11px] font-bold text-silver/60">{d.nameEn}</span>
            <span className="text-[9px] text-silver/30">{d.nameTh}</span>
            <span className="text-[9px] text-silver/25">{d.winRate}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Best / worst months summary ───────────────────────────────────────────────

function TopMonths({ months }: { months: MonthStat[] }) {
  const sorted = [...months].sort((a, b) => b.avgReturn - a.avgReturn);
  const best3  = sorted.slice(0, 3);
  const worst3 = sorted.slice(-3).reverse();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[10px] font-bold text-emerald-400 mb-2 uppercase tracking-widest">เดือนที่ดีที่สุด</div>
        {best3.map((m, i) => (
          <div key={m.month} className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-black text-emerald-400/50">#{i + 1}</span>
            <span className="text-xs font-bold text-silver/70 w-8">{m.nameEn}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-base-border/30">
              <div className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.min(m.avgReturn / 5 * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-emerald-400 w-14 text-right">
              +{m.avgReturn.toFixed(2)}%
            </span>
            <span className="text-[10px] text-silver/30">{m.winRate}%</span>
          </div>
        ))}
      </div>
      <div>
        <div className="text-[10px] font-bold text-red-400 mb-2 uppercase tracking-widest">เดือนที่แย่ที่สุด</div>
        {worst3.map((m, i) => (
          <div key={m.month} className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-black text-red-400/50">#{i + 1}</span>
            <span className="text-xs font-bold text-silver/70 w-8">{m.nameEn}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-base-border/30">
              <div className="h-full rounded-full bg-red-400"
                style={{ width: `${Math.min(Math.abs(m.avgReturn) / 5 * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-red-400 w-14 text-right">
              {m.avgReturn.toFixed(2)}%
            </span>
            <span className="text-[10px] text-silver/30">{m.winRate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SeasonalityPage() {
  const { lang } = useI18n();
  const [data, setData]       = useState<SeasonalityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const l = lang as "th" | "en";

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/seasonality", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "failed");
        setData(json as SeasonalityResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Summary stats
  const positiveMonths = data ? data.months.filter(m => m.avgReturn > 0).length : 0;
  const bullYears      = data ? data.years.filter(y => y.ret > 0).length : 0;
  const currentMonthStat = data?.months.find(m => m.month === data.currentMonth);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Gold Seasonality"
        subtitle={l === "th"
          ? "วิเคราะห์ pattern รายเดือน รายวัน และรายปีจากข้อมูลย้อนหลัง 12 ปี"
          : "Monthly, weekday & annual gold price patterns — 12 years of data"}
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-400">
          ⚠ {error}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-4 animate-pulse">
          <div className="panel h-24 bg-base-panel/60" />
          <div className="panel h-80 bg-base-panel/40" />
        </div>
      )}

      {data && (
        <div className="space-y-6">

          {/* ── Banner stats ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 sm:p-5"
            style={{
              background: "linear-gradient(135deg, rgba(12,8,26,0.95) 0%, rgba(7,9,22,0.95) 100%)",
              border: "1px solid rgba(168,85,247,0.22)",
            }}
          >
            <div className="flex flex-wrap gap-6">
              {/* Gold price */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-silver/40 mb-1">XAUUSD</div>
                <div className="text-3xl font-black font-mono" style={{ color: "#f5c451" }}>
                  ${data.price.toFixed(2)}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-6">
                {[
                  { label: "เดือน Bullish", value: `${positiveMonths}/12`, sub: "avg positive" },
                  { label: "ปี Bullish",    value: `${bullYears}/${data.years.length}`, sub: "years positive" },
                  { label: "ข้อมูล",        value: `${data.years.length + 1} ปี`, sub: `${data.dataFrom} – ${data.dataTo}` },
                  { label: "แท่งเทียน",    value: data.totalBars.toLocaleString(), sub: "trading days" },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-[10px] uppercase tracking-widest text-silver/40 mb-1">{s.label}</div>
                    <div className="text-xl font-black text-silver">{s.value}</div>
                    <div className="text-[10px] text-silver/30">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Current month highlight */}
              {currentMonthStat && (
                <div
                  className="ml-auto rounded-xl px-4 py-2 flex flex-col items-center justify-center"
                  style={{ ...(() => { const c = retColor(currentMonthStat.avgReturn); return { background: c.bg, border: `1px solid ${c.border}` }; })() }}
                >
                  <div className="text-[10px] text-silver/40 uppercase tracking-widest">เดือนนี้ ({currentMonthStat.nameEn})</div>
                  <div className="text-2xl font-black" style={{ color: retColor(currentMonthStat.avgReturn).text }}>
                    {sign(currentMonthStat.avgReturn)}{currentMonthStat.avgReturn.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-silver/40">avg · {currentMonthStat.winRate}% winrate</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Monthly heatmap ──────────────────────────────────────────── */}
          <div className="panel p-5">
            <h2 className="text-sm font-bold text-silver/70 mb-1">Monthly Seasonality</h2>
            <p className="text-xs text-silver/35 mb-4">
              ค่าเฉลี่ย % return รายเดือน · คลิกเดือนเพื่อดูรายละเอียด
            </p>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
              {data.months.map(m => (
                <MonthCard key={m.month} m={m} isCurrent={m.month === data.currentMonth} />
              ))}
            </div>
          </div>

          {/* ── Best / Worst months ───────────────────────────────────────── */}
          <div className="panel p-5">
            <h2 className="text-sm font-bold text-silver/70 mb-4">เดือนที่แข็งแกร่ง vs อ่อนแอ</h2>
            <TopMonths months={data.months} />
          </div>

          {/* ── Annual returns + Day of week side by side ─────────────────── */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Annual — wider */}
            <div className="panel p-5 md:col-span-2">
              <h2 className="text-sm font-bold text-silver/70 mb-1">Annual Returns</h2>
              <p className="text-xs text-silver/35 mb-4">% return ต่อปีของ XAUUSD (ปิด vs เปิดปี)</p>
              <YearChart years={data.years} />
            </div>

            {/* Day of week */}
            <div className="panel p-5">
              <h2 className="text-sm font-bold text-silver/70 mb-1">Day-of-Week Pattern</h2>
              <p className="text-xs text-silver/35 mb-4">
                avg daily % change รายวัน (basis points = ×100)
              </p>
              <DayChart days={data.days} />
              <div className="mt-4 space-y-1">
                {data.days.map(d => (
                  <div key={d.day} className="flex items-center justify-between text-[11px]">
                    <span className="text-silver/50 w-8">{d.nameEn}</span>
                    <span className="font-mono" style={{ color: retColor(d.avgReturn * 50).text }}>
                      {sign(d.avgReturn)}{(d.avgReturn * 100).toFixed(2)} bp
                    </span>
                    <span className="text-silver/30">{d.winRate}% win</span>
                    <span className="text-silver/20 text-[9px]">{d.count.toLocaleString()}d</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Full year table ───────────────────────────────────────────── */}
          <div className="panel p-5">
            <h2 className="text-sm font-bold text-silver/70 mb-4">Monthly Detail Matrix</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-base-border/30">
                    <th className="pb-2 text-left text-[10px] text-silver/40 w-16">เดือน</th>
                    <th className="pb-2 text-right text-[10px] text-silver/40">ค่าเฉลี่ย</th>
                    <th className="pb-2 text-right text-[10px] text-silver/40">Median</th>
                    <th className="pb-2 text-right text-[10px] text-silver/40">Win %</th>
                    <th className="pb-2 text-right text-[10px] text-silver/40">ดีสุด</th>
                    <th className="pb-2 text-right text-[10px] text-silver/40">แย่สุด</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map(m => {
                    const { text } = retColor(m.avgReturn);
                    const cur = m.month === data.currentMonth;
                    return (
                      <tr key={m.month}
                        className="border-b border-base-border/15 hover:bg-white/[0.015] transition-colors"
                        style={cur ? { background: "rgba(245,196,81,0.04)" } : undefined}>
                        <td className="py-1.5 font-bold text-silver/70">
                          {m.nameEn} {m.nameTh}
                          {cur && <span className="ml-1 text-gold text-[9px]">◀</span>}
                        </td>
                        <td className="py-1.5 text-right font-bold" style={{ color: text }}>
                          {sign(m.avgReturn)}{m.avgReturn.toFixed(2)}%
                        </td>
                        <td className="py-1.5 text-right text-silver/50">
                          {sign(m.medReturn)}{m.medReturn.toFixed(2)}%
                        </td>
                        <td className="py-1.5 text-right" style={{ color: text }}>
                          {m.winRate}%
                        </td>
                        <td className="py-1.5 text-right text-emerald-400">
                          +{m.best.ret}%
                          <span className="text-silver/30 ml-1">({m.best.year})</span>
                        </td>
                        <td className="py-1.5 text-right text-red-400">
                          {m.worst.ret}%
                          <span className="text-silver/30 ml-1">({m.worst.year})</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Disclaimer />
        </div>
      )}
    </div>
  );
}
