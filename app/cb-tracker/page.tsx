"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { CBTrackerPayload, CentralBankEntry } from "@/app/api/cb-tracker/route";

const CAT_LABEL: Record<CentralBankEntry["category"], string> = {
  western: "ตะวันตก", emerging: "Emerging", asian: "เอเชีย", middle_east: "ตะวันออกกลาง",
};
const CAT_COLOR: Record<CentralBankEntry["category"], string> = {
  western: "#818cf8", emerging: "#f97316", asian: "#f5c451", middle_east: "#34d399",
};

function PressureMeter({ score }: { score: number }) {
  const color = score >= 65 ? "#34d399" : score >= 40 ? "#f5c451" : "#f87171";
  const pct = score / 100;
  const W = 200, H = 20, R = 6;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
        <span>Low Buying</span><span>Strong Buying</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
        {/* track */}
        <rect x={0} y={4} width={W} height={12} rx={R} fill="rgba(255,255,255,0.04)" />
        {/* fill */}
        <rect x={0} y={4} width={W * pct} height={12} rx={R} fill={color} opacity={0.85} />
        {/* score label */}
        <text x={W * pct} y={13} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
          {score}
        </text>
      </svg>
    </div>
  );
}

function TonnesBar({ tonnes, max }: { tonnes: number; max: number }) {
  const pct = Math.max(2, (tonnes / max) * 100);
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", width: "80px" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#f5c451,#c084fc)" }} />
    </div>
  );
}

function CountryRow({ e, max }: { e: CentralBankEntry; max: number }) {
  return (
    <div className="panel px-4 py-3 flex items-center gap-3">
      <span className="text-xl shrink-0">{e.flag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.85)" }}>
            {e.countryTh}
          </span>
          <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
            style={{ background: CAT_COLOR[e.category] + "22", color: CAT_COLOR[e.category] }}>
            {CAT_LABEL[e.category]}
          </span>
        </div>
        <TonnesBar tonnes={e.totalTonnes} max={max} />
        <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
          อัปเดต {e.lastUpdated}
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <div className="text-sm font-black" style={{ color: "rgba(245,196,81,0.9)" }}>
          {e.totalTonnes.toLocaleString()}t
        </div>
        <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
          {e.reservePct}% reserves
        </div>
        <div className="text-[9px] font-bold flex items-center justify-end gap-0.5" style={{ color: e.trendColor }}>
          {e.trend === "buying" ? "▲" : e.trend === "selling" ? "▼" : "─"}
          {e.yoyChange !== 0 ? ` ${e.yoyChange > 0 ? "+" : ""}${e.yoyChange}t` : " คงที่"}
        </div>
      </div>
    </div>
  );
}

export default function CBTrackerPage() {
  const [data, setData]       = useState<CBTrackerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [filter, setFilter]   = useState<CentralBankEntry["category"] | "all">("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/cb-tracker", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cats = ["all", "western", "asian", "emerging", "middle_east"] as const;
  const filtered = data?.entries.filter(e => filter === "all" || e.category === filter) ?? [];
  const maxTonnes = data?.entries[0]?.totalTonnes ?? 8133;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🏦 Central Bank Gold Tracker"
        subtitle="ติดตามการสำรองทองของธนาคารกลางทั่วโลก — ผู้ซื้อทองรายใหญ่ที่สุดในโลก"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🏦 กำลังโหลดข้อมูลธนาคารกลาง…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Summary hero */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Total CB Gold
                </div>
                <div className="text-lg font-black" style={{ color: "#f5c451" }}>
                  {data.totalCBGold.toLocaleString()}t
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                  ~${data.marketValueBn.toLocaleString()}B USD
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Net Bought YoY
                </div>
                <div className="text-lg font-black" style={{ color: data.netBuyingYoY >= 0 ? "#34d399" : "#f87171" }}>
                  {data.netBuyingYoY >= 0 ? "+" : ""}{data.netBuyingYoY}t
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                  {data.buyingCountries} ประเทศซื้อ
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Top Buyer
                </div>
                <div className="text-sm font-black flex items-center gap-1" style={{ color: "#34d399" }}>
                  <span>{data.topBuyerFlag}</span>
                  <span>{data.topBuyer}</span>
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                  +{data.topBuyerTonnes}t YoY
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Gold Price
                </div>
                <div className="text-lg font-black" style={{ color: "rgba(175,185,215,0.85)" }}>
                  ${data.goldPrice.toLocaleString()}
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>GC=F</div>
              </div>
            </div>

            {/* Buying pressure */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
                  CB Buying Pressure
                </div>
                <div className="text-[9px] font-bold" style={{ color: data.goldBiasColor }}>
                  {data.goldBiasTh.split(" — ")[0]}
                </div>
              </div>
              <PressureMeter score={data.buyingPressureScore} />
            </div>

            <div className="text-xs font-medium" style={{ color: data.goldBiasColor }}>
              {data.goldBiasTh}
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {cats.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className="px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all"
                style={{
                  background: filter === c ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filter === c ? "rgba(245,196,81,0.5)" : "rgba(255,255,255,0.06)"}`,
                  color: filter === c ? "#f5c451" : "rgba(175,185,215,0.5)",
                }}>
                {c === "all" ? "ทั้งหมด" : CAT_LABEL[c as CentralBankEntry["category"]]}
              </button>
            ))}
          </div>

          {/* Country list */}
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-widest px-1 mb-2"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              ธนาคารกลาง ({filtered.length} ประเทศ)
            </div>
            {filtered.map(e => <CountryRow key={e.country} e={e} max={maxTonnes} />)}
          </div>

          {/* Reserve % top 5 */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              % ทองในทุนสำรอง (Top 5)
            </div>
            <div className="space-y-2">
              {[...data.entries].sort((a, b) => b.reservePct - a.reservePct).slice(0, 5).map(e => (
                <div key={e.country} className="flex items-center gap-2">
                  <span className="text-sm w-5">{e.flag}</span>
                  <span className="text-[9px] w-20 shrink-0" style={{ color: "rgba(175,185,215,0.55)" }}>
                    {e.countryTh}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full" style={{
                      width: `${e.reservePct}%`,
                      background: e.reservePct > 50 ? "#f5c451" : "#c084fc",
                    }} />
                  </div>
                  <span className="text-[9px] font-bold w-10 text-right" style={{ color: "#f5c451" }}>
                    {e.reservePct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Why CB gold matters */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 ทำไมการซื้อทองของ CB ถึงสำคัญ
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ ธนาคารกลางเป็นผู้ถือทองรายใหญ่ที่สุด — ซื้อสุทธิ ~1,000 ตัน/ปีในช่วง 2022-2024</li>
              <li>→ การกระจายออกจาก USD: รัสเซีย จีน อินเดีย ลด USD holdings เปลี่ยนเป็นทอง</li>
              <li>→ De-dollarization trend → structural demand สำหรับทองในระยะยาว</li>
              <li>→ โปแลนด์และสาธารณรัฐเช็กเพิ่มทองเพื่อ hedge NATO/geopolitical risk</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ ข้อมูลอิงจาก World Gold Council — อัปเดตรายไตรมาส | {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
