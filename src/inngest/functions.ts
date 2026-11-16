import { inngest } from "./client";

import type { FlowNode, Workflow } from "@/lib/graph";
import { decide } from "@/lib/llm";
import { updateRun } from "@/lib/runs";

export const RUN_REQUESTED = "workflow/run.requested";
const MAX_STEPS = 25; // guards against cycles in a user-drawn graph

type RunEvent = { runId: string; input: string; workflow: Workflow };

/** The start node is the decision nothing points at (falls back to the first node). */
export function findStartNode(workflow: Workflow): FlowNode | undefined {
  const targets = new Set(workflow.edges.map((e) => e.target));
  return (
    workflow.nodes.find((n) => n.type === "decision" && !targets.has(n.id)) ??
    workflow.nodes.find((n) => !targets.has(n.id)) ??
    workflow.nodes[0]
  );
}

export const runWorkflow = inngest.createFunction(
  {
    id: "run-ai-decision-workflow",
    triggers: [{ event: RUN_REQUESTED }],
    retries: 2, // a failed node (timeout, non YES/NO answer) is retried twice before the run fails
    onFailure: async ({ event, error }) => {
      const { runId } = (event.data.event.data ?? {}) as RunEvent;
      updateRun(runId, (run) => {
        run.status = "failed";
        run.error = error.message;
        run.activeNodeId = undefined;
        run.finishedAt = new Date().toISOString();
        const last = run.steps.at(-1);
        if (last && !last.finishedAt) last.error = error.message;
      });
    },
  },
  async ({ event, step }) => {
    const { runId, input, workflow } = event.data as RunEvent;
    const byId = new Map(workflow.nodes.map((n) => [n.id, n]));

    await step.run("start", async () => {
      updateRun(runId, (run) => {
        run.status = "running";
      });
    });

    let node = findStartNode(workflow);
    for (let index = 0; node && index < MAX_STEPS; index++) {
      const current: FlowNode = node;

      if (current.type === "outcome") {
        await step.run(`outcome-${index}-${current.id}`, async () => {
          const now = new Date().toISOString();
          updateRun(runId, (run) => {
            run.steps.push({ index, nodeId: current.id, label: current.data.label, kind: "outcome", startedAt: now, finishedAt: now });
            run.outcome = current.data.label;
            run.status = "completed";
            run.activeNodeId = undefined;
            run.finishedAt = now;
          });
        });
        return { runId, outcome: current.data.label };
      }

      // Each decision node is its own Inngest step: retried on its own, memoized once done.
      const result = await step.run(`decide-${index}-${current.id}`, async () => {
        const startedAt = new Date().toISOString();
        const t0 = Date.now();
        updateRun(runId, (run) => {
          run.activeNodeId = current.id;
          const last = run.steps.at(-1);
          if (last?.nodeId === current.id && !last.finishedAt) {
            last.startedAt = startedAt; // a retry of the same step
            last.error = undefined;
          } else {
            run.steps.push({ index, nodeId: current.id, label: current.data.label, kind: "decision", question: current.data.prompt, startedAt });
          }
        });
        try {
          const decision = await decide(current.data.prompt, input);
          updateRun(runId, (run) => {
            const log = run.steps.at(-1)!;
            Object.assign(log, { ...decision, finishedAt: new Date().toISOString(), durationMs: Date.now() - t0 });
          });
          return decision;
        } catch (err) {
          updateRun(runId, (run) => {
            run.steps.at(-1)!.error = err instanceof Error ? err.message : String(err);
          });
          throw err;
        }
      });

      const branch = result.answer === "YES" ? "yes" : "no";
      const edge = workflow.edges.find((e) => e.source === current.id && e.data?.branch === branch);
      await step.run(`follow-${index}-${current.id}`, async () => {
        updateRun(runId, (run) => {
          if (edge) run.path.push(edge.id);
        });
      });
      if (!edge) {
        await step.run(`dead-end-${index}`, async () => {
          updateRun(runId, (run) => {
            run.status = "completed";
            run.outcome = `No ${result.answer} path from "${current.data.label}"`;
            run.activeNodeId = undefined;
            run.finishedAt = new Date().toISOString();
          });
        });
        return { runId, outcome: null };
      }
      node = byId.get(edge.target);
    }

    await step.run("too-many-steps", async () => {
      updateRun(runId, (run) => {
        run.status = "failed";
        run.error = `Stopped after ${MAX_STEPS} steps - does the graph have a cycle?`;
        run.activeNodeId = undefined;
        run.finishedAt = new Date().toISOString();
      });
    });
    return { runId, outcome: null };
  },
);

export const functions = [runWorkflow];
