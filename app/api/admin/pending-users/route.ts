import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listPendingUsers,
  approvePendingUser,
  rejectPendingUser,
  countPendingUsers,
} from "@/lib/userTier";
import type { Tier } from "@/lib/tierConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return null;
  }
  return session;
}

export async function GET() {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [users, count] = await Promise.all([
    listPendingUsers(),
    countPendingUsers(),
  ]);
  return NextResponse.json({ users, count });
}

export async function POST(req: Request) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json() as { action: "approve" | "reject"; email: string; tier?: Tier };
  const { action, email, tier } = body;
  if (!email || !action) {
    return NextResponse.json({ error: "Missing email or action" }, { status: 400 });
  }
  if (action === "approve") {
    await approvePendingUser(email, tier ?? "free");
    return NextResponse.json({ ok: true, message: `${email} approved as ${tier ?? "free"}` });
  }
  if (action === "reject") {
    await rejectPendingUser(email);
    return NextResponse.json({ ok: true, message: `${email} rejected` });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
