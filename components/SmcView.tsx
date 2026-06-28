"use client";

import { useI18n } from "@/lib/i18n";
import type { SmcAnalysis } from "@/lib/types";
import { Card } from "./shared";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function biasColor(b: string) {
  return b === "bullish" ? "text-bull" : b === "bearish" ? "text-bear" : "text-silver/60";
}
function dirColor(b: string) {
  return b === "bullish" ? "text-bull" : "text-bear";
}

export function SmcBiasCard({ data }: { data: SmcAnalysis }) {
  const { t, tb } = useI18n();
  const pd = data.premiumDiscount;
  const zoneLabel = pd.zone === "premium" ? t("premium") : pd.zone === "discount" ? t("discount") : t("equilibrium");
  return (
    <Card accent="neon">
      <div className="stat-label mb-2">{t("smcBias")}</div>
      <div className={`text-2xl font-bold ${biasColor(data.bias)}`}>
        {data.bias === "bullish" ? t("bullishZone") : data.bias === "bearish" ? t("bearishZone") : t("equilibrium")}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-silver/70">{tb(data.reason)}</p>

      {/* Premium / Discount meter */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-silver/50">
          <span>{t("premiumDiscount")}</span>
          <span className="font-semibold text-silver/80">
            {zoneLabel} · {pd.position}%
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full">
          <div className="absolute inset-0 flex">
            <div className="h-full w-[45%] bg-bull/30" />
            <div className="h-full w-[10%] bg-silver/20" />
            <div className="h-full w-[45%] bg-bear/30" />
          </div>
          <div
            className="absolute top-[-2px] h-[18px] w-[3px] -translate-x-1/2 rounded-full bg-gold shadow-goldglow"
            style={{ left: `${pd.position}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-silver/40">
          <span>{t("discount")} {fmt(pd.rangeLow)}</span>
          <span>{t("premium")} {fmt(pd.rangeHigh)}</span>
        </div>
      </div>
    </Card>
  );
}

function KeyStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-base-border/60 bg-base-panel/50 p-3">
      <div className="stat-label">{label}</div>
      <div className={`mt-1 font-mono text-base font-semibold ${tone ?? "text-silver"}`}>{value}</div>
      {sub && <div className="text-[11px] text-silver/40">{sub}</div>}
    </div>
  );
}

export function SmcKeyLevels({ data }: { data: SmcAnalysis }) {
  const { t } = useI18n();
  const ob = data.keyOrderBlock;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KeyStat
        label={t("keyOrderBlock")}
        value={ob ? `${fmt(ob.bottom)}–${fmt(ob.top)}` : t("noneYet")}
        sub={ob ? (ob.kind === "bullish" ? t("bullishZone") : t("bearishZone")) : undefined}
        tone={ob ? dirColor(ob.kind) : "text-silver/50"}
      />
      <KeyStat
        label={t("liquidityTarget")}
        value={data.liquidityTarget ? fmt(data.liquidityTarget.price) : t("noneYet")}
        sub={data.liquidityTarget ? (data.liquidityTarget.side === "buyside" ? t("buyside") : t("sellside")) : undefined}
        tone="text-neon"
      />
      <KeyStat
        label={t("invalidationZone")}
        value={data.invalidation != null ? fmt(data.invalidation) : t("noneYet")}
        tone="text-bear"
      />
      <KeyStat
        label={t("possibleSweep")}
        value={data.possibleSweep ? fmt(data.possibleSweep.price) : t("noneYet")}
        sub={data.possibleSweep ? (data.possibleSweep.side === "buyside" ? t("buyside") : t("sellside")) : undefined}
        tone="text-warn"
      />
    </div>
  );
}

function Tag({ text, tone }: { text: string; tone: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{text}</span>;
}

export function SmcLists({ data }: { data: SmcAnalysis }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Order Blocks */}
      <Card className="p-0">
        <Head title={t("orderBlocks")} />
        <List
          rows={data.orderBlocks.map((o) => ({
            left: `${fmt(o.bottom)}–${fmt(o.top)}`,
            leftTone: dirColor(o.kind),
            mid: o.kind === "bullish" ? t("bullishZone") : t("bearishZone"),
            tag: o.mitigated ? { text: t("mitigated"), tone: "bg-silver/10 text-silver/50" } : { text: t("active"), tone: "bg-bull/15 text-bull" },
          }))}
          empty={t("noneYet")}
        />
      </Card>

      {/* FVGs */}
      <Card className="p-0">
        <Head title={t("fairValueGaps")} />
        <List
          rows={data.fvgs.map((g) => ({
            left: `${fmt(g.bottom)}–${fmt(g.top)}`,
            leftTone: dirColor(g.kind),
            mid: g.kind === "bullish" ? t("bullishZone") : t("bearishZone"),
            tag: g.filled ? { text: t("filled"), tone: "bg-silver/10 text-silver/50" } : { text: t("open_"), tone: "bg-neon/15 text-neon" },
          }))}
          empty={t("noneYet")}
        />
      </Card>

      {/* Liquidity */}
      <Card className="p-0">
        <Head title={t("liquidityPools")} />
        <List
          rows={data.liquidity.map((l) => ({
            left: fmt(l.price),
            leftTone: l.side === "buyside" ? "text-bull" : "text-bear",
            mid: l.side === "buyside" ? t("buyside") : t("sellside"),
            tag: l.swept ? { text: t("swept"), tone: "bg-silver/10 text-silver/50" } : { text: t("resting"), tone: "bg-warn/15 text-warn" },
          }))}
          empty={t("noneYet")}
        />
      </Card>

      {/* Structure events */}
      <Card className="p-0">
        <Head title={t("structureEvents")} />
        <List
          rows={data.events.map((e) => ({
            left: fmt(e.level),
            leftTone: dirColor(e.direction),
            mid: e.direction === "bullish" ? t("bullishZone") : t("bearishZone"),
            tag: { text: e.type, tone: e.type === "CHoCH" ? "bg-warn/15 text-warn" : "bg-neon/15 text-neon" },
          }))}
          empty={t("noneYet")}
        />
      </Card>
    </div>
  );
}

function Head({ title }: { title: string }) {
  return (
    <div className="border-b border-base-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gold/80">
      {title}
    </div>
  );
}

function List({
  rows,
  empty,
}: {
  rows: { left: string; leftTone: string; mid: string; tag: { text: string; tone: string } }[];
  empty: string;
}) {
  if (!rows.length) return <div className="px-4 py-6 text-center text-xs text-silver/40">{empty}</div>;
  return (
    <ul className="divide-y divide-base-border/40">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className={`font-mono font-semibold ${r.leftTone}`}>{r.left}</span>
          <span className="ml-auto text-xs text-silver/50">{r.mid}</span>
          <Tag text={r.tag.text} tone={r.tag.tone} />
        </li>
      ))}
    </ul>
  );
}
