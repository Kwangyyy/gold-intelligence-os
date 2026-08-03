import { NextResponse } from "next/server";
import { getSignals, clearSignals, updateOutcome, type SignalOutcome } from "@/lib/signalLog";
import { resolvePending } from "@/lib/signalOutcome";
import { kvGet, kvSet } from "@/lib/kvStore";
import { getApiUser, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Settling walks 5,000 bars per open signal, so it does not happen on every
// read. Ten minutes is far finer than what is being measured.
const RESOLVE_KEY = "gios:signal-resolve-at";
const RESOLVE_EVERY = 10 * 60_000;

export async function GET(req: Request) {
  const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "100");

  // Reading the log settles what the price record can now answer for. Without
  // this the page had a win rate it could never fill in: every signal stayed
  // "pending" from the day it was written, so the panel read "—" and the log
  // was a list of predictions nobody had checked.
  try {
    const last = await kvGet<number>(RESOLVE_KEY);
    if (last == null || Date.now() - last > RESOLVE_EVERY) {
      await kvSet(RESOLVE_KEY, Date.now(), Math.ceil(RESOLVE_EVERY / 1000));
      await resolvePending();
    }
  } catch {
    // Settling is a bonus on a read. A failure here must not stop the log
    // itself being returned.
  }

  const signals = await getSignals(Math.min(limit, 200));
  return NextResponse.json(signals);
}

export async function PATCH(req: Request) {
  if (!(await getApiUser())) return unauthorized();
  const { id, outcome, pnlPips } = await req.json() as {
    id: string; outcome: SignalOutcome; pnlPips?: number;
  };
  if (!id || !outcome) return NextResponse.json({ error: "missing id or outcome" }, { status: 400 });
  const ok = await updateOutcome(id, outcome, pnlPips);
  return NextResponse.json({ ok });
}

export async function DELETE() {
  if (!(await getApiUser())) return unauthorized();
  await clearSignals();
  return NextResponse.json({ ok: true });
}
