"use client";

import { useI18n } from "@/lib/i18n";
import type { HealthLabel, PortfolioSnapshot } from "@/lib/types";
import { Card, ScoreRing } from "./shared";

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plTone = (n: number) => (n >= 0 ? "text-bull" : "text-bear");

export function EquityCurve({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 600;
  const h = 140;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / span) * (h - 10) - 5;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const up = points[points.length - 1] >= points[0];
  const stroke = up ? "#22c55e" : "#ef4444";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eq)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-base-border/60 bg-base-panel/50 p-3">
      <div className="stat-label">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${tone ?? "text-silver"}`}>{value}</div>
    </div>
  );
}

export function PortfolioSummary({ data }: { data: PortfolioSnapshot }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Stat label={t("pfBalance")} value={money(data.balance)} />
      <Stat label={t("pfEquity")} value={money(data.equity)} tone="text-gold" />
      <Stat label={t("pfFloating")} value={money(data.floatingPL)} tone={plTone(data.floatingPL)} />
      <Stat label={t("pfDrawdown")} value={`${data.drawdownPct}%`} tone={data.drawdownPct > 10 ? "text-bear" : "text-silver"} />
      <Stat label={t("pfToday")} value={money(data.todayProfit)} tone={plTone(data.todayProfit)} />
      <Stat label={t("pfWeek")} value={money(data.weeklyProfit)} tone={plTone(data.weeklyProfit)} />
      <Stat label={t("pfMonth")} value={money(data.monthlyProfit)} tone={plTone(data.monthlyProfit)} />
      <Stat label={t("pfMarginLevel")} value={`${data.marginLevel}%`} tone={data.marginLevel < 200 ? "text-warn" : "text-silver"} />
    </div>
  );
}

function healthLabelText(l: HealthLabel, t: (k: never) => string) {
  return l === "healthy" ? t("hpHealthy" as never) : l === "watch" ? t("hpWatch" as never) : l === "risky" ? t("hpRisky" as never) : t("hpCritical" as never);
}

export function PortfolioHealth({ data }: { data: PortfolioSnapshot }) {
  const { t } = useI18n();
  const tone =
    data.healthLabel === "healthy" ? "text-bull" : data.healthLabel === "watch" ? "text-gold" : data.healthLabel === "risky" ? "text-warn" : "text-bear";
  const dir = data.netDirection === "long" ? t("pfLong") : data.netDirection === "short" ? t("pfShort") : t("pfFlat");
  return (
    <Card accent="neon">
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center">
          <span className="stat-label mb-1">{t("pfHealth")}</span>
          <ScoreRing score={data.healthScore} />
          <span className={`mt-1 text-sm font-semibold ${tone}`}>{healthLabelText(data.healthLabel, t as never)}</span>
        </div>
        <div className="flex-1 space-y-2 text-sm">
          <Row label={t("pfExposure")} value={`${data.lotExposure} lots`} />
          <Row label={t("pfNetDir")} value={dir} tone={data.netDirection === "long" ? "text-bull" : data.netDirection === "short" ? "text-bear" : "text-silver/60"} />
          <Row label={t("pfMarginUsed")} value={money(data.marginUsed)} />
          <Row label={t("pfFreeMargin")} value={money(data.freeMargin)} />
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-silver/60">{label}</span>
      <span className={`font-mono font-semibold ${tone ?? "text-silver/85"}`}>{value}</span>
    </div>
  );
}

export function PositionsTable({ data }: { data: PortfolioSnapshot }) {
  const { t } = useI18n();
  return (
    <Card className="overflow-x-auto p-0">
      <div className="border-b border-base-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gold/80">
        {t("pfPositions")}
      </div>
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <tbody>
          {data.positions.map((p, i) => (
            <tr key={i} className="border-b border-base-border/40">
              <td className="px-4 py-2.5 text-silver/70">{p.ea}</td>
              <td className={`px-3 py-2.5 font-semibold ${p.direction === "buy" ? "text-bull" : "text-bear"}`}>
                {p.direction === "buy" ? "BUY" : "SELL"}
              </td>
              <td className="px-3 py-2.5 font-mono text-silver/70">{p.lots} lot</td>
              <td className="px-3 py-2.5 font-mono text-silver/50">@ {p.entry.toLocaleString()}</td>
              <td className={`px-4 py-2.5 text-right font-mono font-semibold ${plTone(p.floating)}`}>{money(p.floating)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function EaCards({ data }: { data: PortfolioSnapshot }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.eas.map((ea) => (
        <Card key={ea.name}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-silver">{ea.name}</span>
            <span className={`flex items-center gap-1 text-xs ${ea.status === "running" ? "text-bull" : "text-silver/40"}`}>
              <span className={`h-2 w-2 rounded-full ${ea.status === "running" ? "bg-bull live-dot" : "bg-silver/30"}`} />
              {ea.status === "running" ? t("pfRunning") : t("pfPaused")}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Mini label={t("pfWinRate")} value={`${ea.winRate}%`} />
            <Mini label={t("pfProfitFactor")} value={`${ea.profitFactor}`} />
            <Mini label={t("pfRecovery")} value={`${ea.recoveryFactor}`} />
            <Mini label={t("pfGrid")} value={`${ea.currentGrid}`} />
          </div>
          <div className="mt-2 text-right text-xs">
            <span className="text-silver/50">{t("pfToday")}: </span>
            <span className={`font-mono font-semibold ${plTone(ea.todayProfit)}`}>{money(ea.todayProfit)}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-base-panel/50 px-2 py-1.5">
      <div className="text-[10px] text-silver/40">{label}</div>
      <div className="font-mono text-silver/85">{value}</div>
    </div>
  );
}
