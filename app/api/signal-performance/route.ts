import { NextResponse } from "next/server";
import { getSignals } from "@/lib/signalLog";
import { resolvePending, performanceOf } from "@/lib/signalOutcome";
import { kvGet, kvSet } from "@/lib/kvStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Settling walks 5,000 bars per open signal, so it is not done on every request.
// Ten minutes is far finer than the thing being measured: a trade that resolves
// in the meantime is reported ten minutes later, and no statistic here moves
// meaningfully in that window.
const RESOLVE_KEY = "gios:signal-resolve-at";
const RESOLVE_EVERY = 10 * 60_000;

export async function GET() {
  try {
    const last = await kvGet<number>(RESOLVE_KEY);
    let justResolved: Awaited<ReturnType<typeof resolvePending>> = [];
    if (last == null || Date.now() - last > RESOLVE_EVERY) {
      justResolved = await resolvePending();
      await kvSet(RESOLVE_KEY, Date.now(), Math.ceil(RESOLVE_EVERY / 1000));
    }

    const signals = await getSignals(200);
    const perf = performanceOf(signals);

    // How many settlements had the stop and the target inside one bar, where the
    // order they were touched in is unknowable and the stop was assumed. A high
    // rate here means the record is being decided by that assumption rather than
    // by the trades, and the reader should be told rather than left to find out.
    const ambiguous = justResolved.filter((r) => r.ambiguous).length;

    return NextResponse.json({
      ...perf,
      resolvedThisCall: justResolved.length,
      ambiguousThisCall: ambiguous,
      byOutcome: {
        tp1: signals.filter((s) => s.outcome === "tp1").length,
        tp2: signals.filter((s) => s.outcome === "tp2").length,
        sl: signals.filter((s) => s.outcome === "sl").length,
        be: signals.filter((s) => s.outcome === "be").length,
        pending: signals.filter((s) => s.outcome === "pending").length,
      },
      bySource: ["gemini", "rule"].map((src) => ({
        source: src,
        ...performanceOf(signals.filter((s) => s.source === src)),
      })),
      note:
        "Settled against 15-minute bars. Where a bar touched both the stop and the target, the stop is assumed — an OHLC bar cannot say which came first, and assuming the target is how a record flatters itself.",
      noteTh:
        "ตัดสินผลจากแท่ง 15 นาที ถ้าแท่งเดียวชนทั้ง SL และ TP จะนับเป็น SL เพราะแท่ง OHLC บอกไม่ได้ว่าอะไรมาก่อน และการเดาว่าเป็น TP คือวิธีที่สถิติหลอกตัวเอง",
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
