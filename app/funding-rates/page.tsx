"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { FundingRatesPayload, FundingEntry } from "@/app/api/funding-rates/route";

function msToNextFunding(nextMs: number): string {
  if (!nextMs) return "—";
  const diff = nextMs - Date.now();
  if (diff <= 0) return "กำลัง settle…";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function FundingBar({ history, color }: { history: number[]; color: string }) {
  if (!history.length) return null;
  const max = Math.max(...history.map(Math.abs), 0.05);
  const W = 160, H = 32, barW = Math.max(4, Math.floor(W / history.length) - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      {history.map((v, i) => {
        const h = Math.abs(v) / max * (H / 2 - 2);
        const x = i * (barW + 1);
        const positive = v >= 0;
        return (
          <rect
            key={i}
            x={x}
            y={positive ? H / 2 - h : H / 2}
            width={barW}
            height={h}
            fill={positive ? color : "#818cf8"}
            opacity={0.75}
          />
        );
      })}
    </svg>
  );
}

function EntryCard({ e }: { e: FundingEntry }) {
  const ratePct = e.fundingRatePct;
  const rateColor = ratePct > 0.05 ? "#f87171" : ratePct > 0.01 ? "#f97316" : ratePct < -0.03 ? "#34d399" : ratePct < 0 ? "#86efac" : "#9ca3af";

  return (
    <div className="panel px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-black" style={{ color: "rgba(175,185,215,0.9)" }}>
            {e.label}
            <span className="ml-1.5 text-[9px] font-normal" style={{ color: "rgba(175,185,215,0.35)" }}>
              {e.labelTh}
            </span>
          </div>
          <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
            Mark: ${e.markPrice > 0 ? e.markPrice.toLocaleString("en", { maximumFractionDigits: 2 }) : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black" style={{ color: rateColor }}>
            {ratePct >= 0 ? "+" : ""}{ratePct.toFixed(4)}%
          </div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
            {e.annualizedPct >= 0 ? "+" : ""}{e.annualizedPct.toFixed(1)}% annualized
          </div>
        </div>
      </div>

      {/* Sentiment + gold implication */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Sentiment</div>
          <div className="text-[9px] font-bold" style={{ color: e.sentimentColor }}>{e.sentimentTh}</div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Impact</div>
          <div className="text-[9px] font-bold" style={{
            color: e.goldImplication === "bullish" ? "#34d399" : e.goldImplication === "bearish" ? "#f87171" : "#9ca3af"
          }}>{e.goldImplicationTh}</div>
        </div>
      </div>

      {/* History sparkbar */}
      {e.history.length > 0 && (
        <div>
          <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
            Funding rate history (last {e.history.length} periods)
          </div>
          <FundingBar history={e.history} color={rateColor} />
        </div>
      )}

      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Next funding: {msToNextFunding(e.nextFundingMs)}
      </div>
    </div>
  );
}

export default function FundingRatesPage() {
  const [data, setData]       = useState<FundingRatesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/funding-rates", { cache: "no-store" });
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
        title="📡 Crypto Funding Rates"
        subtitle="Funding rates ของ BTC / ETH perpetuals — ใช้วิเคราะห์ sentiment ตลาดและผลต่อทอง"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📡 กำลังดึงข้อมูล Binance Perp…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Summary */}
          <div className="panel px-5 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Market Signal
                </div>
                <div className="text-base font-black" style={{ color: data.compositeSignalColor }}>
                  {data.compositeSignal === "risk_on" ? "🔥 Risk-On" : data.compositeSignal === "risk_off" ? "🛡️ Risk-Off" : "⚖️ Neutral"}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
                  {data.compositeSignalTh}
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Gold Bias
                </div>
                <div className="text-base font-black" style={{ color: data.goldBiasColor }}>
                  {data.goldBias === "bullish" ? "🟢 Bullish" : data.goldBias === "bearish" ? "🔴 Bearish" : "⚪ Neutral"}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
                  {data.goldBiasTh.split(" — ")[0]}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
              <span>Avg funding (BTC+ETH): <span className="font-bold" style={{ color: data.avgFundingRate >= 0 ? "#f97316" : "#34d399" }}>
                {data.avgFundingRate >= 0 ? "+" : ""}{data.avgFundingRate.toFixed(4)}%
              </span></span>
              <span>Gold: <span className="font-bold" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</span></span>
            </div>
          </div>

          {/* Individual entries */}
          {data.entries.map(e => <EntryCard key={e.symbol} e={e} />)}

          {/* How to read */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 วิธีอ่าน Funding Rates
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ <span className="font-bold" style={{ color: "#f97316" }}>Funding สูง (&gt;0.05%)</span> = ตลาดถือ long มาก, cost of holding long สูง → มักเกิด squeeze → ทองอาจได้ประโยชน์</li>
              <li>→ <span className="font-bold" style={{ color: "#34d399" }}>Funding ติดลบ</span> = short สูงกว่า long → ตลาด risk-off → หนุนทอง safe haven</li>
              <li>→ Funding rates settle ทุก 8 ชั่วโมง: 00:00, 08:00, 16:00 UTC</li>
              <li>→ XAU perp funding สะท้อน sentiment ตลาดทองคำโดยตรง</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ ข้อมูลจาก Binance FAPI — อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
