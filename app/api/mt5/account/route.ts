import { NextResponse } from "next/server";
import { getMT5Data } from "@/lib/mt5Store";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMT5Data();
  if (!data) return NextResponse.json({ connected: false });
  return NextResponse.json({ connected: true, ...data });
}
