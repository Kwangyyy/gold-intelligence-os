import { NextResponse } from "next/server";
import { analyzeJournalTrades, type JournalTradeSummary } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const summary: JournalTradeSummary = await req.json();
    if (!summary || typeof summary.totalClosed !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (summary.totalClosed < 3) {
      return NextResponse.json({ error: "ต้องมีอย่างน้อย 3 trades" }, { status: 400 });
    }
    const analysis = await analyzeJournalTrades(summary);
    return NextResponse.json(analysis);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
