"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { LeaderboardPayload, AssetRow } from "@/app/api/leaderboard/route";

const CAT_COLOR: Record<AssetRow["category"], string> = {
  gold: "#f5c451", equity: "#818cf8", crypto: "#f97316",
  commodity: "#34d399", bond: "#9ca3af", forex: "#c084fc",
};
const CAT_LABEL: Record<AssetRow["category"], string> = {
  gold: "ทอง", equity: "หุ้น", crypto: "Crypto", commodity: "Commodity", bond: "Bond", forex: "Forex",
};

function RetCell({ val }: { val: number }) {
  const color = val > 1 ? "#34d399" : val > 0 ? "#86efac" : val < -1 ? "#f87171" : val < 0 ? "#f97316" : "#9ca3af";
  return (
    <span className="text-[10px] font-bold" style={{ color }}>
      {val >= 0 ? "+" : ""}{val.toFixed(2)}%
    </span>
  );
}

function MiniBar({ val, maxAbs }: { val: number; maxAbs: number }) {
  if (maxAbs === 0) return null;
  const pct = Math.abs(val) / maxAbs * 50;
  const color = val >= 0 ? "#34d399" : "#f87171";
  return (
    <div className="flex items-center h-1.5">
      {val < 0 && (
        <div className="h-full rounded-l" style={{ width: `${pct}%`, background: color, marginLeft: `${50 - pct}%` }} />
      )}
      <div className="w-px h-3 shrink-0" style={{ background: "rgba(255,255,255,0.06)" }} />
      {val >= 0 && (
        <div className="h-full rounded-r" style={{ width: `${pct}%`, background: color }} />
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  if (medals[rank]) return <span className="text-sm">{medals[rank]}</span>;
  return (
    <span className="text-[10px] font-bold w-5 text-center" style={{ color: "rgba(175,185,215,0.3)" }}>
      #{rank}
    </span>
  );
}

function AssetRowItem({ row, maxYtd }: { row: AssetRow; maxYtd: number }) {
  const isTop3 = row.rankYtd <= 3;
  return (
    <div className="panel px-4 py-3" style={
      row.isGold ? { border: "1px solid rgba(245,196,81,0.3)", background: "rgba(245,196,81,0.03)" } : undefined
    }>
      <div className="flex items-center gap-3">
        <RankBadge rank={row.rankYtd} />
        <span className="text-base w-6 text-center shrink-0">{row.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold" style={{ color: row.isGold ? "#f5c451" : "rgba(175,185,215,0.85)" }}>
              {row.nameTh}
            </span>
            {row.isGold && (
              <span className="text-[8px] px-1 py-0.5 rounded font-bold"
                style={{ background: "rgba(245,196,81,0.15)", color: "#f5c451" }}>
                YOUR ASSET
              </span>
            )}
            <span className="text-[8px] px-1 py-0.5 rounded font-bold"
              style={{ background: CAT_COLOR[row.category] + "22", color: CAT_COLOR[row.category] }}>
              {CAT_LABEL[row.category]}
            </span>
          </div>
          <MiniBar val={row.retYtd} maxAbs={maxYtd} />
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <RetCell val={row.retYtd} />
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>YTD</div>
        </div>
        <div className="hidden sm:block text-right shrink-0 space-y-0.5 ml-4">
          <RetCell val={row.ret1m} />
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>1M</div>
        </div>
        <div className="hidden sm:block text-right shrink-0 space-y-0.5 ml-4">
          <RetCell val={row.ret1d} />
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>1D</div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData]       = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [period, setPeriod]   = useState<"ytd" | "1m" | "1w" | "1d">("ytd");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/leaderboard", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = data ? [...data.rows].sort((a, b) => {
    const retA = period === "ytd" ? a.retYtd : period === "1m" ? a.ret1m : period === "1w" ? a.ret1w : a.ret1d;
    const retB = period === "ytd" ? b.retYtd : period === "1m" ? b.ret1m : period === "1w" ? b.ret1w : b.ret1d;
    return retB - retA;
  }) : [];

  const maxYtd = sorted.length ? Math.max(...sorted.map(r => Math.abs(r.retYtd))) : 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🏆 Asset Leaderboard"
        subtitle="จัดอันดับ performance ทอง vs สินทรัพย์ชั้นนำ — ทองเทียบกับตลาดได้แค่ไหน?"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🏆 กำลังจัดอันดับ…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold YTD Rank</div>
                <div className="text-2xl font-black" style={{ color: "#f5c451" }}>
                  #{data.goldRankYtd}
                  <span className="text-sm font-normal ml-1" style={{ color: "rgba(175,185,215,0.4)" }}>
                    of {data.goldRankOf}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold YTD Return</div>
                <div className="text-2xl font-black" style={{ color: data.goldRetYtd >= 0 ? "#34d399" : "#f87171" }}>
                  {data.goldRetYtd >= 0 ? "+" : ""}{data.goldRetYtd.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Best Asset YTD</div>
                <div className="text-base font-black flex items-center gap-1">
                  <span>{data.bestAssetFlag}</span>
                  <span style={{ color: "rgba(175,185,215,0.85)" }}>{data.bestAsset}</span>
                </div>
                <div className="text-[9px]" style={{ color: "#34d399" }}>+{data.bestRetYtd.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Period toggle */}
          <div className="flex gap-2">
            {(["ytd", "1m", "1w", "1d"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all uppercase"
                style={{
                  background: period === p ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${period === p ? "rgba(245,196,81,0.5)" : "rgba(255,255,255,0.06)"}`,
                  color: period === p ? "#f5c451" : "rgba(175,185,215,0.5)",
                }}>
                {p}
              </button>
            ))}
          </div>

          {/* Header labels */}
          <div className="flex items-center gap-3 px-4 text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.25)" }}>
            <span className="w-5" />
            <span className="w-6" />
            <span className="flex-1">Asset</span>
            <span className="text-right w-16">YTD</span>
            <span className="hidden sm:block text-right w-16">1M</span>
            <span className="hidden sm:block text-right w-16">1D</span>
          </div>

          {/* Leaderboard */}
          <div className="space-y-2">
            {sorted.map((row, idx) => (
              <AssetRowItem key={row.symbol} row={{ ...row, rankYtd: idx + 1 }} maxYtd={maxYtd} />
            ))}
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ YTD = ตั้งแต่ต้นปี 2026 | ข้อมูลจาก Yahoo Finance | {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
