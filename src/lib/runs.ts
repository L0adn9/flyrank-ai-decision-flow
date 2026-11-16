import type { Answer } from "./llm";
import type { Workflow } from "./graph";

export type StepLog = {
  index: number;
  nodeId: string;
  label: string;
  kind: "decision" | "outcome";
  question?: string;
  answer?: Answer;
  raw?: string;
  stub?: boolean;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
};

export type Run = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  input: string;
  workflow: Workflow;
  createdAt: string;
  finishedAt?: string;
  activeNodeId?: string;
  steps: StepLog[];
  /** ids of the edges actually taken, in order */
  path: string[];
  outcome?: string;
  error?: string;
};

// Kept on globalThis so the Next.js API routes and the Inngest handler (same dev process)
// share it, and it survives hot reloads. A real deployment would use a database.
const store = globalThis as unknown as { __runs?: Map<string, Run> };
const runs = (store.__runs ??= new Map<string, Run>());

export const MAX_HISTORY = 50;

export function createRun(id: string, input: string, workflow: Workflow): Run {
  const run: Run = { id, status: "queued", input, workflow, createdAt: new Date().toISOString(), steps: [], path: [] };
  runs.set(id, run);
  if (runs.size > MAX_HISTORY) runs.delete(runs.keys().next().value!);
  return run;
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

export function listRuns(): Run[] {
  return [...runs.values()].reverse();
}

export function updateRun(id: string, fn: (run: Run) => void): void {
  const run = runs.get(id);
  if (run) fn(run);
}
