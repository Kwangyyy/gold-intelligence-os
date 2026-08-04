import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which build is answering.
 *
 * Exists for the audit. Its determinism check calls each route twice and
 * compares, which is sound until a deploy is rolling over — then the two calls
 * land on different builds, the bodies differ for a reason that is not a bug,
 * and the run reports failures against working routes. That has happened three
 * times, and a check that cries wolf is one people stop reading.
 *
 * With this the audit can tell the two apart: bodies that differ under one build
 * are a real finding, bodies that differ across a rollover are not.
 *
 * Nothing sensitive. The commit sha is already public in the repository, and no
 * environment values are echoed.
 */
export async function GET() {
  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      // Distinguishes two deploys of the same commit, which a redeploy produces.
      deployment: process.env.VERCEL_DEPLOYMENT_ID ?? "local",
      env: process.env.VERCEL_ENV ?? "development",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
