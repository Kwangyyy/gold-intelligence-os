"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// TradingView-style drawing tools for a Lightweight Charts pane.
//
// Lightweight Charts v4 has no drawing API beyond horizontal price lines, so the
// shapes live in an SVG layer sitting on top of the canvas. Anchors are stored in
// CHART space — a logical bar index plus a price — not pixels, so every shape
// stays welded to the same bar and level through zoom, pan and live refreshes.
// The layer re-projects on each range change; pixel-space anchors would drift the
// moment the chart moved.

export type DrawTool =
  | "cursor" | "trend" | "ray" | "hline" | "vline"
  | "rect" | "fib" | "fibext" | "fibfan" | "fibtime"
  | "measure" | "text" | "wave";

interface Anchor { logical: number; price: number }
interface Shape { id: string; tool: DrawTool; pts: Anchor[]; color: string; label?: string }

const TOOLS: { id: DrawTool; icon: string; label: string }[] = [
  { id: "cursor",  icon: "↖",  label: "เลือก / ลากกราฟ" },
  { id: "wave",    icon: "𝟝",  label: "ป้ายนับคลื่น — คลิกวางทีละจุด เลื่อนป้ายอัตโนมัติ" },
  { id: "trend",   icon: "╱",  label: "เส้นเทรนด์" },
  { id: "ray",     icon: "→",  label: "Ray (ยิงไปขวา)" },
  { id: "hline",   icon: "─",  label: "เส้นแนวนอน (แนวรับ/ต้าน)" },
  { id: "vline",   icon: "│",  label: "เส้นแนวตั้ง" },
  { id: "rect",    icon: "▭",  label: "สี่เหลี่ยม / โซน" },
  { id: "fib",     icon: "🌀", label: "Fib Retracement — 2 จุด (หาแนวรับย่อ)" },
  { id: "fibext",  icon: "⤢",  label: "Fib Extension — 3 จุด (หาเป้าคลื่นถัดไป)" },
  { id: "fibfan",  icon: "📐", label: "Fib Fan — แนวรับ/ต้านแบบเฉียงตามเวลา" },
  { id: "fibtime", icon: "⏱",  label: "Fib Time Zones — จุดกลับตัวตามเวลา" },
  { id: "measure", icon: "📏", label: "วัดระยะ (ราคา/%/แท่ง)" },
  { id: "text",    icon: "T",  label: "ข้อความ" },
];

const PALETTE = ["#f5c451", "#38bdf8", "#34d399", "#f87171", "#c084fc", "#e2e8f0"];
const FIBS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
// Beyond 100% — where a wave projects to once the retracement is done.
const FIB_EXT = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];
const FIB_FAN = [0.236, 0.382, 0.5, 0.618, 0.786];
const FIB_TIME = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const ONE_POINT: DrawTool[] = ["hline", "vline", "text", "wave"];
const THREE_POINT: DrawTool[] = ["fibext"];

// Wave label sets by degree, so a count can be marked at the right level.
const WAVE_SETS: { id: string; name: string; seq: string[] }[] = [
  { id: "primary",      name: "Primary ①",      seq: ["①","②","③","④","⑤","Ⓐ","Ⓑ","Ⓒ"] },
  { id: "intermediate", name: "Intermediate (1)", seq: ["(1)","(2)","(3)","(4)","(5)","(A)","(B)","(C)"] },
  { id: "minor",        name: "Minor 1",         seq: ["1","2","3","4","5","A","B","C"] },
  { id: "minute",       name: "Minute (i)",      seq: ["(i)","(ii)","(iii)","(iv)","(v)","(a)","(b)","(c)"] },
  { id: "minuette",     name: "Minuette i",      seq: ["i","ii","iii","iv","v","a","b","c"] },
];

export function ChartDrawTools({
  chart, series, height, storageKey, children,
}: {
  chart: any;            // IChartApi
  series: any;           // ISeriesApi — provides price ↔ y
  height: number;
  storageKey: string;    // drawings persist per symbol+timeframe
  children: React.ReactNode;  // the chart container — the SVG overlays it
}) {
  const [tool, setTool] = useState<DrawTool>("cursor");
  const [color, setColor] = useState(PALETTE[0]);
  // Counting a wave means placing 0-1-2-3-4-5-A-B-C in order, so the label
  // advances by itself after each click instead of making the user re-pick it.
  const [waveSet, setWaveSet] = useState(WAVE_SETS[2].id);
  const [waveIdx, setWaveIdx] = useState(0);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [, setRepaint] = useState(0);   // bumped on pan/zoom to re-project

  const wrapRef = useRef<HTMLDivElement>(null);
  const width = wrapRef.current?.clientWidth ?? 0;

  // ── persistence ───────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`draw:${storageKey}`);
      setShapes(raw ? JSON.parse(raw) : []);
    } catch { setShapes([]); }
    setDraft(null);
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(`draw:${storageKey}`, JSON.stringify(shapes)); } catch { /* quota */ }
  }, [shapes, storageKey]);

  // Re-project whenever the visible range moves, otherwise shapes would stay
  // pinned to stale pixels while the candles slid underneath them.
  useEffect(() => {
    if (!chart) return;
    const bump = () => setRepaint((n) => n + 1);
    const ts = chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(bump);
    const ro = new ResizeObserver(bump);
    if (wrapRef.current) ro.observe(wrapRef.current);
    bump();
    return () => { try { ts.unsubscribeVisibleLogicalRangeChange(bump); } catch { /* chart gone */ } ro.disconnect(); };
  }, [chart]);

  // ── chart-space ↔ pixel ───────────────────────────────────────────────────
  const toX = useCallback((logical: number): number | null => {
    const c = chart?.timeScale()?.logicalToCoordinate(logical as any);
    return typeof c === "number" ? c : null;
  }, [chart]);
  const toY = useCallback((price: number): number | null => {
    const c = series?.priceToCoordinate(price);
    return typeof c === "number" ? c : null;
  }, [series]);
  const fromPx = useCallback((x: number, y: number): Anchor | null => {
    const logical = chart?.timeScale()?.coordinateToLogical(x);
    const price = series?.coordinateToPrice(y);
    if (typeof logical !== "number" || typeof price !== "number") return null;
    return { logical, price };
  }, [chart, series]);

  // ── pointer handling ──────────────────────────────────────────────────────
  const localPt = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    if (tool === "cursor") return;
    const { x, y } = localPt(e);
    const a = fromPx(x, y);
    if (!a) return;

    if (ONE_POINT.includes(tool)) {
      let label: string | undefined;
      if (tool === "text") {
        label = prompt("ข้อความ:") ?? "";
        if (!label) return;
      }
      if (tool === "wave") {
        const seq = WAVE_SETS.find((w) => w.id === waveSet)?.seq ?? WAVE_SETS[2].seq;
        label = seq[waveIdx % seq.length];
      }
      setShapes((s) => [...s, { id: crypto.randomUUID(), tool, pts: [a], color, label }]);
      // Stay armed while counting so the next pivot is one click away.
      if (tool === "wave") setWaveIdx((i) => i + 1);
      else setTool("cursor");
      return;
    }

    // three-point tools (Fib extension): A → B → C
    if (THREE_POINT.includes(tool)) {
      if (!draft) { setDraft({ id: crypto.randomUUID(), tool, pts: [a, a], color }); return; }
      if (draft.pts.length === 2) { setDraft({ ...draft, pts: [draft.pts[0], draft.pts[1], a] }); return; }
      setShapes((s) => [...s, { ...draft, pts: [draft.pts[0], draft.pts[1], a] }]);
      setDraft(null);
      setTool("cursor");
      return;
    }

    // two-point tools: first click starts, second click commits
    if (!draft) { setDraft({ id: crypto.randomUUID(), tool, pts: [a, a], color }); return; }
    setShapes((s) => [...s, { ...draft, pts: [draft.pts[0], a] }]);
    setDraft(null);
    setTool("cursor");
  };

  const onMove = (e: React.PointerEvent) => {
    const { x, y } = localPt(e);
    setHover({ x, y });
    if (!draft) return;
    const a = fromPx(x, y);
    if (!a) return;
    // Drag the point currently being placed — the last one in the draft.
    setDraft({ ...draft, pts: [...draft.pts.slice(0, -1), a] });
  };

  // Escape cancels an in-progress shape; Delete clears the last one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDraft(null); setTool("cursor"); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (document.activeElement?.tagName === "INPUT") return;
        setShapes((s) => s.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── rendering ─────────────────────────────────────────────────────────────
  const renderShape = (sh: Shape, isDraft = false) => {
    const op = isDraft ? 0.75 : 1;
    const [p0, p1] = sh.pts;
    const x0 = toX(p0.logical), y0 = toY(p0.price);
    if (x0 == null || y0 == null) return null;

    if (sh.tool === "hline") return (
      <g key={sh.id} opacity={op}>
        <line x1={0} y1={y0} x2={width} y2={y0} stroke={sh.color} strokeWidth={1.5} />
        <text x={4} y={y0 - 4} fontSize={10} fill={sh.color}>{p0.price.toFixed(1)}</text>
      </g>
    );
    if (sh.tool === "vline") return (
      <line key={sh.id} opacity={op} x1={x0} y1={0} x2={x0} y2={height} stroke={sh.color} strokeWidth={1.5} strokeDasharray="4 3" />
    );
    if (sh.tool === "text") return (
      <text key={sh.id} opacity={op} x={x0} y={y0} fontSize={12} fontWeight="bold" fill={sh.color}
        style={{ paintOrder: "stroke", stroke: "#0f1828", strokeWidth: 3 }}>{sh.label}</text>
    );

    if (sh.tool === "wave") return (
      <g key={sh.id} opacity={op}>
        <circle cx={x0} cy={y0} r={3} fill={sh.color} />
        <text x={x0} y={y0 - 8} textAnchor="middle" fontSize={13} fontWeight="bold" fill={sh.color}
          style={{ paintOrder: "stroke", stroke: "#0f1828", strokeWidth: 3.5 }}>{sh.label}</text>
      </g>
    );

    if (!p1) return null;
    const x1 = toX(p1.logical), y1 = toY(p1.price);
    if (x1 == null || y1 == null) return null;

    if (sh.tool === "trend") return (
      <line key={sh.id} opacity={op} x1={x0} y1={y0} x2={x1} y2={y1} stroke={sh.color} strokeWidth={2} />
    );

    if (sh.tool === "ray") {
      // extend past the right edge along the same slope
      const dx = x1 - x0, dy = y1 - y0;
      const k = dx === 0 ? 0 : (width - x0) / dx;
      const ex = dx === 0 ? x1 : width, ey = dx === 0 ? height : y0 + dy * k;
      return <line key={sh.id} opacity={op} x1={x0} y1={y0} x2={ex} y2={ey} stroke={sh.color} strokeWidth={2} />;
    }

    if (sh.tool === "rect") return (
      <rect key={sh.id} opacity={op} x={Math.min(x0, x1)} y={Math.min(y0, y1)}
        width={Math.abs(x1 - x0)} height={Math.abs(y1 - y0)}
        fill={`${sh.color}1f`} stroke={sh.color} strokeWidth={1.5} />
    );

    if (sh.tool === "fib") {
      const hi = Math.max(p0.price, p1.price), lo = Math.min(p0.price, p1.price);
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      return (
        <g key={sh.id} opacity={op}>
          {FIBS.map((f) => {
            const price = hi - (hi - lo) * f;
            const y = toY(price);
            if (y == null) return null;
            return (
              <g key={f}>
                <line x1={xa} y1={y} x2={width} y2={y} stroke={sh.color} strokeWidth={f === 0.618 ? 1.6 : 1}
                  strokeDasharray={f === 0 || f === 1 ? undefined : "5 3"} opacity={f === 0.618 ? 1 : 0.65} />
                <text x={xa + 3} y={y - 3} fontSize={9} fill={sh.color}>
                  {(f * 100).toFixed(1)}% · {price.toFixed(1)}
                </text>
              </g>
            );
          })}
          <line x1={xa} y1={Math.min(y0, y1)} x2={xb} y2={Math.max(y0, y1)} stroke={sh.color} strokeWidth={1} opacity={0.4} />
        </g>
      );
    }

    if (sh.tool === "fibfan") {
      // Rays from the origin through fib fractions of the move — sloping
      // support/resistance that advances with time.
      return (
        <g key={sh.id} opacity={op}>
          <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={sh.color} strokeWidth={1.5} />
          {FIB_FAN.map((f) => {
            const ty = y0 + (y1 - y0) * f;
            const dx = x1 - x0, dy = ty - y0;
            const k = dx === 0 ? 0 : (width - x0) / dx;
            const ex = dx === 0 ? x1 : width, ey = dx === 0 ? height : y0 + dy * k;
            return (
              <g key={f}>
                <line x1={x0} y1={y0} x2={ex} y2={ey} stroke={sh.color} strokeWidth={1} opacity={0.6} strokeDasharray="4 3" />
                <text x={Math.min(ex - 4, width - 4)} y={ey - 3} textAnchor="end" fontSize={8} fill={sh.color} opacity={0.8}>
                  {(f * 100).toFixed(1)}%
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    if (sh.tool === "fibtime") {
      // Vertical markers at Fibonacci bar counts from the anchor — where a turn
      // is due in time rather than in price.
      const barsPerStep = p1.logical - p0.logical;
      if (!barsPerStep) return null;
      return (
        <g key={sh.id} opacity={op}>
          {FIB_TIME.map((n) => {
            const x = toX(p0.logical + barsPerStep * n);
            if (x == null || x < 0 || x > width) return null;
            return (
              <g key={n}>
                <line x1={x} y1={0} x2={x} y2={height} stroke={sh.color} strokeWidth={1} opacity={0.5} strokeDasharray="3 4" />
                <text x={x + 2} y={12} fontSize={8} fill={sh.color} opacity={0.85}>{n}</text>
              </g>
            );
          })}
        </g>
      );
    }

    if (sh.tool === "fibext") {
      // A→B is the impulse, C the retracement it launches from; levels project
      // beyond C, which is how a wave target is read.
      const p2 = sh.pts[2];
      if (!p2) {
        return <line key={sh.id} opacity={op} x1={x0} y1={y0} x2={x1} y2={y1} stroke={sh.color} strokeWidth={2} />;
      }
      const xC = toX(p2.logical), yC = toY(p2.price);
      if (xC == null || yC == null) return null;
      const move = p1.price - p0.price;
      return (
        <g key={sh.id} opacity={op}>
          <polyline points={`${x0},${y0} ${x1},${y1} ${xC},${yC}`} fill="none" stroke={sh.color} strokeWidth={1.5} opacity={0.7} />
          {FIB_EXT.map((f) => {
            const price = p2.price + move * f;
            const y = toY(price);
            if (y == null) return null;
            const key3 = f === 1 || f === 1.618;
            return (
              <g key={f}>
                <line x1={Math.min(xC, x0)} y1={y} x2={width} y2={y} stroke={sh.color}
                  strokeWidth={key3 ? 1.6 : 1} opacity={key3 ? 1 : 0.6} strokeDasharray={f === 0 ? undefined : "5 3"} />
                <text x={Math.min(xC, x0) + 3} y={y - 3} fontSize={9} fill={sh.color}>
                  {(f * 100).toFixed(1)}% · {price.toFixed(1)}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    if (sh.tool === "measure") {
      const dPrice = p1.price - p0.price;
      const dPct = (dPrice / p0.price) * 100;
      const bars = Math.round(p1.logical - p0.logical);
      const up = dPrice >= 0;
      const c = up ? "#34d399" : "#f87171";
      const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 8;
      return (
        <g key={sh.id} opacity={op}>
          <rect x={Math.min(x0, x1)} y={Math.min(y0, y1)} width={Math.abs(x1 - x0)} height={Math.abs(y1 - y0)}
            fill={`${c}1a`} stroke={c} strokeWidth={1} strokeDasharray="4 3" />
          <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={c} strokeWidth={1.5} />
          <text x={mx} y={my} textAnchor="middle" fontSize={11} fontWeight="bold" fill={c}
            style={{ paintOrder: "stroke", stroke: "#0f1828", strokeWidth: 3.5 }}>
            {up ? "+" : ""}{dPrice.toFixed(1)} ({up ? "+" : ""}{dPct.toFixed(2)}%) · {bars} แท่ง
          </text>
        </g>
      );
    }
    return null;
  };

  const armed = tool !== "cursor";

  return (
    <div className="relative flex gap-1.5">
      {/* ── left toolbar ── */}
      <div className="flex flex-col gap-1 shrink-0 rounded-xl p-1"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {TOOLS.map((t) => {
          const on = tool === t.id;
          return (
            <button key={t.id} title={t.label} onClick={() => { setTool(t.id); setDraft(null); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[13px] transition-all"
              style={on
                ? { background: "rgba(56,189,248,0.2)", color: "#38bdf8", boxShadow: "inset 0 0 0 1px rgba(56,189,248,0.5)" }
                : { color: "rgba(175,185,215,0.55)" }}>
              {t.icon}
            </button>
          );
        })}

        <div className="my-0.5 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Wave-count controls, only while that tool is active */}
        {tool === "wave" && (
          <div className="flex flex-col gap-1 px-0.5">
            <select value={waveSet} onChange={(e) => { setWaveSet(e.target.value); setWaveIdx(0); }}
              title="ดีกรีของคลื่นที่กำลังนับ"
              className="rounded text-[9px] outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", width: 52 }}>
              {WAVE_SETS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <div className="flex items-center gap-0.5">
              <button title="ป้ายก่อนหน้า" onClick={() => setWaveIdx((i) => Math.max(0, i - 1))}
                className="flex-1 rounded text-[10px]" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.6)" }}>‹</button>
              <span className="text-[11px] font-bold text-center" style={{ color, minWidth: 22 }}>
                {(WAVE_SETS.find((w) => w.id === waveSet)?.seq ?? [])[waveIdx % 8]}
              </span>
              <button title="ป้ายถัดไป" onClick={() => setWaveIdx((i) => i + 1)}
                className="flex-1 rounded text-[10px]" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.6)" }}>›</button>
            </div>
            <button title="เริ่มนับใหม่จากคลื่นแรก" onClick={() => setWaveIdx(0)}
              className="rounded text-[8px] py-0.5" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.5)" }}>รีเซ็ต</button>
          </div>
        )}

        {tool === "wave" && <div className="my-0.5 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />}

        {/* colour swatches */}
        <div className="grid grid-cols-2 gap-0.5 px-0.5">
          {PALETTE.map((c) => (
            <button key={c} title="สี" onClick={() => setColor(c)}
              className="h-3 w-3 rounded-full"
              style={{ background: c, outline: color === c ? "2px solid rgba(255,255,255,0.65)" : "none", outlineOffset: 1 }} />
          ))}
        </div>

        <div className="my-0.5 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        <button title="ย้อนกลับ 1 ชิ้น" onClick={() => setShapes((s) => s.slice(0, -1))}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px]"
          style={{ color: "rgba(175,185,215,0.55)" }}>↶</button>
        <button title="ลบทั้งหมด" onClick={() => { setShapes([]); setDraft(null); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px]"
          style={{ color: "rgba(248,113,113,0.8)" }}>🗑</button>
      </div>

      {/* ── chart + drawing surface stacked on top of it ── */}
      <div ref={wrapRef} className="relative flex-1 min-w-0">
        {children}
        <svg
          width="100%" height={height}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          style={{
            position: "absolute", left: 0, top: 0, right: 0,
            // Only intercept the mouse while a tool is armed, so the chart keeps
            // its own zoom/pan when the cursor tool is selected.
            pointerEvents: armed ? "auto" : "none",
            cursor: armed ? "crosshair" : "default",
            zIndex: 3,
          }}
        >
          {shapes.map((s) => renderShape(s))}
          {draft && renderShape(draft, true)}
          {armed && hover && (
            <g opacity={0.35}>
              <line x1={hover.x} y1={0} x2={hover.x} y2={height} stroke="#38bdf8" strokeWidth={1} strokeDasharray="3 3" />
              <line x1={0} y1={hover.y} x2="100%" y2={hover.y} stroke="#38bdf8" strokeWidth={1} strokeDasharray="3 3" />
            </g>
          )}
        </svg>

        {armed && (
          <div className="absolute left-2 top-2 rounded-lg px-2 py-1 text-[9px] font-bold"
            style={{ background: "rgba(6,9,26,0.8)", color: "#38bdf8", zIndex: 4, pointerEvents: "none" }}>
            {TOOLS.find((t) => t.id === tool)?.label}
            {!ONE_POINT.includes(tool) && (draft ? " · คลิกจุดที่ 2" : " · คลิกจุดเริ่ม")} · Esc ยกเลิก
          </div>
        )}
      </div>
    </div>
  );
}
