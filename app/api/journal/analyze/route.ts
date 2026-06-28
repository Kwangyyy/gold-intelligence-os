import { NextResponse } from "next/server";
import { analyzeJournalTrades, type JournalTradeSummary } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const summary: JournalTradeSummary = await req.json();
    if (!summary || summary.totalClosed < 1) {
      return NextResponse.json({ error: "Not enough data" }, { status: 400 });
    }
    const result = await analyzeJournalTrades(summary);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
