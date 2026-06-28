// MT5 Bridge — accepts POST from a MetaTrader 5 Expert Advisor.
// The EA should send account + position data every 10–30 seconds.
//
// Example MQL5 snippet (WebRequest):
//   string url = "http://YOUR_HOST:3100/api/mt5/push";
//   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + ApiKey;
//   string body = "{\"balance\":"+DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2)+...}";
//   int res = WebRequest("POST", url, headers, 5000, body, result, resultHeaders);

import { NextResponse } from "next/server";
import { setMT5Data, clearMT5Data, type MT5Account } from "@/lib/mt5Store";

export const dynamic = "force-dynamic";

const API_KEY = process.env.MT5_API_KEY || "mt5-bridge-key";

export async function POST(req: Request) {
  // Auth
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (token !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as Omit<MT5Account, "lastUpdate">;

    if (typeof body.balance !== "number" || typeof body.equity !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    setMT5Data(body);
    return NextResponse.json({ ok: true, ts: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (token !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  clearMT5Data();
  return NextResponse.json({ ok: true });
}
