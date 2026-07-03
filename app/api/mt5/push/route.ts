// MT5 Bridge — accepts POST from a MetaTrader 5 Expert Advisor.
// Auth is per-account: the EA sends its account token (created in the web app)
// in the Authorization header. The token maps to { email, accountId }, so each
// user's account data stays isolated.
//
// Example MQL5 (WebRequest):
//   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpAccountToken;

import { NextResponse } from "next/server";
import { resolveToken, setLiveData, clearLiveData, type MT5Account } from "@/lib/mt5Store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractToken(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
}

export async function POST(req: Request) {
  const token = extractToken(req);
  const owner = await resolveToken(token);
  if (!owner) {
    return NextResponse.json({ error: "Invalid account token" }, { status: 401 });
  }

  try {
    const body = await req.json() as Omit<MT5Account, "lastUpdate">;
    if (typeof body.balance !== "number" || typeof body.equity !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await setLiveData(owner.email, owner.accountId, body);
    return NextResponse.json({ ok: true, accountId: owner.accountId, ts: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const token = extractToken(req);
  const owner = await resolveToken(token);
  if (!owner) return NextResponse.json({ error: "Invalid account token" }, { status: 401 });
  await clearLiveData(owner.email, owner.accountId);
  return NextResponse.json({ ok: true });
}
