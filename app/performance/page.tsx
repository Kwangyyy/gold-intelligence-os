"use client";

import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { loadTrades, computeStats, type TradeEntry, type JournalStats } from "@/lib/journal";

const fmt  = (n: number, d = 2) => (n >= 0 ? "+" : "") + n.toFixed(d);
const fmtN = (n: number, d = 2) => n.toFixed(d);
const usd  = (n: number) => (n >= 0 ? "+" : "") + "$" + Math.abs(n).toFixed(2);

// ── Mini SVG equity curve ─────────────────────────────────────────────────────
function EquityCurve({ curve }: { curve: number[] }) {
  if (curve.length < 2) return (
    <div className="flex h-40 items-center justify-center text-sm text-silver/25">ต้องการอย่างน้อย 2 trades</div>
  );
  const W = 560; const H = 120;
  const min = Math.min(0, ...curve), max = Math.max(0, ...curve);
  const range = max - min || 1;
  const xs = curve.map((_, i) => (i / (curve.length - 1)) * W);
  const ys = curve.map(v => H - ((v - min) / range) * H);
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const zeroY = H - ((0 - min) / range) * H;
  const fill = `M${xs[0]},${zeroY} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(" ") + ` L${xs.at(-1)},${zeroY} Z`;
  const isPos = (curve.at(-1) ?? 0) >= 0;
  const lineColor = isPos ? "#34d399" : "#f87171";
  const fillColor = isPos ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
      {/* Zero line */}
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Fill */}
      <path d={fill} fill={fillColor} />
      {/* Line */}
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Latest dot */}
      <circle cx={xs.at(-1)} cy={ys.at(-1)} r="3" fill={lineColor} />
    </svg>
  );
}

// ── Drawdown curve ────────────────────────────────────────────────────────────
function DrawdownCurve({ curve }: { curve: number[] }) {
  if (curve.length < 2) return null;
  const W = 560; const H = 80;
  // compute running drawdown
  let peak = curve[0];
  const dd = curve.map(v => { if (v > peak) peak = v; return peak > 0 ? ((v - peak) / peak) * 100 : 0; });
  const min = Math.min(...dd), max = 0;
  const range = max - min || 1;
  const xs = dd.map((_, i) => (i / (dd.length - 1)) * W);
  const ys = dd.map(v => H - ((v - min) / range) * H);
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const fill = `M${xs[0]},${H} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(" ") + ` L${xs.at(-1)},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }}>
      <path d={fill} fill="rgba(248,113,113,0.12)" />
      <polyline points={pts} fill="none" stroke="#f87171" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Monthly P&L bar chart ─────────────────────────────────────────────────────
function MonthlyBars({ trades }: { trades: TradeEntry[] }) {
  const monthly = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of trades) {
      if (t.result === "running" || t.pnlUSD === null) continue;
      const key = t.closeTime ? t.closeTime.slice(0, 7) : t.openTime.slice(0, 7);
      map[key] = (map[key] ?? 0) + t.pnlUSD;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  }, [trades]);

  if (monthly.length === 0) return <div className="text-sm text-silver/25 py-6 text-center">ยังไม่มีข้อมูล</div>;

  const maxAbs = Math.max(...monthly.map(([, v]) => Math.abs(v)), 1);
  const W = 560; const H = 100; const BAR_W = Math.max(12, (W / monthly.length) * 0.6);
  const gap = W / monthly.length;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ height: 130 }}>
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      {monthly.map(([mo, pnl], i) => {
        const cx  = gap * i + gap / 2;
        const pct = Math.abs(pnl) / maxAbs;
        const barH = pct * (H / 2);
        const y   = pnl >= 0 ? H / 2 - barH : H / 2;
        const col = pnl >= 0 ? "#34d399" : "#f87171";
        return (
          <g key={mo}>
            <rect x={cx - BAR_W / 2} y={y} width={BAR_W} height={barH} fill={col} fillOpacity="0.7" rx="2" />
            <text x={cx} y={H + 14} textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.5)">
              {mo.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Setup performance table ───────────────────────────────────────────────────
function SetupTable({ trades }: { trades: TradeEntry[] }) {
  const rows = useMemo(() => {
    const map: Record<string, { wins: number; total: number; pnl: number }> = {};
    for (const t of trades) {
      if (t.result === "running") continue;
      if (!map[t.setup]) map[t.setup] = { wins: 0, total: 0, pnl: 0 };
      map[t.setup].total++;
      if (t.result === "win") map[t.setup].wins++;
      map[t.setup].pnl += t.pnlUSD ?? 0;
    }
    return Object.entries(map)
      .map(([setup, d]) => ({ setup, ...d, wr: d.total ? d.wins / d.total * 100 : 0 }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  if (rows.length === 0) return <div className="py-6 text-center text-sm text-silver/25">ยังไม่มีข้อมูล</div>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-base-border/20 text-[10px] uppercase tracking-widest text-silver/30">
          {["Setup","Trades","Win Rate","Total P/L"].map(h => (
            <th key={h} className="px-3 pb-2 pt-3 text-left">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.setup} className="border-b border-base-border/10 hover:bg-white/[0.015]">
            <td className="px-3 py-2.5 font-bold text-silver/70 capitalize">{r.setup}</td>
            <td className="px-3 py-2.5 font-mono text-silver/50">{r.total}</td>
            <td className="px-3 py-2.5 font-mono font-bold"
              style={{ color: r.wr >= 60 ? "#34d399" : r.wr >= 45 ? "#f5c451" : "#f87171" }}>
              {r.wr.toFixed(0)}%
            </td>
            <td className="px-3 py-2.5 font-mono font-black"
              style={{ color: r.pnl >= 0 ? "#34d399" : "#f87171" }}>
              {usd(r.pnl)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PerformancePage() {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [stats, setStats]   = useState<JournalStats | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = loadTrades();
    setTrades(t);
    setStats(computeStats(t));
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const closed = trades.filter(t => t.result !== "running");
  const expectancy = stats && stats.closedTrades > 0
    ? (stats.winRate / 100 * stats.avgRR - (1 - stats.winRate / 100)).toFixed(2)
    : null;

  const maxDD = stats ? stats.maxDrawdown : 0;
  const pfColor = !stats ? "#475569" : stats.profitFactor >= 2 ? "#34d399" : stats.profitFactor >= 1.2 ? "#f5c451" : "#f87171";

  if (closed.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader title="Performance Analytics 📊" subtitle="วิเคราะห์ผลการเทรดเชิงลึก — อ่านจาก Trade Journal" />
        <div className="mt-16 text-center">
          <div className="text-4xl mb-4 opacity-20">📊</div>
          <div className="text-silver/30 text-sm">ยังไม่มี closed trades ใน Journal</div>
          <a href="/journal" className="mt-4 inline-block text-xs text-gold/50 hover:text-gold/80 transition-colors">
            → ไปที่ Trade Journal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Performance Analytics 📊"
        subtitle={`วิเคราะห์จาก ${closed.length} trades ที่ปิดแล้ว`} />

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label:"Win Rate",      value: stats ? `${stats.winRate.toFixed(0)}%` : "—",   color: stats && stats.winRate >= 55 ? "#34d399" : stats && stats.winRate >= 45 ? "#f5c451" : "#f87171" },
          { label:"Total P/L",     value: stats ? usd(stats.totalPnL) : "—",              color: stats && stats.totalPnL >= 0 ? "#34d399" : "#f87171" },
          { label:"Profit Factor", value: stats ? fmtN(stats.profitFactor) : "—",         color: pfColor },
          { label:"Avg R:R",       value: stats ? `1:${fmtN(stats.avgRR)}` : "—",         color: "#a78bfa" },
          { label:"Expectancy",    value: expectancy ? `${parseFloat(expectancy) >= 0 ? "+" : ""}${expectancy}R` : "—", color: parseFloat(expectancy ?? "0") >= 0 ? "#34d399" : "#f87171" },
          { label:"Max Drawdown",  value: stats ? `$${Math.abs(maxDD).toFixed(0)}` : "—", color: "#f87171" },
        ].map(c => (
          <div key={c.label} className="panel p-4">
            <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">{c.label}</div>
            <div className="font-mono text-xl font-black" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Win/Loss/BE breakdown ────────────────────────────────── */}
      {stats && (
        <div className="mb-5 panel p-4">
          <div className="mb-2 flex justify-between text-[10px] text-silver/35">
            <span>Win / Loss / B/E breakdown</span>
            <span>{stats.closedTrades} closed trades</span>
          </div>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            {[
              { n: stats.winCount,      color: "#34d399", label: "Win" },
              { n: stats.breakevenCount,color: "#f5c451", label: "B/E" },
              { n: stats.lossCount,     color: "#f87171", label: "Loss" },
            ].filter(x => x.n > 0).map(x => (
              <div key={x.label} className="h-full transition-all" title={`${x.label}: ${x.n}`}
                style={{ width: `${(x.n / stats.closedTrades) * 100}%`, background: x.color }} />
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-[10px]">
            <span className="text-emerald-400">■ Win {stats.winCount}</span>
            <span className="text-gold">■ B/E {stats.breakevenCount}</span>
            <span className="text-red-400">■ Loss {stats.lossCount}</span>
            <span className="ml-auto text-silver/30">Best: {usd(stats.bestTrade)} · Worst: {usd(stats.worstTrade)}</span>
          </div>
        </div>
      )}

      {/* ── Equity curve ────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Equity Curve (cumulative P/L)</div>
          <EquityCurve curve={stats?.equityCurve ?? []} />
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Drawdown %</div>
          <DrawdownCurve curve={stats?.equityCurve ?? []} />
          <div className="mt-2 text-[10px] text-silver/30">
            Max DD: <span className="text-red-400 font-bold">${Math.abs(maxDD).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ── Monthly bars + Setup breakdown ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Monthly P/L (12 months)</div>
          <MonthlyBars trades={trades} />
        </div>
        <div className="panel overflow-hidden">
          <div className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-widest text-silver/35">Performance by Setup</div>
          <SetupTable trades={trades} />
        </div>
      </div>

      <div className="mt-3 text-center text-[10px] text-silver/20">
        ข้อมูลจาก Trade Journal (localStorage) · เพิ่ม trade ได้ที่ /journal
      </div>
    </div>
  );
}
