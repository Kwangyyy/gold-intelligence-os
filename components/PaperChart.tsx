"use client";

import type { TradeSetup } from "@/lib/gemini";
import type { PaperTrade } from "@/lib/paper";

interface Candle { o: number; h: number; l: number; c: number; }

interface Props {
  candles: Candle[];
  price:   number;
  setup:   TradeSetup | null;
  openTrades?: PaperTrade[];
  loading?:    boolean;
}

const W  = 900; const H  = 360;
const MT = 26;  const MB = 26; const ML = 14; const MR = 106;
const CW = W - ML - MR; const CH = H - MT - MB;

export function PaperChart({ candles, price, setup, openTrades = [], loading }: Props) {
  const display = candles.slice(-60);

  // Collect all prices that need to be in range
  const allPx: number[] = [...display.flatMap(c => [c.h, c.l])];
  if (price > 0) allPx.push(price);
  if (setup && setup.direction !== "wait" && setup.entry > 0) {
    allPx.push(setup.entry, setup.sl, setup.tp1);
    if (setup.tp2) allPx.push(setup.tp2);
    if (setup.tp3) allPx.push(setup.tp3);
  }
  openTrades.forEach(t => {
    allPx.push(t.entryPrice);
    if (t.sl) allPx.push(t.sl);
    if (t.tp) allPx.push(t.tp);
  });

  const rawMin = allPx.length ? Math.min(...allPx) : 3000;
  const rawMax = allPx.length ? Math.max(...allPx) : 3100;
  const pad    = Math.max((rawMax - rawMin) * 0.12, 5);
  const min    = rawMin - pad;
  const max    = rawMax + pad;
  const range  = max - min || 1;

  const toY  = (p: number) => MT + CH - ((p - min) / range) * CH;
  const toX  = (i: number) => ML + (i + 0.5) * (CW / Math.max(display.length, 1));
  const cW   = CW / Math.max(display.length, 1);
  const bW   = Math.max(cW * 0.62, 2);

  // Price grid (5 levels)
  const gridLevels = Array.from({ length: 6 }, (_, i) => min + range * i / 5);

  // Helper: horizontal line + right label
  const Level = ({
    p, color, dash = false, stroke = 1.5, label, opacity = 1,
  }: {
    p: number; color: string; dash?: boolean;
    stroke?: number; label: string; opacity?: number;
  }) => {
    const y = toY(p);
    if (y < MT - 6 || y > MT + CH + 6) return null; // out of visible range
    return (
      <>
        <line
          x1={ML} x2={ML + CW} y1={y} y2={y}
          stroke={color} strokeWidth={stroke}
          strokeDasharray={dash ? "7,4" : undefined}
          opacity={opacity}
          clipPath="url(#pcClip)"
        />
        <text
          x={ML + CW + 6} y={y + 4}
          fontSize={10} fill={color}
          fontFamily="ui-monospace,monospace" fontWeight="700"
          opacity={opacity}
        >
          {label}
        </text>
      </>
    );
  };

  const hasSetup = setup && setup.direction !== "wait" && setup.entry > 0;

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ background: "linear-gradient(180deg, #05080f 0%, #070a15 100%)" }}
    >
      {/* TF badge */}
      <div className="absolute left-3 top-2 z-10 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
        style={{ background: "rgba(168,85,247,0.15)", color: "rgba(192,132,252,0.7)", border: "1px solid rgba(168,85,247,0.2)" }}>
        H1 · 60 bars
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: "rgba(5,8,15,0.7)" }}>
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            <span className="text-[10px] text-silver/40">AI กำลังวิเคราะห์…</span>
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 300 }}>
        <defs>
          <clipPath id="pcClip">
            <rect x={ML} y={MT} width={CW} height={CH} />
          </clipPath>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="transparent" />

        {/* Grid */}
        {gridLevels.map((gp, i) => (
          <g key={i}>
            <line x1={ML} x2={ML + CW} y1={toY(gp)} y2={toY(gp)}
              stroke="rgba(71,85,105,0.18)" strokeWidth={1} />
            <text x={ML - 2} y={toY(gp) + 3} fontSize={9} textAnchor="end"
              fill="rgba(148,163,184,0.25)" fontFamily="ui-monospace,monospace">
              {gp.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Shaded zones */}
        {hasSetup && (
          <g clipPath="url(#pcClip)">
            {/* Risk zone: SL ↔ Entry */}
            <rect
              x={ML}
              y={Math.min(toY(setup!.entry), toY(setup!.sl))}
              width={CW}
              height={Math.abs(toY(setup!.entry) - toY(setup!.sl))}
              fill="rgba(239,68,68,0.1)"
            />
            {/* Reward zone: Entry ↔ TP1 */}
            <rect
              x={ML}
              y={Math.min(toY(setup!.entry), toY(setup!.tp1))}
              width={CW}
              height={Math.abs(toY(setup!.entry) - toY(setup!.tp1))}
              fill="rgba(52,211,153,0.07)"
            />
          </g>
        )}

        {/* Candlesticks */}
        <g clipPath="url(#pcClip)">
          {display.map((c, i) => {
            const x    = toX(i);
            const bull = c.c >= c.o;
            const col  = bull ? "#26a69a" : "#ef5350";
            const yH   = toY(c.h); const yL = toY(c.l);
            const yO   = toY(c.o); const yC = toY(c.c);
            const top  = Math.min(yO, yC);
            const bodyH = Math.max(Math.abs(yO - yC), 1);
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={yH} y2={yL} stroke={col} strokeWidth={1} />
                <rect x={x - bW / 2} y={top} width={bW} height={bodyH} fill={col} />
              </g>
            );
          })}
        </g>

        {/* Open position entry lines */}
        {openTrades.map(t => {
          const col = t.type === "buy" ? "rgba(52,211,153,0.55)" : "rgba(248,113,113,0.55)";
          return (
            <line key={t.id}
              x1={ML} x2={ML + CW} y1={toY(t.entryPrice)} y2={toY(t.entryPrice)}
              stroke={col} strokeWidth={1.5} strokeDasharray="10,4"
              clipPath="url(#pcClip)"
            />
          );
        })}

        {/* Setup level lines */}
        {hasSetup && (
          <>
            {setup!.tp3 && (
              <Level p={setup!.tp3} color="#86efac" dash stroke={1} label={`TP3  ${setup!.tp3.toFixed(1)}`} opacity={0.65} />
            )}
            {setup!.tp2 && (
              <Level p={setup!.tp2} color="#6ee7b7" dash label={`TP2  ${setup!.tp2.toFixed(1)}`} opacity={0.8} />
            )}
            <Level p={setup!.tp1} color="#34d399" dash label={`TP1  ${setup!.tp1.toFixed(1)}`} />
            <Level p={setup!.entry} color="#f5c451" stroke={2} label={`ENTRY ${setup!.entry.toFixed(1)}`} />
            <Level p={setup!.sl}    color="#ef4444" dash label={`SL    ${setup!.sl.toFixed(1)}`} />
          </>
        )}

        {/* Current price line */}
        {price > 0 && (
          <>
            <line x1={ML} x2={ML + CW} y1={toY(price)} y2={toY(price)}
              stroke="rgba(255,255,255,0.55)" strokeWidth={1} strokeDasharray="3,3"
              clipPath="url(#pcClip)"
            />
            <rect x={ML + CW} y={toY(price) - 9} width={MR - 4} height={18} fill="rgba(255,255,255,0.1)" rx={3} />
            <text x={ML + CW + 6} y={toY(price) + 4} fontSize={10}
              fill="rgba(255,255,255,0.85)" fontFamily="ui-monospace,monospace" fontWeight="700">
              {price.toFixed(1)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
