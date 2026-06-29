"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/shared";
import { Disclaimer } from "@/components/Disclaimer";
import { PageHeader } from "@/components/PageHeader";
import {
  computeRisk,
  portfolioHeat,
  riskLabel,
  volatilityAdjustment,
  type RiskLabel,
} from "@/lib/risk";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function labelColor(l: RiskLabel) {
  return l === "low"
    ? "text-bull bg-bull/15 border-bull/40"
    : l === "medium"
      ? "text-gold bg-gold/15 border-gold/40"
      : l === "high"
        ? "text-warn bg-warn/15 border-warn/40"
        : "text-bear bg-bear/15 border-bear/40";
}

export default function RiskPage() {
  const { t, rmRisk } = useI18n();

  const [balance, setBalance] = useState(10000);
  const [currency, setCurrency] = useState<"USD" | "USC">("USD");
  const [riskPct, setRiskPct] = useState(1);
  const [leverage, setLeverage] = useState(100);
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [entry, setEntry] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [openTrades, setOpenTrades] = useState(1);

  const [atr, setAtr] = useState(0);
  const [newsWarning, setNewsWarning] = useState(false);
  const [livePrice, setLivePrice] = useState(0);
  const [prefilled, setPrefilled] = useState(false);

  // Prefill entry/SL from live market data once.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/market/xauusd", { cache: "no-store" });
        const m = await res.json();
        setLivePrice(m.price);
        setAtr(m.atr);
        setNewsWarning(!!m.newsRisk?.warning);
        if (!prefilled) {
          setEntry(m.price);
          setStopLoss(+(m.price - 1.5 * m.atr).toFixed(2));
          setPrefilled(true);
        }
      } catch {
        /* keep manual entry */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // USC = US Cents: 1 USD = 100 USC. Convert to USD for all calculations.
  const balanceUSD = currency === "USC" ? balance / 100 : balance;
  const cSign      = currency === "USC" ? "¢" : "$";
  const toDisp     = (usd: number) => currency === "USC" ? usd * 100 : usd;

  const result = useMemo(
    () => computeRisk({ balance: balanceUSD, riskPct, leverage, entry, stopLoss, direction }),
    [balanceUSD, riskPct, leverage, entry, stopLoss, direction]
  );

  const level = riskLabel(riskPct, result.marginPct, newsWarning);
  const heat = portfolioHeat(riskPct, openTrades);
  const vol = volatilityAdjustment(atr, result.slDistance, result.riskAmount);

  const useLive = () => {
    if (livePrice > 0) {
      setEntry(livePrice);
      setStopLoss(+(livePrice - (direction === "buy" ? 1 : -1) * 1.5 * atr).toFixed(2));
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title={t("riskTitle")} subtitle={t("riskSubtitle")} />

      {newsWarning && (
        <div className="mb-4 rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm font-medium text-warn">
          {t("rmNewsWarn")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inputs */}
        <Card>
          <div className="stat-label mb-3">{t("rmInputs")}</div>
          <div className="space-y-3">
            {/* Balance + USD/USC toggle */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="stat-label">{t("rmBalance")}</label>
                <div className="flex overflow-hidden rounded-lg border border-base-border text-xs font-bold">
                  {(["USD", "USC"] as const).map(c => (
                    <button key={c} onClick={() => setCurrency(c)}
                      className={`px-3 py-1 transition-colors ${currency === c ? "bg-gold/20 text-gold" : "text-silver/40"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <input type="number" value={Number.isFinite(balance) ? balance : ""} step={100}
                onChange={e => setBalance(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-base-border bg-base-panel px-3 py-2 font-mono text-sm text-silver outline-none focus:border-neon/50" />
              {currency === "USC" && balance > 0 && (
                <div className="mt-1 text-[11px] text-silver/40">
                  = ${money(balance / 100)} USD จริง
                </div>
              )}
            </div>
            <Field label={t("rmRiskPct")} value={riskPct} onChange={setRiskPct} step={0.25} />
            <Field label={t("rmLeverage")} value={leverage} onChange={setLeverage} step={50} />
            <div>
              <div className="stat-label mb-1">{t("rmDirection")}</div>
              <div className="inline-flex overflow-hidden rounded-lg border border-base-border">
                {(["buy", "sell"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`px-4 py-1.5 text-sm font-semibold ${
                      direction === d
                        ? d === "buy"
                          ? "bg-bull/20 text-bull"
                          : "bg-bear/20 text-bear"
                        : "text-silver/50"
                    }`}
                  >
                    {d === "buy" ? t("rmBuy") : t("rmSell")}
                  </button>
                ))}
              </div>
            </div>
            <Field label={t("rmEntry")} value={entry} onChange={setEntry} step={0.5} />
            <Field label={t("rmStop")} value={stopLoss} onChange={setStopLoss} step={0.5} />
            <button
              onClick={useLive}
              disabled={!livePrice}
              className="rounded-lg border border-neon/40 bg-neon/10 px-3 py-1.5 text-xs font-medium text-neon disabled:opacity-40"
            >
              {t("rmUseLive")}{livePrice ? ` · ${money(livePrice)}` : ""}
            </button>
          </div>
        </Card>

        {/* Results */}
        <Card accent="neon">
          <div className="mb-3 flex items-center justify-between">
            <span className="stat-label">{t("rmResults")}</span>
            <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${labelColor(level)}`}>
              {rmRisk(level)}
            </span>
          </div>
          <div className="text-center">
            <div className="stat-label">{t("rmLotSize")}</div>
            <div className="font-mono text-4xl font-bold text-neon">{result.lots.toFixed(2)}</div>
            <div className="text-xs text-silver/40">{result.units.toLocaleString()} oz</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Stat label={t("rmRiskAmount")} value={`${cSign}${money(toDisp(result.riskAmount))}`} />
            <Stat label={t("rmSlDistance")} value={money(result.slDistance)} />
            <Stat label={t("rmPotentialLoss")} value={`-${cSign}${money(toDisp(result.potentialLoss))}`} tone="text-bear" />
            <Stat label={t("rmNotional")} value={`${cSign}${money(toDisp(result.notional))}`} />
            <Stat label={t("rmMargin")} value={`${cSign}${money(toDisp(result.margin))}`} />
            <Stat label={t("rmMarginPct")} value={`${result.marginPct}%`} tone={result.marginPct > 60 ? "text-warn" : undefined} />
          </div>
          <div className="mt-4">
            <div className="stat-label mb-1">{t("rmTakeProfit")}</div>
            <div className="grid grid-cols-3 gap-2">
              {result.takeProfits.map((tp) => (
                <div key={tp.rr} className="rounded-lg border border-base-border/60 bg-base-panel/50 p-2 text-center">
                  <div className="text-[11px] text-silver/50">1:{tp.rr}</div>
                  <div className="font-mono text-sm text-bull">{money(tp.price)}</div>
                  <div className="text-[10px] text-silver/40">+{cSign}{money(toDisp(tp.reward))}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Volatility + Portfolio */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="stat-label mb-3">{t("rmVolAdj")}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label={t("rmAtrToday")} value={money(atr)} />
            <Stat label={t("rmRecommendedSl")} value={money(vol.recommendedSlDistance)} />
            <Stat label={t("rmRecommendedLots")} value={vol.recommendedLots.toFixed(2)} tone="text-neon" />
          </div>
          {vol.tooTight && <div className="mt-3 rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{t("rmTooTight")}</div>}
        </Card>

        <Card>
          <div className="stat-label mb-3">{t("rmPortfolio")}</div>
          <Field label={t("rmOpenTrades")} value={openTrades} onChange={setOpenTrades} step={1} />
          <div className="mt-3 flex items-center justify-between rounded-lg border border-base-border/60 bg-base-panel/50 px-3 py-2">
            <span className="text-sm text-silver/60">{t("rmTotalHeat")}</span>
            <span className={`rounded-md border px-2 py-0.5 text-sm font-bold ${labelColor(heat.label)}`}>
              {heat.heat}% · {rmRisk(heat.label)}
            </span>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Disclaimer />
      </div>
    </main>
  );
}

function Field({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div>
      <label className="stat-label mb-1 block">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-base-border bg-base-panel px-3 py-2 font-mono text-sm text-silver outline-none focus:border-neon/50"
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-base-border/60 bg-base-panel/50 p-2">
      <div className="stat-label">{label}</div>
      <div className={`font-mono font-semibold ${tone ?? "text-silver"}`}>{value}</div>
    </div>
  );
}
