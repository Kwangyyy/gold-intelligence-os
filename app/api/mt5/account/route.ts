// Live snapshot for one of the logged-in user's accounts.
// GET ?account=<id> — defaults to the user's first account.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLiveData } from "@/lib/mt5Store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email   = session?.user?.email;
  if (!email) return NextResponse.json({ connected: false, reason: "unauthenticated" });

  const accountId = new URL(req.url).searchParams.get("account") ?? undefined;
  const result = await getUserLiveData(email, accountId);
  if (!result) return NextResponse.json({ connected: false, reason: "no_accounts" });
  if (!result.data) return NextResponse.json({ connected: false, reason: "no_data", accountId: result.meta.id, label: result.meta.label });

  return NextResponse.json({ connected: true, accountId: result.meta.id, label: result.meta.label, ...result.data });
}
