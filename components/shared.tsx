"use client";

import type { ReactNode } from "react";
import type { RecommendationLabel, RiskLevel } from "@/lib/types";

// ---- formatting helpers ----------------------------------------------------
export const fmtPrice = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtSigned = (n: number) =>
  `${n >= 0 ? "+" : ""}${fmtPrice(n)}`;

// minutes -> "2h 15m" / "45m"
export function fmtDuration(mins: number, hLabel: string, mLabel: string): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}${hLabel} ${m}${mLabel}`;
  return `${m}${mLabel}`;
}

// ---- generic card ----------------------------------------------------------
export function Card({
  children,
  className = "",
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: "gold" | "neon" | "none";
}) {
  const ring =
    accent === "gold"
      ? "shadow-goldglow border-gold/30"
      : accent === "neon"
        ? "shadow-glow border-neon/30"
        : "";
  return <div className={`panel p-4 ${ring} ${className}`}>{children}</div>;
}

export function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      className={`live-dot inline-block h-2 w-2 rounded-full ${
        live ? "bg-bull" : "bg-warn"
      }`}
    />
  );
}

// ---- recommendation tone ---------------------------------------------------
export function recoTone(label: RecommendationLabel): {
  text: string;
  bg: string;
  border: string;
} {
  switch (label) {
    case "strong_buy":
    case "buy":
      return { text: "text-bull", bg: "bg-bull/15", border: "border-bull/40" };
    case "buy_on_pullback":
      return { text: "text-gold", bg: "bg-gold/15", border: "border-gold/40" };
    case "strong_sell":
    case "sell":
      return { text: "text-bear", bg: "bg-bear/15", border: "border-bear/40" };
    case "sell_on_rally":
      return { text: "text-warn", bg: "bg-warn/15", border: "border-warn/40" };
    case "high_news_risk":
      return { text: "text-warn", bg: "bg-warn/20", border: "border-warn/50" };
    default:
      return { text: "text-silver", bg: "bg-silver/10", border: "border-silver/30" };
  }
}

// ---- signal badge ----------------------------------------------------------
export function SignalBadge({
  label,
  text,
}: {
  label: RecommendationLabel;
  text: string;
}) {
  const tone = recoTone(label);
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-3 py-1 text-sm font-semibold ${tone.text} ${tone.bg} ${tone.border}`}
    >
      {text}
    </span>
  );
}

// ---- risk meter ------------------------------------------------------------
const RISK_ORDER: RiskLevel[] = ["low", "medium", "high", "extreme"];
const RISK_COLOR: Record<RiskLevel, string> = {
  low: "bg-bull",
  medium: "bg-gold",
  high: "bg-warn",
  extreme: "bg-bear",
};

export function RiskMeter({ level, label }: { level: RiskLevel; label: string }) {
  const activeIdx = RISK_ORDER.indexOf(level);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {RISK_ORDER.map((r, i) => (
          <div
            key={r}
            className={`h-1.5 flex-1 rounded-full ${
              i <= activeIdx ? RISK_COLOR[level] : "bg-base-border"
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-silver/80">{label}</span>
    </div>
  );
}

// ---- score ring (SVG gauge) ------------------------------------------------
export function ScoreRing({ score }: { score: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;
  const color = score >= 60 ? "#22c55e" : score <= 40 ? "#ef4444" : "#f5c451";
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1e2c44" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        className="transition-[stroke-dasharray] duration-700"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90"
        transform="rotate(90 50 50)"
        fill={color}
        fontSize="22"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        {score}
      </text>
    </svg>
  );
}
