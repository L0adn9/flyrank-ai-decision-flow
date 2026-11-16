import { NextResponse } from "next/server";

import { inngest } from "@/inngest/client";
import { RUN_REQUESTED } from "@/inngest/functions";
import type { Workflow } from "@/lib/graph";
import { createRun, listRuns, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Start a run: validate, record it, and hand it to Inngest. */
export async function POST(req: Request) {
  let body: { input?: unknown; workflow?: Workflow };
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON: { input, workflow }");
  }
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input || input.length > 2000) return bad("input must be a non-empty string of at most 2000 characters");
  const wf = body.workflow;
  if (!wf || !Array.isArray(wf.nodes) || !Array.isArray(wf.edges) || wf.nodes.length === 0) {
    return bad("workflow must have nodes and edges");
  }
  if (!wf.nodes.some((n) => n.type === "decision")) return bad("workflow needs at least one decision node");

  const runId = crypto.randomUUID();
  createRun(runId, input, wf);
  try {
    await inngest.send({ name: RUN_REQUESTED, data: { runId, input, workflow: wf } });
  } catch (err) {
    const message = `Could not reach Inngest - is the dev server running (npm run inngest)? ${err instanceof Error ? err.message : ""}`;
    updateRun(runId, (run) => {
      run.status = "failed";
      run.error = message;
    });
    return bad(message, 503);
  }
  return NextResponse.json({ runId }, { status: 202 });
}

/** Execution history (most recent first, without the full workflow). */
export async function GET() {
  return NextResponse.json(
    listRuns().map(({ workflow: _workflow, ...summary }) => ({ ...summary, nodeCount: _workflow.nodes.length })),
  );
}
