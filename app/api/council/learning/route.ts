import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/marketSnapshot";
import { getCouncilVotes, matureAndEvaluate } from "@/lib/councilJournal";
import { computeAgentAccuracy } from "@/lib/councilLearning";

export const dynamic = "force-dynamic";

// PRD Module K / Module 11 — Self-Learning. Mature any journalled votes that
// have reached their evaluation horizon (scored against the current price), then
// return per-agent accuracy / reliability.
export async function GET() {
  try {
    const snapshot = await getMarketSnapshot();
    await matureAndEvaluate(snapshot.price);
    const entries = await getCouncilVotes();
    const stats = computeAgentAccuracy(entries);

    return NextResponse.json(
      { ...stats, price: snapshot.price, timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to compute council learning stats" }, { status: 502 });
  }
}
