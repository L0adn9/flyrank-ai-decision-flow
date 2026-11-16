import type { Edge, Node } from "@xyflow/react";

export type Branch = "yes" | "no";

/** A decision asks the LLM a YES/NO question; an outcome is where a path ends. */
export type DecisionData = { label: string; prompt: string };
export type OutcomeData = { label: string };

export type DecisionNode = Node<DecisionData, "decision">;
export type OutcomeNode = Node<OutcomeData, "outcome">;
export type FlowNode = DecisionNode | OutcomeNode;
export type FlowEdge = Edge<{ branch: Branch }>;

export type Workflow = { nodes: FlowNode[]; edges: FlowEdge[] };

export const BRANCH_COLORS: Record<Branch, string> = {
  yes: "#16a34a",
  no: "#dc2626",
};

export function makeEdge(source: string, target: string, branch: Branch): FlowEdge {
  return {
    id: `${source}-${branch}-${target}`,
    source,
    target,
    sourceHandle: branch,
    label: branch.toUpperCase(),
    data: { branch },
    style: { stroke: BRANCH_COLORS[branch], strokeWidth: 2 },
    labelStyle: { fill: BRANCH_COLORS[branch], fontWeight: 700 },
  };
}

export const DEFAULT_WORKFLOW: Workflow = {
  nodes: [
    {
      id: "is-support",
      type: "decision",
      position: { x: 260, y: 20 },
      data: {
        label: "Support request?",
        prompt: "Is this message a support request about a problem with a product the sender already uses?",
      },
    },
    {
      id: "is-urgent",
      type: "decision",
      position: { x: 40, y: 220 },
      data: {
        label: "Urgent?",
        prompt: "Does this message describe something broken, blocked or urgent (outage, cannot log in, data loss)?",
      },
    },
    {
      id: "is-sales",
      type: "decision",
      position: { x: 480, y: 220 },
      data: {
        label: "Buying interest?",
        prompt: "Is the sender asking about prices, plans, a demo or buying the product?",
      },
    },
    { id: "support-urgent", type: "outcome", position: { x: -60, y: 440 }, data: { label: "Page on-call support" } },
    { id: "support-queue", type: "outcome", position: { x: 180, y: 440 }, data: { label: "Support queue" } },
    { id: "sales", type: "outcome", position: { x: 400, y: 440 }, data: { label: "Sales team" } },
    { id: "general", type: "outcome", position: { x: 620, y: 440 }, data: { label: "General inbox" } },
  ],
  edges: [
    makeEdge("is-support", "is-urgent", "yes"),
    makeEdge("is-support", "is-sales", "no"),
    makeEdge("is-urgent", "support-urgent", "yes"),
    makeEdge("is-urgent", "support-queue", "no"),
    makeEdge("is-sales", "sales", "yes"),
    makeEdge("is-sales", "general", "no"),
  ],
};

const STORAGE_KEY = "ai-decision-flow:workflow";

export function loadWorkflow(): Workflow {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Workflow;
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed;
    }
  } catch {
    // storage blocked or corrupt: fall back to the example
  }
  return DEFAULT_WORKFLOW;
}

export function saveWorkflow(workflow: Workflow): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow));
  } catch {
    // storage blocked: the editor still works, it just won't persist
  }
}
