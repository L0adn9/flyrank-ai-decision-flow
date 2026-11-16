"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { DecisionNode, OutcomeNode } from "@/lib/graph";
import { BRANCH_COLORS } from "@/lib/graph";
import { cn } from "@/lib/utils";

export type NodeRunState = "idle" | "active" | "yes" | "no" | "reached" | "failed";

const ring: Record<NodeRunState, string> = {
  idle: "border-border",
  active: "border-amber-500 ring-4 ring-amber-300/60 animate-pulse",
  yes: "border-green-600 ring-2 ring-green-300",
  no: "border-red-600 ring-2 ring-red-300",
  reached: "border-blue-600 ring-4 ring-blue-300",
  failed: "border-red-700 ring-4 ring-red-400",
};

type WithRunState = { runState?: NodeRunState };

export function DecisionNodeView({ data, selected }: NodeProps<DecisionNode>) {
  const state = (data as WithRunState).runState ?? "idle";
  return (
    <div
      className={cn(
        "w-56 rounded-lg border-2 bg-card px-3 py-2 text-card-foreground shadow-sm",
        ring[state],
        selected && "outline outline-2 outline-offset-2 outline-primary",
      )}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Decision</span>
        {state === "yes" || state === "no" ? (
          <span className="text-[10px] font-bold" style={{ color: BRANCH_COLORS[state] }}>
            {state.toUpperCase()}
          </span>
        ) : null}
      </div>
      <div className="font-medium leading-tight">{data.label}</div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{data.prompt}</div>
      <div className="mt-2 flex justify-between text-[10px] font-bold">
        <span style={{ color: BRANCH_COLORS.yes }}>YES</span>
        <span style={{ color: BRANCH_COLORS.no }}>NO</span>
      </div>
      <Handle id="yes" type="source" position={Position.Bottom} style={{ left: "20%", background: BRANCH_COLORS.yes }} />
      <Handle id="no" type="source" position={Position.Bottom} style={{ left: "80%", background: BRANCH_COLORS.no }} />
    </div>
  );
}

export function OutcomeNodeView({ data, selected }: NodeProps<OutcomeNode>) {
  const state = (data as WithRunState).runState ?? "idle";
  return (
    <div
      className={cn(
        "w-40 rounded-full border-2 bg-muted px-3 py-2 text-center text-sm font-medium shadow-sm",
        ring[state],
        selected && "outline outline-2 outline-offset-2 outline-primary",
      )}
    >
      <Handle type="target" position={Position.Top} />
      {data.label}
    </div>
  );
}

export const nodeTypes = { decision: DecisionNodeView, outcome: OutcomeNodeView };
