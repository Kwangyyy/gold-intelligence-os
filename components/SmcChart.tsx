"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SmcAnalysis, TimeframeCode } from "@/lib/types";

type OHLC = { o: number; h: number; l: number; c: number };

const TIMEFRAMES: TimeframeCode[] = ["M15", "M30", "H1", "H4", "D1", "W1"];
const MIN_VIEW = 15;
const W = 900; const H = 440;
const MT = 28; const MB = 22; const ML = 14; const MR = 78;
const CW = W - ML - MR; const CH = H - MT - MB;

// Render a text label with a dark backing rectangle
function Tag({
  x, y, text, textCol = "#e2e8f0", bg = "rgba(7,9,22,0.82)",
  w = 0, h = 14, anchor = "start", fontSize = 10.5, fontWeight = "600",
}: {
  x: number; y: number; text: string;
  textCol?: string; bg?: string; w?: number; h?: number;
  anchor?: "start" | "middle" | "end"; fontSize?: number; fontWeight?: string;
}) {
  const bw = w || text.length * fontSize * 0.62 + 8;
  const ox = anchor === "middle" ? -bw / 2 : anchor === "end" ? -bw : 0;
  return (
    <g>
      <rect x={x + ox} y={y - h * 0.65} width={bw} height={h} rx={2} fill={bg} />
      <text x={x + ox + 4} y={y} fontSize={fontSize} fill={textCol}
        fontFamily="ui-monospace,monospace" fontWeight={fontWeight}>
        {text}
      </text>
    </g>
  );
}

interface Props {
  data: SmcAnalysis;
  tf: TimeframeCode;
  onTfChange: (tf: TimeframeCode) => void;
  loading?: boolean;
}

export function SmcChart({ data, tf, onTfChange, loading = false }: Props) {
  const allCandles = (data.candles ?? []) as OHLC[];
  const total = allCandles.length;

  // ── zoom / pan state ──────────────────────────────────────────────────────
  const [viewCount, setViewCount] = useState(() => Math.min(60, total));
  const [panOffset, setPanOffset] = useState(0); // candles from right end
  const dragRef = useRef<{ startX: number; startPan: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Reset when data changes (new TF loaded)
  useEffect(() => {
    setViewCount(Math.min(60, allCandles.length));
    setPanOffset(0);
  }, [data.timestamp, allCandles.length]);

  // Visible slice
  const endIdx   = total - panOffset;
  const startIdx = Math.max(0, endIdx - viewCount);
  const candles  = useMemo(() => allCandles.slice(startIdx, endIdx), [startIdx, endIdx, allCandles]);
  const n        = candles.length;

  // ── zoom helpers ──────────────────────────────────────────────────────────
  const zoom = useCallback((factor: number) => {
    setViewCount(v => Math.max(MIN_VIEW, Math.min(total, Math.round(v * factor))));
  }, [total]);

  const fit = useCallback(() => {
    setViewCount(Math.min(60, total));
    setPanOffset(0);
  }, [total]);

  const pan = useCallback((dir: "left" | "right") => {
    const step = Math.max(1, Math.round(viewCount * 0.25));
    if (dir === "left") {
      setPanOffset(o => Math.min(total - Math.max(MIN_VIEW, viewCount), o + step));
    } else {
      setPanOffset(o => Math.max(0, o - step));
    }
  }, [viewCount, total]);

  // ── mouse wheel zoom ──────────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 0.78 : 1.28);
  }, [zoom]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── drag-to-pan ───────────────────────────────────────────────────────────
  const screenToSvgX = useCallback((clientX: number) => {
    const el = svgRef.current;
    if (!el) return 0;
    return ((clientX - el.getBoundingClientRect().left) / el.getBoundingClientRect().width) * W;
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: screenToSvgX(e.clientX), startPan: panOffset };
  }, [panOffset, screenToSvgX]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const svgX = screenToSvgX(e.clientX);
    const pxPerCandle = CW / Math.max(1, n);
    const deltaCandles = Math.round(-(svgX - dragRef.current.startX) / pxPerCandle);
    setPanOffset(Math.max(0, Math.min(total - Math.max(MIN_VIEW, n), dragRef.current.startPan + deltaCandles)));
  }, [n, total, screenToSvgX]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // ── price range ───────────────────────────────────────────────────────────
  const { lo, hi } = useMemo(() => {
    if (n === 0) return { lo: 0, hi: 1 };
    let lo = Math.min(...candles.map(c => c.l));
    let hi = Math.max(...candles.map(c => c.h));
    data.orderBlocks.forEach(ob => { lo = Math.min(lo, ob.bottom); hi = Math.max(hi, ob.top); });
    data.liquidity.forEach(lq => { lo = Math.min(lo, lq.price); hi = Math.max(hi, lq.price); });
    const pad = (hi - lo) * 0.08;
    return { lo: lo - pad, hi: hi + pad };
  }, [candles, data]);

  const span = hi - lo || 1;
  const px   = (i: number)     => ML + (i + 0.5) * (CW / n);
  const py   = (p: number)     => MT + ((hi - p) / span) * CH;
  const cw   = Math.max(2, (CW / n) * 0.7);

  // y-axis ticks
  const yTicks = useMemo(() => {
    const step = span / 6;
    return Array.from({ length: 7 }, (_, i) => lo + i * step);
  }, [lo, hi]);

  if (total < 5) return null;

  const IconBtn = ({ label, title, onClick }: { label: string; title: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      title={title}
      className="flex h-[24px] min-w-[24px] items-center justify-center rounded px-1.5 text-[11px] font-bold transition-all hover:text-silver"
      style={{ border: "1px solid rgba(148,163,184,0.18)", color: "rgba(148,163,184,0.55)" }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(160deg, #0d0a1c 0%, #07091b 100%)",
        border: "1px solid rgba(168,85,247,0.22)",
        boxShadow: "0 0 0 1px rgba(245,196,81,0.06) inset, 0 12px 40px rgba(0,0,0,0.6)",
      }}
    >
      {/* ── Header: title + TF selector + zoom controls ─────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid rgba(168,85,247,0.16)" }}
      >
        {/* Title */}
        <span className="text-xs font-bold" style={{ color: "rgba(245,196,81,0.9)" }}>
          📊 SMC Chart
        </span>

        {/* TF buttons */}
        <div
          className="flex gap-0.5 rounded-lg p-0.5"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(148,163,184,0.13)" }}
        >
          {TIMEFRAMES.map(code => (
            <button
              key={code}
              onClick={() => onTfChange(code)}
              className="rounded px-2.5 py-[3px] text-[11px] font-bold transition-all"
              style={tf === code ? {
                background: "linear-gradient(90deg, rgba(168,85,247,0.35), rgba(245,196,81,0.18))",
                color: "#f5c451",
                boxShadow: "0 0 0 1px rgba(245,196,81,0.35)",
              } : { color: "rgba(148,163,184,0.6)" }}
            >
              {code}
            </button>
          ))}
        </div>

        {/* Zoom/pan controls */}
        <div className="ml-auto flex items-center gap-1">
          <IconBtn label="◀" title="Pan left"  onClick={() => pan("left")} />
          <IconBtn label="+"  title="Zoom in"  onClick={() => zoom(0.75)} />
          <button
            onClick={fit}
            className="flex h-[24px] items-center justify-center rounded px-2 text-[10px] font-medium transition-all hover:text-silver"
            style={{ border: "1px solid rgba(148,163,184,0.18)", color: "rgba(148,163,184,0.55)" }}
          >
            fit
          </button>
          <IconBtn label="−"  title="Zoom out" onClick={() => zoom(1.33)} />
          <IconBtn label="▶" title="Pan right" onClick={() => pan("right")} />
        </div>

        {/* Bar count + hint */}
        <span className="hidden text-[10px] sm:block" style={{ color: "rgba(148,163,184,0.35)" }}>
          {n} bars · scroll=zoom · drag=pan
        </span>
      </div>

      {/* ── Chart area ───────────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ background: "rgba(7,9,26,0.72)", backdropFilter: "blur(3px)" }}
          >
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-2.5"
              style={{ border: "1px solid rgba(245,196,81,0.25)", background: "rgba(0,0,0,0.65)" }}
            >
              <span
                className="h-4 w-4 animate-spin rounded-full border-2"
                style={{ borderColor: "rgba(245,196,81,0.25)", borderTopColor: "#f5c451" }}
              />
              <span className="text-xs font-semibold" style={{ color: "rgba(245,196,81,0.8)" }}>
                Loading {tf}…
              </span>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full select-none"
          style={{ height: "clamp(260px, 48vw, 440px)", display: "block", cursor: dragRef.current ? "grabbing" : "crosshair" }}
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Chart clip */}
          <defs>
            <clipPath id="chartClip">
              <rect x={ML} y={MT} width={CW} height={CH} />
            </clipPath>
          </defs>

          {/* Chart border */}
          <rect x={ML} y={MT} width={CW} height={CH}
            fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth={1} />

          {/* ── Y-axis gridlines & labels ── */}
          {yTicks.map((t, i) => {
            const y = py(t);
            if (y < MT - 2 || y > MT + CH + 2) return null;
            return (
              <g key={`g${i}`}>
                <line x1={ML} y1={y} x2={ML + CW} y2={y}
                  stroke="rgba(148,163,184,0.07)" strokeWidth={1} />
                <rect x={ML + CW + 2} y={y - 9} width={MR - 4} height={16} rx={2}
                  fill="rgba(7,9,22,0.85)" />
                <text x={ML + CW + MR / 2} y={y + 4.5}
                  textAnchor="middle" fontSize={11.5} fontWeight="500"
                  fill="rgba(180,190,215,0.72)" fontFamily="ui-monospace,monospace">
                  {t.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* ── Premium/Discount zones ── */}
          {(() => {
            const { rangeHigh, rangeLow } = data.premiumDiscount;
            if (rangeHigh <= rangeLow) return null;
            const mid = (rangeHigh + rangeLow) / 2;
            const y1   = Math.max(MT, py(rangeHigh));
            const ymid = py(mid);
            const y2   = Math.min(MT + CH, py(rangeLow));
            return (
              <g clipPath="url(#chartClip)">
                <rect x={ML} y={y1}   width={CW} height={Math.max(0, ymid - y1)} fill="rgba(239,68,68,0.055)" />
                <rect x={ML} y={ymid} width={CW} height={Math.max(0, y2 - ymid)} fill="rgba(16,185,129,0.055)" />
                {/* EQ midline */}
                <line x1={ML} y1={ymid} x2={ML + CW} y2={ymid}
                  stroke="rgba(168,85,247,0.3)" strokeWidth={0.8} strokeDasharray="7 4" />
                <Tag x={ML + CW - 4} y={ymid + 1} text="EQ"
                  textCol="rgba(192,132,252,0.8)" bg="rgba(168,85,247,0.15)" anchor="end" fontSize={9.5} />
                {/* Zone labels */}
                <Tag x={ML + 6} y={y1 + 14} text="PREMIUM" textCol="rgba(248,113,113,0.7)"
                  bg="rgba(239,68,68,0.1)" fontSize={9} fontWeight="700" />
                <Tag x={ML + 6} y={y2 - 6} text="DISCOUNT" textCol="rgba(52,211,153,0.7)"
                  bg="rgba(16,185,129,0.1)" fontSize={9} fontWeight="700" />
              </g>
            );
          })()}

          {/* ── FVG zones ── */}
          <g clipPath="url(#chartClip)">
            {data.fvgs.map((fvg, i) => {
              const top = py(fvg.top);
              const bot = py(fvg.bottom);
              const h   = bot - top;
              if (h < 0.5) return null;
              const col = fvg.kind === "bullish" ? "rgba(56,189,248,0.13)" : "rgba(251,146,60,0.13)";
              return (
                <rect key={`fvg${i}`} x={ML} y={top} width={CW} height={h}
                  fill={col} opacity={fvg.filled ? 0.3 : 1} />
              );
            })}
          </g>

          {/* ── Order Blocks ── */}
          <g clipPath="url(#chartClip)">
            {data.orderBlocks.map((ob, i) => {
              const top  = py(ob.top);
              const bot  = py(ob.bottom);
              const h    = Math.max(2, bot - top);
              const bull = ob.kind === "bullish";
              const fill   = bull ? "rgba(16,185,129,0.16)"  : "rgba(239,68,68,0.16)";
              const stroke = bull ? "rgba(52,211,153,0.65)" : "rgba(248,113,113,0.65)";
              const tc     = bull ? "#34d399" : "#f87171";
              const midY   = top + h / 2;
              return (
                <g key={`ob${i}`} opacity={ob.mitigated ? 0.42 : 1}>
                  <rect x={ML} y={top} width={CW} height={h} fill={fill} />
                  <rect x={ML} y={top} width={CW} height={h} fill="none"
                    stroke={stroke} strokeWidth={1.1}
                    strokeDasharray={ob.mitigated ? "4 2" : undefined} />
                  {/* Inline label (only if zone tall enough) */}
                  {h > 16 && (
                    <Tag
                      x={ML + 8} y={midY + 1}
                      text={`${bull ? "▲" : "▼"} OB ${bull ? "Bullish" : "Bearish"}${ob.mitigated ? "  (mitigated)" : ""}`}
                      textCol={tc} bg="rgba(7,9,22,0.65)"
                      fontSize={11} fontWeight="700"
                    />
                  )}
                  {/* Right-edge pill */}
                  <rect x={ML + CW + 3} y={midY - 9} width={MR - 5} height={17} rx={3}
                    fill={bull ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)"} />
                  <text x={ML + CW + MR / 2} y={midY + 4.5}
                    textAnchor="middle" fontSize={11} fontWeight="800"
                    fill={tc} fontFamily="ui-monospace,monospace">
                    {ob.mitigated ? "✓" : bull ? "OB+" : "OB−"}
                  </text>
                </g>
              );
            })}
          </g>

          {/* ── Candlesticks ── */}
          <g clipPath="url(#chartClip)">
            {candles.map((c, i) => {
              const cx   = px(i);
              const bull = c.c >= c.o;
              const doji = Math.abs(c.c - c.o) / span < 0.0006;
              const col  = doji ? "#64748b" : bull ? "#22c55e" : "#ef4444";
              const bTop = py(Math.max(c.o, c.c));
              const bBot = py(Math.min(c.o, c.c));
              const bH   = Math.max(1, bBot - bTop);
              return (
                <g key={`c${i}`}>
                  <line x1={cx} y1={py(c.h)} x2={cx} y2={py(c.l)}
                    stroke={col} strokeWidth={Math.max(0.8, cw * 0.15)} opacity={0.6} />
                  <rect x={cx - cw / 2} y={bTop} width={cw} height={bH}
                    fill={col} opacity={bull ? 0.88 : 0.75} />
                </g>
              );
            })}
          </g>

          {/* ── Liquidity levels ── */}
          {data.liquidity.filter(lq => !lq.swept).slice(0, 6).map((lq, i) => {
            const y  = py(lq.price);
            if (y < MT - 6 || y > MT + CH + 6) return null;
            const buy = lq.side === "buyside";
            const col = buy ? "#f5c451" : "#f87171";
            return (
              <g key={`lq${i}`}>
                <line x1={ML} y1={y} x2={ML + CW} y2={y}
                  stroke={col} strokeWidth={1} strokeDasharray="5 3" opacity={0.65} />
                {/* Price + label on line */}
                <Tag x={ML + 7} y={y + 1}
                  text={`${buy ? "BSL" : "SSL"}  ${lq.price.toFixed(1)}`}
                  textCol={col} bg="rgba(7,9,22,0.78)"
                  fontSize={11} fontWeight="700" />
                {/* Right pill */}
                <rect x={ML + CW + 3} y={y - 9} width={MR - 5} height={17} rx={3}
                  fill={buy ? "rgba(245,196,81,0.15)" : "rgba(248,113,113,0.15)"} />
                <text x={ML + CW + MR / 2} y={y + 4.5} textAnchor="middle"
                  fontSize={11} fontWeight="800" fill={col} fontFamily="ui-monospace,monospace">
                  {buy ? "BSL" : "SSL"}
                </text>
              </g>
            );
          })}

          {/* ── BOS / CHoCH badges ── */}
          {data.events.slice(0, 4).map((ev, i) => {
            const y = py(ev.level);
            if (y < MT - 6 || y > MT + CH + 6) return null;
            const bull = ev.direction === "bullish";
            const col  = bull ? "#34d399" : "#f87171";
            const bgC  = bull ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)";
            const bx   = ML + CW * (0.52 + i * 0.11);
            return (
              <g key={`ev${i}`}>
                <line x1={ML} y1={y} x2={ML + CW} y2={y}
                  stroke={col} strokeWidth={0.7} strokeDasharray="3 3" opacity={0.35} />
                <rect x={bx - 20} y={y - 9} width={40} height={17} rx={4} fill={bgC} />
                <text x={bx} y={y + 4.5} textAnchor="middle"
                  fontSize={11} fontWeight="800" fill={col} fontFamily="ui-monospace,monospace">
                  {ev.type}
                </text>
              </g>
            );
          })}

          {/* ── Current price line ── */}
          {(() => {
            const y = py(data.price);
            if (y < MT - 6 || y > MT + CH + 6) return null;
            return (
              <g>
                <line x1={ML} y1={y} x2={ML + CW} y2={y}
                  stroke="#f5c451" strokeWidth={1.3} strokeDasharray="4 2.5" opacity={0.9} />
                {/* Price tag */}
                <rect x={ML + CW + 3} y={y - 10} width={MR - 5} height={19} rx={3}
                  fill="#f5c451"
                  style={{ filter: "drop-shadow(0 0 10px rgba(245,196,81,0.7))" }} />
                <text x={ML + CW + MR / 2} y={y + 5}
                  textAnchor="middle" fontSize={11.5} fontWeight="900"
                  fill="#0a0818" fontFamily="ui-monospace,monospace">
                  {data.price.toFixed(1)}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5"
        style={{ borderTop: "1px solid rgba(168,85,247,0.13)" }}
      >
        {[
          { color: "#22c55e", label: "OB Bullish",         rect: true  },
          { color: "#ef4444", label: "OB Bearish",         rect: true  },
          { color: "#38bdf8", label: "FVG",                rect: true  },
          { color: "#f5c451", label: "BSL (Buyside Liq.)", rect: false },
          { color: "#f87171", label: "SSL (Sellside Liq.)",rect: false },
          { color: "rgba(168,85,247,0.7)", label: "EQ midline", rect: false },
        ].map(({ color, label, rect }) => (
          <div key={label} className="flex items-center gap-1.5">
            {rect ? (
              <span className="h-2.5 w-4 rounded-sm" style={{ background: color, opacity: 0.72 }} />
            ) : (
              <svg width={18} height={10}>
                <line x1={0} y1={5} x2={18} y2={5} stroke={color} strokeWidth={1.5} strokeDasharray="4 2" />
              </svg>
            )}
            <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.52)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
