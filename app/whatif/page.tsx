"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/shared";
import { Disclaimer } from "@/components/Disclaimer";
import { computeAllScenarios, type DrawdownRisk, type ScenarioResult } from "@/lib/scenarios";
import { PageHeader } from "@/components/PageHeader";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function riskTone(r: DrawdownRisk) {
  return r === "low" ? "text-bull" : r === "medium" ? "text-gold" : r === "high" ? "text-warn" : "text-bear";
}

export default function WhatifPage() {
  const { t, tb } = useI18n();
  const tk = t as (k: string) => string; // scenario keys live in the dictionary

  const [price, setPrice] = useState(0);
  const [atr, setAtr] = useState(0);
  const [lots, setLots] = useState(0.1);
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/market/xauusd", { cache: "no-store" });
        const m = await res.json();
        setPrice(m.price);
        setAtr(m.atr);
      } catch {
        setPrice(4000);
        setAtr(35);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const scenarios = useMemo<ScenarioResult[]>(
    () => (ready ? computeAllScenarios(price, atr, { lots, direction }) : []),
    [ready, price, atr, lots, direction]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title={t("whatifTitle")} subtitle={t("whatifSubtitle")} />

      {/* Position controls */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="stat-label mb-1 block">{t("wiLots")}</label>
            <input
              type="number"
              step={0.01}
              value={lots}
              onChange={(e) => setLots(parseFloat(e.target.value) || 0)}
              className="w-28 rounded-lg border border-base-border bg-base-panel px-3 py-2 font-mono text-sm text-silver outline-none focus:border-neon/50"
            />
          </div>
          <div>
            <div className="stat-label mb-1">{t("wiPosition")}</div>
            <div className="inline-flex overflow-hidden rounded-lg border border-base-border">
              {(["buy", "sell"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`px-4 py-2 text-sm font-semibold ${
                    direction === d ? (d === "buy" ? "bg-bull/20 text-bull" : "bg-bear/20 text-bear") : "text-silver/50"
                  }`}
                >
                  {d === "buy" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto text-right text-xs text-silver/50">
            XAUUSD {price ? money(price) : "—"} · ATR {atr ? money(atr) : "—"}
          </div>
        </div>
      </Card>

      {!ready ? (
        <div className="flex h-48 items-center justify-center text-silver/50">{t("loadingWhatif")}</div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-base-border text-left">
                {[t("wiScenario"), t("wiGold"), t("wiMove"), t("wiTarget"), t("wiPnl"), t("wiDrawdown"), ""].map((h, i) => (
                  <th key={i} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <ScenarioRow key={s.key} s={s} open={open === s.key} onToggle={() => setOpen(open === s.key ? null : s.key)} tk={tk} tb={tb} riskTone={riskTone} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6">
        <Disclaimer />
      </div>
    </main>
  );
}

function ScenarioRow({
  s,
  open,
  onToggle,
  tk,
  tb,
  riskTone,
}: {
  s: ScenarioResult;
  open: boolean;
  onToggle: () => void;
  tk: (k: string) => string;
  tb: (b: { th: string; en: string }) => string;
  riskTone: (r: DrawdownRisk) => string;
}) {
  const goldTone = s.goldDirection === "bullish" ? "text-bull" : "text-bear";
  return (
    <>
      <tr className={`border-b border-base-border/40 ${s.adverse ? "bg-bear/5" : ""}`}>
        <td className="px-3 py-3 font-medium text-silver">{tk(s.key)}</td>
        <td className={`px-3 py-3 font-medium ${goldTone}`}>{s.goldDirection === "bullish" ? "▲" : "▼"}</td>
        <td className={`px-3 py-3 font-mono ${goldTone}`}>
          {s.moveDollars >= 0 ? "+" : ""}
          {s.moveDollars} ({s.movePct >= 0 ? "+" : ""}
          {s.movePct}%)
        </td>
        <td className="px-3 py-3 font-mono text-silver/80">{s.targetPrice.toLocaleString()}</td>
        <td className={`px-3 py-3 font-mono font-semibold ${s.pnl >= 0 ? "text-bull" : "text-bear"}`}>
          {s.pnl >= 0 ? "+" : "-"}${money(Math.abs(s.pnl))}
        </td>
        <td className={`px-3 py-3 font-medium ${riskTone(s.drawdownRisk)}`}>
          {tk(s.drawdownRisk === "low" ? "riskLow" : s.drawdownRisk === "medium" ? "riskMedium" : s.drawdownRisk === "high" ? "riskHigh" : "riskExtreme")}
        </td>
        <td className="px-3 py-3 text-right">
          <button onClick={onToggle} className="rounded-md border border-base-border px-2 py-1 text-xs text-silver/60 hover:text-silver">
            {tk("wiDetails")}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-base-border/40 bg-base-panel/40">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-bull">{tk("wiAction")}</div>
                <p className="text-sm text-silver/80">{tb(s.action)}</p>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neon">{tk("wiAlternative")}</div>
                <p className="text-sm text-silver/80">{tb(s.alternative)}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
