import { NextResponse } from "next/server";
import { broadcastSignal } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await broadcastSignal({
    symbol: "XAUUSD",
    direction: "buy",
    confidence: 78,
    entry: 3342.50,
    sl: 3328.00,
    tp1: 3368.00,
    tp2: 3390.00,
    rr1: 1.8,
    setupType: "SMC Break of Structure",
    biasTh: "ทดสอบระบบ broadcast",
    reasoningTh: ["นี่คือ test signal จาก Gold Intelligence OS", "ไม่ใช่สัญญาณจริง", "ระบบ broadcast ทำงานปกติ"],
    risksTh: ["⚠️ TEST SIGNAL — ไม่ใช่คำแนะนำการลงทุน"],
  });
  return NextResponse.json(result);
}
