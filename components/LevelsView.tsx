"use client";

import { useI18n } from "@/lib/i18n";
import type { SRLevel, SupportResistance } from "@/lib/types";
import { Card } from "./shared";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function LevelRow({
  level,
  rank,
  isKey,
}: {
  level: SRLevel;
  rank: string;
  isKey: boolean;
}) {
  const { srSource, t } = useI18n();
  const isRes = level.side === "resistance";
  const tint = isRes ? "border-bear/30 bg-bear/5" : "border-bull/30 bg-bull/5";
  const badge = isRes ? "bg-bear/20 text-bear" : "bg-bull/20 text-bull";
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${tint} ${
        isKey ? "ring-1 ring-gold/60 shadow-goldglow" : ""
      }`}
    >
      <span className={`w-8 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-bold ${badge}`}>
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold text-silver">{fmt(level.price)}</span>
          {isKey && <span title="key level">⭐</span>}
          <span className="text-[11px] text-silver/40">
            {level.distancePct >= 0 ? "+" : ""}
            {level.distancePct}% {t("awayShort")}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {level.sources.map((s) => (
            <span key={s} className="rounded bg-base-panel px-1.5 py-0.5 text-[10px] text-silver/60">
              {srSource(s)}
            </span>
          ))}
        </div>
      </div>
      <div className="w-16 shrink-0">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-border">
          <div
            className={`h-full rounded-full ${isRes ? "bg-bear" : "bg-bull"}`}
            style={{ width: `${Math.max(8, level.strength)}%` }}
          />
        </div>
        <div className="mt-0.5 text-right text-[10px] text-silver/40">{level.strength}</div>
      </div>
    </div>
  );
}

export function LevelsLadder({ data }: { data: SupportResistance }) {
  const { t } = useI18n();
  const keyPrice = data.keyLevel?.price;

  // Render top→bottom: R3, R2, R1, price, S1, S2, S3.
  const resTopDown = [...data.resistances].reverse();
  const resRank = (i: number) => `R${data.resistances.length - i}`;

  return (
    <Card>
      <div className="space-y-2">
        {resTopDown.map((lvl, i) => (
          <LevelRow key={`r-${i}`} level={lvl} rank={resRank(i)} isKey={lvl.price === keyPrice} />
        ))}

        <div className="my-2 flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5 shadow-goldglow">
          <span className="w-8 shrink-0 text-center">🪙</span>
          <span className="text-xs uppercase tracking-wider text-gold/80">{t("currentPrice")}</span>
          <span className="ml-auto font-mono text-lg font-bold text-gold">{fmt(data.price)}</span>
        </div>

        {data.supports.map((lvl, i) => (
          <LevelRow key={`s-${i}`} level={lvl} rank={`S${i + 1}`} isKey={lvl.price === keyPrice} />
        ))}
      </div>
    </Card>
  );
}

export function KeyLevelCard({ data }: { data: SupportResistance }) {
  const { t, tb, srSource } = useI18n();
  if (!data.keyLevel) return null;
  return (
    <Card accent="gold">
      <div className="stat-label mb-2">⭐ {t("keyLevelTitle")}</div>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-2xl font-bold text-gold">{fmt(data.keyLevel.price)}</span>
        <span className={`text-sm font-semibold ${data.keyLevel.side === "resistance" ? "text-bear" : "text-bull"}`}>
          {data.keyLevel.side === "resistance" ? t("resistance") : t("support")}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {data.keyLevel.sources.map((s) => (
          <span key={s} className="rounded bg-base-panel px-1.5 py-0.5 text-[10px] text-silver/60">
            {srSource(s)}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-silver/75">{tb(data.keyLevel.reason)}</p>
    </Card>
  );
}
