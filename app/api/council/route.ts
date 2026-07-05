import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/marketSnapshot";
import { buildTechnicalScore } from "@/lib/technical";
import { buildMultiTimeframe } from "@/lib/timeframes";
import { buildSmc } from "@/lib/smc";
import { buildPortfolio } from "@/lib/portfolio";
import { runCouncil, type CouncilContext } from "@/lib/council";
import { planExecution } from "@/lib/execution";
import { recordCouncilVote } from "@/lib/councilJournal";

export const dynamic = "force-dynamic";

// PRD Module H / Module 7 — assemble the shared market context from the existing
// analytics modules, then run the 6-agent Vote Engine. Everything is fetched in
// parallel so the whole council resolves well under the PRD's 5s budget.
export async function GET() {
  try {
    const [snapshot, technical, mtf, smc] = await Promise.all([
      getMarketSnapshot(),
      buildTechnicalScore("H1"),
      buildMultiTimeframe(),
      buildSmc("H1"),
    ]);
    const portfolio = buildPortfolio(snapshot.price);

    const ctx: CouncilContext = { snapshot, technical, mtf, smc, portfolio };
    const result = runCouncil(ctx);

    // Execution gate: turn the decision into a concrete, risk-sized order plan.
    const plan = planExecution(result, {
      price: snapshot.price,
      atr: snapshot.atr,
      balance: portfolio.balance,
      riskPct: 1,
    });

    // Self-Learning: journal this vote (throttled) so per-agent accuracy can be
    // scored against future price. Non-fatal if it fails.
    void recordCouncilVote(result, snapshot.price).catch(() => {});

    return NextResponse.json({ ...result, plan }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Failed to convene the AI council" },
      { status: 502 }
    );
  }
}
