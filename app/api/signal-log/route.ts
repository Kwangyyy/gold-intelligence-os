import { NextResponse } from "next/server";
import { getSignals, clearSignals } from "@/lib/signalLog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "100");
  const signals = await getSignals(Math.min(limit, 200));
  return NextResponse.json(signals);
}

export async function DELETE() {
  await clearSignals();
  return NextResponse.json({ ok: true });
}
