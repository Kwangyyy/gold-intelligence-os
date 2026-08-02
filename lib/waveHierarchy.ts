// Wave counting that starts from the largest degree and works down.
//
// The problem this replaces: every timeframe was counted in isolation. The
// route pulled that timeframe's bars, ran a zigzag, asked "are the last eight
// legs an impulse?", and then stamped a degree name on the answer from a lookup
// table — 1d meant Primary, 1w meant Cycle. Nothing checked that the Primary
// count sat inside the Cycle count, because nothing had computed a Cycle count
// to sit inside. The degree was a label, not a finding, and the large-degree
// read was wrong as a result.
//
// It also read only the tail. Eight legs of a 1000-bar daily series is a few
// months; the structure that decides whether those months are a wave 4 or a
// wave B is years long and was never looked at.
//
// What happens instead: the dominant structure is found across the whole
// history at a coarse threshold, the leg containing the present is identified,
// and the next degree down is counted *only inside that leg's window*. Repeat
// until the requested timeframe. A count is then a position in a lineage —
// "wave (3) of ③ of I" — and it can be checked, because each level states the
// window it was counted in.

export interface Swing {
  idx: number;      // index into the series it came from
  ts: number;       // unix seconds
  price: number;
  type: "H" | "L";
}

export interface Leg {
  from: Swing;
  to: Swing;
  up: boolean;
  move: number;     // signed price change
  absPct: number;   // size as % of the starting price
  bars: number;
}

export type StructureKind = "impulse" | "terminal" | "zigzag" | "flat" | "unclear";

export interface DegreeLevel {
  degree: string;             // Supercycle, Cycle, Primary, …
  glyphs: string[];           // label per leg, in this degree's notation
  structure: StructureKind;
  legs: Leg[];
  currentLeg: number;         // 1-based index of the leg containing "now"
  currentLabel: string;       // e.g. "③" — where price is at this degree
  patternComplete: boolean;   // the structure finished; price is past its last leg
  window: { fromTs: number; toTs: number };  // the parent leg this was counted in
  rules: { rule: string; passed: boolean; detail: string }[];
  confidence: number;         // 0-100
}

// Standard Elliott notation, largest to smallest. The ladder is walked by
// nesting depth, not by timeframe — a count three levels inside Supercycle is
// Primary whether it was drawn on a daily or a four-hour chart.
export const DEGREE_LADDER = [
  { name: "Supercycle",  impulse: ["(I)", "(II)", "(III)", "(IV)", "(V)"], corrective: ["(a)", "(b)", "(c)"] },
  { name: "Cycle",       impulse: ["I", "II", "III", "IV", "V"],           corrective: ["a", "b", "c"] },
  { name: "Primary",     impulse: ["①", "②", "③", "④", "⑤"],               corrective: ["Ⓐ", "Ⓑ", "Ⓒ"] },
  { name: "Intermediate",impulse: ["(1)", "(2)", "(3)", "(4)", "(5)"],     corrective: ["(A)", "(B)", "(C)"] },
  { name: "Minor",       impulse: ["1", "2", "3", "4", "5"],               corrective: ["A", "B", "C"] },
  { name: "Minute",      impulse: ["(i)", "(ii)", "(iii)", "(iv)", "(v)"], corrective: ["(a)", "(b)", "(c)"] },
  { name: "Minuette",    impulse: ["i", "ii", "iii", "iv", "v"],           corrective: ["a", "b", "c"] },
  { name: "Subminuette", impulse: ["¹", "²", "³", "⁴", "⁵"],               corrective: ["ᵃ", "ᵇ", "ᶜ"] },
] as const;

/** Percentage-deviation zigzag over candle extremes. */
export function zigzag(
  hi: number[], lo: number[], ts: number[], pct: number,
): Swing[] {
  const out: Swing[] = [];
  if (hi.length < 3) return out;

  let dir: "up" | "down" | null = null;
  let pivotIdx = 0;
  let pivotPrice = lo[0];

  for (let i = 1; i < hi.length; i++) {
    if (dir !== "down") {
      // tracking a high
      if (hi[i] >= pivotPrice) { pivotIdx = i; pivotPrice = hi[i]; }
      else if ((pivotPrice - lo[i]) / pivotPrice * 100 >= pct) {
        out.push({ idx: pivotIdx, ts: ts[pivotIdx], price: pivotPrice, type: "H" });
        dir = "down"; pivotIdx = i; pivotPrice = lo[i];
        continue;
      }
    }
    if (dir !== "up") {
      if (lo[i] <= pivotPrice) { pivotIdx = i; pivotPrice = lo[i]; }
      else if ((hi[i] - pivotPrice) / pivotPrice * 100 >= pct) {
        out.push({ idx: pivotIdx, ts: ts[pivotIdx], price: pivotPrice, type: "L" });
        dir = "up"; pivotIdx = i; pivotPrice = hi[i];
        continue;
      }
    }
    if (dir === null) dir = hi[i] > hi[0] ? "up" : "down";
  }
  // The swing in progress is a real pivot for counting purposes: the current
  // wave has a start even if its end has not printed yet.
  out.push({ idx: pivotIdx, ts: ts[pivotIdx], price: pivotPrice, type: dir === "up" ? "H" : "L" });
  return out;
}

export function toLegs(sw: Swing[]): Leg[] {
  const legs: Leg[] = [];
  for (let i = 1; i < sw.length; i++) {
    const from = sw[i - 1], to = sw[i];
    const move = to.price - from.price;
    legs.push({
      from, to, up: move > 0, move,
      absPct: Math.abs(move) / from.price * 100,
      bars: to.idx - from.idx,
    });
  }
  return legs;
}

/**
 * Pick the deviation that yields a countable number of legs for this window.
 *
 * A fixed percentage cannot work across degrees: 3.5% finds a handful of swings
 * in a decade of monthly bars and hundreds in a week of hourly ones. The engine
 * used a per-timeframe constant, which is why a "Supercycle" count on 1M was
 * built from 22 pivots while a "Primary" count on 1d had 97 — the larger degree
 * had *less* structure behind it than the smaller one.
 *
 * Searching for the threshold that produces 5-13 legs targets the range where a
 * five-wave impulse or a three-wave correction can actually be identified.
 */
export function fitDeviation(
  hi: number[], lo: number[], ts: number[],
  targetMin = 5, targetMax = 13,
): { swings: Swing[]; deviation: number } {
  const span = Math.max(...hi) / Math.min(...lo.filter((x) => x > 0));
  // Search coarse→fine; the first threshold inside the target range wins, so a
  // window is always described by the largest swings that still form a pattern.
  const start = Math.max(1, (span - 1) * 100 / 4);
  let best: { swings: Swing[]; deviation: number } | null = null;

  for (let d = start; d >= 0.15; d *= 0.82) {
    const sw = zigzag(hi, lo, ts, d);
    const legs = sw.length - 1;
    if (legs >= targetMin && legs <= targetMax) return { swings: sw, deviation: +d.toFixed(3) };
    if (legs > targetMax) { // overshot: keep the last acceptable, else this one
      return best ?? { swings: sw, deviation: +d.toFixed(3) };
    }
    if (legs >= 2) best = { swings: sw, deviation: +d.toFixed(3) };
  }
  return best ?? { swings: zigzag(hi, lo, ts, 1), deviation: 1 };
}

// ── structure classification ────────────────────────────────────────────────
// Rules are checked and *reported*, pass or fail, rather than being used to
// silently accept a count. The old engine returned a structure with no way to
// see which rule carried it, so a wrong large-degree read could not be argued
// with.

interface Check { rule: string; passed: boolean; detail: string }

const pctOf = (leg: Leg) => leg.absPct;
const retrace = (a: Leg, b: Leg) => (Math.abs(b.move) / Math.abs(a.move)) * 100;

/** Five alternating legs judged as impulse, terminal (diagonal), or neither. */
function classifyFive(w: Leg[]): { kind: StructureKind; checks: Check[]; score: number } | null {
  if (w.length !== 5) return null;
  // Must alternate direction, and 1/3/5 must share a direction.
  for (let i = 1; i < 5; i++) if (w[i].up === w[i - 1].up) return null;

  const [w1, w2, w3, w4, w5] = w;
  const checks: Check[] = [];

  // Wave 2 may not retrace all of wave 1. Elliott's one inviolable rule.
  const r2 = retrace(w1, w2);
  checks.push({
    rule: "Wave 2 retraces < 100% of wave 1",
    passed: r2 < 100,
    detail: `wave 2 retraced ${r2.toFixed(0)}% of wave 1`,
  });

  // Wave 3 is never the shortest of the three impulse legs.
  const shortest = Math.min(pctOf(w1), pctOf(w3), pctOf(w5));
  checks.push({
    rule: "Wave 3 is not the shortest impulse leg",
    passed: pctOf(w3) > shortest || pctOf(w3) === pctOf(w1) || pctOf(w3) === pctOf(w5),
    detail: `1: ${pctOf(w1).toFixed(1)}% · 3: ${pctOf(w3).toFixed(1)}% · 5: ${pctOf(w5).toFixed(1)}%`,
  });

  // Wave 4 entering wave 1's territory means this is a diagonal, not an impulse.
  const w1End = w1.to.price, w4End = w4.to.price;
  const overlap = w1.up ? w4End < w1End : w4End > w1End;
  checks.push({
    rule: "Wave 4 does not overlap wave 1 (impulse vs diagonal)",
    passed: !overlap,
    detail: overlap
      ? `wave 4 ended ${w4End.toFixed(0)} inside wave 1's range — diagonal/terminal`
      : `wave 4 ended ${w4End.toFixed(0)}, clear of wave 1 at ${w1End.toFixed(0)}`,
  });

  // NeoWave's alternation: 2 and 4 should differ in depth or in duration. Two
  // corrections of the same shape and length usually mean the count is wrong.
  const r4 = retrace(w3, w4);
  const depthDiff = Math.abs(r2 - r4);
  const timeRatio = Math.max(w2.bars, w4.bars) / Math.max(1, Math.min(w2.bars, w4.bars));
  const alternates = depthDiff >= 15 || timeRatio >= 1.6;
  checks.push({
    rule: "Rule of Alternation — waves 2 and 4 differ",
    passed: alternates,
    detail: `depth ${r2.toFixed(0)}% vs ${r4.toFixed(0)}%, duration ${w2.bars} vs ${w4.bars} bars`,
  });

  // Neely's Rule of Neutrality: wave 3 should be the extended leg, or at least
  // not dwarfed. A "3" smaller than both neighbours is a red flag even when it
  // is not literally the shortest.
  const extended =
    pctOf(w3) >= pctOf(w1) * 1.3 ? "wave 3" :
    pctOf(w5) >= pctOf(w3) * 1.3 ? "wave 5" :
    pctOf(w1) >= pctOf(w3) * 1.3 ? "wave 1" : "none clear";
  checks.push({
    rule: "One impulse leg is extended",
    passed: extended !== "none clear",
    detail: `extended: ${extended}`,
  });

  const hard = checks[0].passed && checks[1].passed;   // the two inviolable ones
  if (!hard) return null;

  const passed = checks.filter((c) => c.passed).length;
  return {
    kind: overlap ? "terminal" : "impulse",
    checks,
    score: Math.round((passed / checks.length) * 100),
  };
}

/** Three alternating legs judged as zigzag or flat. */
function classifyThree(w: Leg[]): { kind: StructureKind; checks: Check[]; score: number } | null {
  if (w.length !== 3) return null;
  for (let i = 1; i < 3; i++) if (w[i].up === w[i - 1].up) return null;

  const [a, b, c] = w;
  const rb = retrace(a, b);
  const rc = retrace(a, c);

  // A B-wave has an upper bound. The first version accepted anything at or
  // above 61.8% as a flat, and the daily chart duly reported a Primary "flat"
  // whose B travelled 329% of A. Nothing that overshoots A by three times is a
  // B-wave; the pivots are mislabelled, and saying so is better than naming the
  // result. Expanded flats reach about 138%, which is the limit here.
  if (rb > 138) return null;
  // Below 38.2% the middle leg is noise inside a single directional move, not a
  // correction with structure.
  if (rb < 38.2) return null;

  const checks: Check[] = [];
  const isFlat = rb >= 78.6;
  checks.push({
    rule: isFlat ? "Flat — wave B retraces 78.6-138% of A" : "Zigzag — wave B retraces 38.2-78.6% of A",
    passed: true,
    detail: `B retraced ${rb.toFixed(0)}% of A`,
  });
  checks.push({
    rule: "Wave C travels at least 61.8% of A",
    passed: rc >= 61.8,
    detail: `C is ${rc.toFixed(0)}% of A`,
  });
  // Similarity & Balance: A and C of a healthy correction are comparable in
  // time. A C-wave a fraction of A's duration usually means C is unfinished.
  const tRatio = Math.max(a.bars, c.bars) / Math.max(1, Math.min(a.bars, c.bars));
  checks.push({
    rule: "Similarity & Balance — A and C comparable in time",
    passed: tRatio <= 3,
    detail: `A ${a.bars} bars vs C ${c.bars} bars (${tRatio.toFixed(1)}×)`,
  });

  const passed = checks.filter((c2) => c2.passed).length;
  return {
    kind: isFlat ? "flat" : "zigzag",
    checks,
    score: Math.round((passed / checks.length) * 100),
  };
}

/**
 * Read one window as the best structure it supports, preferring the largest
 * complete pattern. Five legs beat three: a window that contains a whole
 * impulse should be read as an impulse, not as its last three legs.
 */
export function classifyWindow(legs: Leg[]): {
  kind: StructureKind; checks: Check[]; score: number; used: Leg[]; offset: number;
} {
  // A leg spanning a single bar is a bar, not a wave. The daily chart reported
  // a Primary-degree correction whose wave A lasted one monthly bar — the count
  // was anchored on a series with too few pivots to carry that degree.
  const substantial = (slice: Leg[]) => slice.every((l) => l.bars >= 2);

  // Try the most recent complete 5, then the most recent complete 3.
  for (let take = 5; take >= 3; take -= 2) {
    for (let end = legs.length; end >= take; end--) {
      const slice = legs.slice(end - take, end);
      if (!substantial(slice)) continue;
      const res = take === 5 ? classifyFive(slice) : classifyThree(slice);
      if (res) return { ...res, used: slice, offset: end - take };
    }
  }
  return { kind: "unclear", checks: [], score: 0, used: legs, offset: 0 };
}

// ── hierarchical count ──────────────────────────────────────────────────────

export interface Series { t: number[]; h: number[]; l: number[]; c: number[] }

/**
 * Count from the largest degree inward.
 *
 * Level 0 is read across the entire series supplied — that is the point. The
 * previous engine's largest degree came from the last eight legs of a monthly
 * chart, so "Supercycle" described a few years of swings and could contradict
 * the "Primary" count sitting underneath it. Here each level is counted *only
 * inside the leg its parent says we are currently in*, so a child count cannot
 * disagree with its parent: it is a subdivision of it.
 *
 * Stops when the window no longer holds enough bars to say anything, so depth
 * is decided by the data rather than requested.
 */
/**
 * Which degree a window of this length can honestly be called.
 *
 * Degrees are defined by duration, not by nesting depth. Counting 2.7 years of
 * daily bars and calling the top level "Supercycle" — as this did on the first
 * run — is wrong by roughly an order of magnitude: a Supercycle spans decades.
 * The available history decides where on the ladder a count starts.
 *
 * Spans are the conventional Elliott ranges, taken at their lower bound so a
 * window is never promoted beyond what it can support.
 */
export function startDegreeFor(spanYears: number): number {
  if (spanYears >= 40) return 0;   // Supercycle
  if (spanYears >= 8) return 1;    // Cycle
  if (spanYears >= 1) return 2;    // Primary
  if (spanYears >= 0.25) return 3; // Intermediate — a quarter and up
  if (spanYears >= 0.06) return 4; // Minor — three weeks and up
  if (spanYears >= 0.012) return 5;// Minute — a few days
  return 6;                        // Minuette and below
}

export function countHierarchy(series: Series, maxDepth = 4): DegreeLevel[] {
  const levels: DegreeLevel[] = [];
  let lo = 0, hi = series.t.length;

  const spanYears = (series.t[series.t.length - 1] - series.t[0]) / (365.25 * 86400);
  const base = startDegreeFor(spanYears);

  for (let d0 = 0; d0 < maxDepth && base + d0 < DEGREE_LADDER.length; d0++) {
    const depth = base + d0;
    const win = {
      t: series.t.slice(lo, hi), h: series.h.slice(lo, hi), l: series.l.slice(lo, hi),
    };
    // Below ~25 bars a "five wave structure" is noise, not a degree.
    if (win.t.length < 25) break;

    const { swings } = fitDeviation(win.h, win.l, win.t);
    const legs = toLegs(swings);
    if (legs.length < 3) break;

    const cls = classifyWindow(legs);
    if (cls.kind === "unclear") break;

    const ladder = DEGREE_LADDER[depth];
    const names = cls.kind === "impulse" || cls.kind === "terminal"
      ? ladder.impulse : ladder.corrective;

    // Label only the legs the pattern actually used; legs before it belong to
    // whatever came earlier and are not part of this count.
    const glyphs = legs.map((_, i) => {
      const k = i - cls.offset;
      return k >= 0 && k < names.length ? names[k] : "";
    });

    // Which leg is still running, and where it sits inside the pattern. A
    // pattern that finished before the last leg means price is no longer inside
    // it — the first version reported "wave V, leg 6 of 5", which cannot happen.
    const currentIdx = legs.length - 1;
    const posInPattern = currentIdx - cls.offset + 1;
    const complete = posInPattern > names.length;
    const currentLeg = complete ? names.length : posInPattern;
    const currentLabel = complete
      ? `after ${names[names.length - 1]}`
      : glyphs[currentIdx] || names[Math.max(0, currentLeg - 1)];

    levels.push({
      degree: ladder.name,
      glyphs,
      structure: cls.kind,
      legs,
      currentLeg,
      currentLabel,
      patternComplete: complete,
      window: { fromTs: win.t[0], toTs: win.t[win.t.length - 1] },
      rules: cls.checks,
      confidence: cls.score,
    });

    // Descend into the leg in progress. Its start is where the next degree's
    // count begins — this is the constraint the old engine never applied.
    const last = legs[currentIdx];
    const nextLo = lo + last.from.idx;
    if (nextLo >= hi - 25) break;
    lo = nextLo;
  }

  return levels;
}

/** "wave (3) of ③ of I of (III)" — the full lineage, largest first. */
export function lineageOf(levels: DegreeLevel[]): string {
  if (!levels.length) return "";
  return levels
    .map((l) => l.currentLabel)
    .filter(Boolean)
    .reverse()
    .join(" of ");
}

/**
 * A structure and a wave label must describe the same thing. The old payload
 * could report `structure: "impulse"` alongside "Wave C of the correction" —
 * C waves belong to corrections — because the two came from different branches
 * and nothing reconciled them.
 */
export function describe(level: DegreeLevel): { en: string; th: string } {
  const n = level.currentLeg;
  const corrective = level.structure === "zigzag" || level.structure === "flat";

  if (level.patternComplete) {
    return corrective
      ? {
          en: `The ${level.structure} correction has completed; price is beyond wave C and the larger trend should be resuming`,
          th: `correction แบบ ${level.structure} จบแล้ว ราคาเลยคลื่น C ไปแล้ว เทรนด์ใหญ่ควรกลับมาทำงาน`,
        }
      : {
          en: `The five-wave structure has completed; what follows is a correction of the whole move, not part of it`,
          th: `โครงสร้าง 5 คลื่นจบแล้ว สิ่งที่ตามมาคือการปรับฐานของทั้งขา ไม่ใช่ส่วนหนึ่งของมัน`,
        };
  }

  if (corrective) {
    const which = ["A", "B", "C"][Math.min(n - 1, 2)] ?? "C";
    const kind = level.structure === "flat" ? "flat" : "zigzag";
    const en = which === "C"
      ? `Wave C of a ${kind} correction — the last leg; the larger trend resumes after it`
      : `Wave ${which} of a ${kind} correction — the correction is still building`;
    const th = which === "C"
      ? `คลื่น C ของ correction แบบ ${kind} — ขาสุดท้าย จบแล้วเทรนด์ใหญ่มีโอกาสกลับมา`
      : `คลื่น ${which} ของ correction แบบ ${kind} — correction ยังไม่จบ`;
    return { en, th };
  }

  const diagonal = level.structure === "terminal";
  const tail = diagonal ? " (diagonal — wave 4 overlapped wave 1, so this ends the larger move)" : "";
  const tailTh = diagonal ? " (diagonal — คลื่น 4 ทับคลื่น 1 มักเป็นการจบขาใหญ่)" : "";
  const en =
    n <= 1 ? `Wave 1 — a new impulse is starting${tail}` :
    n === 2 ? `Wave 2 — correcting wave 1; the trend has not failed${tail}` :
    n === 3 ? `Wave 3 — usually the strongest leg${tail}` :
    n === 4 ? `Wave 4 — correcting wave 3; wave 5 would follow${tail}` :
    `Wave 5 — the final leg of this impulse${tail}`;
  const th =
    n <= 1 ? `คลื่น 1 — เริ่ม impulse ใหม่${tailTh}` :
    n === 2 ? `คลื่น 2 — พักตัวจากคลื่น 1 เทรนด์ยังไม่เสีย${tailTh}` :
    n === 3 ? `คลื่น 3 — มักเป็นขาที่แรงที่สุด${tailTh}` :
    n === 4 ? `คลื่น 4 — พักตัวจากคลื่น 3 ต่อไปคือคลื่น 5${tailTh}` :
    `คลื่น 5 — ขาสุดท้ายของ impulse นี้${tailTh}`;
  return { en, th };
}

/**
 * Count across several resolutions so the large degree is established once.
 *
 * Counting each timeframe's own history separately still let them disagree:
 * weekly bars reach back 5.9 years and read a completed Primary five, while
 * daily bars reach back 3.8 and read that same move as *still inside* wave ⑤.
 * Both counts were internally valid and they contradicted each other on screen,
 * which is the complaint this whole rewrite exists to answer.
 *
 * The large degree can only be settled by the longest history available, so
 * that is where every count now starts. Finer series are brought in only when
 * the window narrows past what the coarse bars can resolve — a two-month window
 * holds eight weekly bars and two hundred four-hour ones — and they continue
 * the same lineage rather than starting a new one.
 *
 * `sources` must be ordered coarsest first.
 */
export function countMultiSource(sources: Series[], maxDepth = 5): DegreeLevel[] {
  const usable = sources.filter((s) => s.t.length >= 25);
  if (!usable.length) return [];

  const levels: DegreeLevel[] = [];
  let src = 0;
  let fromTs = usable[0].t[0];
  const toTs = usable[usable.length - 1].t[usable[usable.length - 1].t.length - 1];

  const spanYears = (toTs - fromTs) / (365.25 * 86400);
  const base = startDegreeFor(spanYears);

  for (let d0 = 0; d0 < maxDepth && base + d0 < DEGREE_LADDER.length; d0++) {
    // Move to a finer series once the current one cannot resolve the window.
    while (src < usable.length - 1) {
      const bars = usable[src].t.filter((t) => t >= fromTs && t <= toTs).length;
      if (bars >= 40) break;
      src++;
    }

    const s = usable[src];
    const keep: number[] = [];
    for (let i = 0; i < s.t.length; i++) if (s.t[i] >= fromTs && s.t[i] <= toTs) keep.push(i);
    if (keep.length < 25) break;

    const win = {
      t: keep.map((i) => s.t[i]), h: keep.map((i) => s.h[i]), l: keep.map((i) => s.l[i]),
    };
    const { swings } = fitDeviation(win.h, win.l, win.t);
    const legs = toLegs(swings);
    if (legs.length < 3) break;

    const cls = classifyWindow(legs);
    if (cls.kind === "unclear") break;

    const ladder = DEGREE_LADDER[base + d0];
    const names = cls.kind === "impulse" || cls.kind === "terminal" ? ladder.impulse : ladder.corrective;
    const glyphs = legs.map((_, i) => {
      const k = i - cls.offset;
      return k >= 0 && k < names.length ? names[k] : "";
    });

    const currentIdx = legs.length - 1;
    const posInPattern = currentIdx - cls.offset + 1;
    const complete = posInPattern > names.length;
    const currentLeg = complete ? names.length : posInPattern;

    levels.push({
      degree: ladder.name,
      glyphs,
      structure: cls.kind,
      legs,
      currentLeg,
      currentLabel: complete ? `after ${names[names.length - 1]}` : glyphs[currentIdx] || names[Math.max(0, currentLeg - 1)],
      patternComplete: complete,
      // The end is the analysis end, not this source's last bar. A coarse bar is
      // stamped with its opening time, so counting Primary on monthly data
      // reported it finishing on 1 July while Intermediate — counted on daily —
      // ran to 31 July. The child appeared to escape its parent when in fact
      // both run to now; only the reported boundary was wrong.
      window: { fromTs: win.t[0], toTs },
      rules: cls.checks,
      confidence: cls.score,
    });

    // Descend into the leg in progress, in time rather than in array indices —
    // the next level may read a different series.
    const nextFrom = legs[currentIdx].from.ts;
    if (nextFrom <= fromTs || toTs - nextFrom < 3 * 86400) break;
    fromTs = nextFrom;
  }

  return levels;
}

// ── option positioning as corroboration ─────────────────────────────────────
// Wave counting says where a move should end; option open interest says where
// dealers are positioned for it to end. They are independent, so agreement is
// worth something and disagreement is worth knowing about.
//
// This does not change the count. A wave count that moves because of option
// data is no longer a wave count.

export interface OiContext {
  callWall: number;   // heaviest call OI above spot — hedging resistance
  putWall: number;    // heaviest put OI below spot — hedging support
  gammaFlip: number;  // above it dealer hedging damps moves, below it amplifies
  maxPain: number;
}

export interface WaveCorroboration {
  agrees: boolean | null;      // null when there is nothing to compare
  note: string;
  noteTh: string;
  nearestLevel: number | null;
  distancePct: number | null;
}

/**
 * Does option positioning sit where the current wave would be expected to end?
 *
 * A fifth wave or a C wave is a terminal leg: it should run into resistance,
 * and the heaviest option wall in its direction is a candidate for where. A
 * third wave is the opposite — it usually cuts through walls, so a wall close
 * ahead is a caution rather than a confirmation.
 */
export function corroborateWithOi(
  level: DegreeLevel | undefined,
  spot: number,
  oi: OiContext | null,
): WaveCorroboration {
  if (!level || !oi || !spot) {
    return { agrees: null, note: "No option chain to compare against.", noteTh: "ไม่มีข้อมูล option ให้เทียบ", nearestLevel: null, distancePct: null };
  }

  const rising = level.legs[level.legs.length - 1]?.up ?? true;
  const target = rising ? oi.callWall : oi.putWall;
  if (!target) {
    return { agrees: null, note: "No wall in the direction of the current leg.", noteTh: "ไม่มีกำแพง OI ในทิศของคลื่นปัจจุบัน", nearestLevel: null, distancePct: null };
  }

  const distancePct = ((target - spot) / spot) * 100;
  const near = Math.abs(distancePct) <= 3;
  const terminal =
    level.patternComplete ||
    level.currentLeg === 5 ||
    (level.currentLeg === 3 && (level.structure === "zigzag" || level.structure === "flat"));

  if (terminal) {
    return {
      agrees: near,
      nearestLevel: target,
      distancePct: +distancePct.toFixed(2),
      note: near
        ? `The count has this as a terminal leg, and the heaviest ${rising ? "call" : "put"} OI sits ${Math.abs(distancePct).toFixed(1)}% away at ${target.toLocaleString()} — option positioning agrees the move is near exhaustion.`
        : `The count has this as a terminal leg, but the nearest ${rising ? "call" : "put"} wall is ${Math.abs(distancePct).toFixed(1)}% away at ${target.toLocaleString()} — dealers are not positioned for it to end here.`,
      noteTh: near
        ? `การนับบอกว่าเป็นขาสุดท้าย และกำแพง ${rising ? "call" : "put"} หนาสุดอยู่ห่าง ${Math.abs(distancePct).toFixed(1)}% ที่ ${target.toLocaleString()} — ตำแหน่ง option สอดคล้องว่าใกล้หมดแรง`
        : `การนับบอกว่าเป็นขาสุดท้าย แต่กำแพงใกล้สุดอยู่ห่างถึง ${Math.abs(distancePct).toFixed(1)}% ที่ ${target.toLocaleString()} — dealer ยังไม่ได้วางตัวว่าจะจบตรงนี้`,
    };
  }

  return {
    agrees: !near,
    nearestLevel: target,
    distancePct: +distancePct.toFixed(2),
    note: near
      ? `This is a mid-pattern leg, which normally cuts through resistance, but a heavy ${rising ? "call" : "put"} wall sits only ${Math.abs(distancePct).toFixed(1)}% ahead at ${target.toLocaleString()} — expect it to slow there.`
      : `Mid-pattern leg with clear air to the nearest wall at ${target.toLocaleString()}, ${Math.abs(distancePct).toFixed(1)}% away.`,
    noteTh: near
      ? `เป็นคลื่นกลางโครงสร้าง ปกติจะทะลุแนวต้าน แต่มีกำแพง ${rising ? "call" : "put"} หนาอยู่ข้างหน้าแค่ ${Math.abs(distancePct).toFixed(1)}% ที่ ${target.toLocaleString()} — น่าจะชะลอตรงนั้น`
      : `เป็นคลื่นกลางโครงสร้าง และโล่งถึงกำแพงถัดไปที่ ${target.toLocaleString()} ห่าง ${Math.abs(distancePct).toFixed(1)}%`,
  };
}
