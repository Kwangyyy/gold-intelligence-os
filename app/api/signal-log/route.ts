import { NextResponse } from "next/server";
import { getSignals, clearSignals, updateOutcome, type SignalOutcome } from "@/lib/signalLog";
import { getApiUser, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "100");
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
