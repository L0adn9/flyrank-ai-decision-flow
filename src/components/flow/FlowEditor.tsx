"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_WORKFLOW,
  loadWorkflow,
  makeEdge,
  saveWorkflow,
  type Branch,
  type FlowEdge,
  type FlowNode,
} from "@/lib/graph";
import type { Run } from "@/lib/runs";

import { nodeTypes, type NodeRunState } from "./nodes";
import { ExecutionLog, RunHistory } from "./RunPanel";

type RunSummary = Omit<Run, "workflow"> & { nodeCount: number };

/** Visual execution state for each node, derived from a run. */
function nodeStates(run: Run | null): Map<string, NodeRunState> {
  const states = new Map<string, NodeRunState>();
  if (!run) return states;
  for (const step of run.steps) {
    if (step.kind === "outcome") states.set(step.nodeId, "reached");
    else if (step.error) states.set(step.nodeId, "failed");
    else if (step.answer) states.set(step.nodeId, step.answer === "YES" ? "yes" : "no");
  }
  if (run.activeNodeId) states.set(run.activeNodeId, "active");
  return states;
}

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${counter++}`;

export function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("Hi, I can't log in to my account since this morning and I have a demo in an hour!");
  const [run, setRun] = useState<Run | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [ioError, setIoError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const stopPolling = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  };
  useEffect(() => stopPolling, []);

  const refreshHistory = useCallback(async () => {
    const r = await fetch("/api/runs");
    if (r.ok) setHistory(await r.json());
  }, []);
  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const showRun = async (id: string) => {
    stopPolling();
    const r = await fetch(`/api/runs/${id}`);
    if (r.ok) setRun(await r.json());
  };

  const startRun = async () => {
    stopPolling();
    setRunError(null);
    setRun(null);
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, workflow: { nodes, edges } }),
    });
    const body = await res.json();
    if (!res.ok) {
      setRunError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    poll.current = setInterval(async () => {
      const r = await fetch(`/api/runs/${body.runId}`);
      if (!r.ok) return;
      const latest: Run = await r.json();
      setRun(latest);
      if (latest.status === "completed" || latest.status === "failed") {
        stopPolling();
        refreshHistory();
      }
    }, 600);
  };

  // Load once on the client (localStorage doesn't exist during server rendering).
  useEffect(() => {
    const wf = loadWorkflow();
    setNodes(wf.nodes);
    setEdges(wf.edges);
    setLoaded(true);
  }, [setNodes, setEdges]);

  // Store the graph locally on every change.
  useEffect(() => {
    if (loaded) saveWorkflow({ nodes, edges });
  }, [nodes, edges, loaded]);

  const onConnect = useCallback(
    (c: Connection) => {
      const branch = (c.sourceHandle === "no" ? "no" : "yes") as Branch;
      if (!c.source || !c.target || c.source === c.target) return;
      setEdges((eds) => [
        // one decision has exactly one YES path and one NO path: a new connection replaces the old one
        ...eds.filter((e) => !(e.source === c.source && e.data?.branch === branch)),
        makeEdge(c.source!, c.target!, branch),
      ]);
    },
    [setEdges],
  );

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  const updateSelected = (patch: Record<string, string>) => {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedId ? ({ ...n, data: { ...n.data, ...patch } } as FlowNode) : n)),
    );
  };

  const addNode = (type: "decision" | "outcome") => {
    const id = newId(type);
    const position = { x: 120 + Math.random() * 300, y: 120 + Math.random() * 200 };
    const node: FlowNode =
      type === "decision"
        ? { id, type, position, data: { label: "New decision", prompt: "Is this ...?" } }
        : { id, type, position, data: { label: "New outcome" } };
    setNodes((nds) => [...nds, node]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const resetExample = () => {
    setNodes(DEFAULT_WORKFLOW.nodes);
    setEdges(DEFAULT_WORKFLOW.edges);
    setSelectedId(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    setIoError(null);
    try {
      const wf = JSON.parse(await file.text());
      if (!Array.isArray(wf.nodes) || !Array.isArray(wf.edges)) throw new Error("expected { nodes: [], edges: [] }");
      const ids = new Set(wf.nodes.map((n: FlowNode) => n.id));
      const badEdge = wf.edges.find((e: FlowEdge) => !ids.has(e.source) || !ids.has(e.target));
      if (badEdge) throw new Error(`edge ${badEdge.id} points at a node that doesn't exist`);
      setNodes(wf.nodes);
      setEdges(wf.edges.map((e: FlowEdge) => makeEdge(e.source, e.target, e.data?.branch ?? (e.sourceHandle === "no" ? "no" : "yes"))));
      setSelectedId(null);
      setRun(null);
    } catch (err) {
      setIoError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Overlay the run on the canvas: node states + animated, highlighted edges along the path taken.
  const states = useMemo(() => nodeStates(run), [run]);
  const displayNodes = useMemo(
    () =>
      nodes.map((n): FlowNode =>
        states.has(n.id) ? ({ ...n, data: { ...n.data, runState: states.get(n.id) } } as FlowNode) : n,
      ),
    [nodes, states],
  );
  const displayEdges = useMemo(() => {
    if (!run) return edges;
    const taken = new Set(run.path);
    const running = run.status === "running" || run.status === "queued";
    return edges.map((e) =>
      taken.has(e.id)
        ? { ...e, animated: true, style: { ...e.style, strokeWidth: 4 } }
        : { ...e, animated: false, style: { ...e.style, opacity: running || run.path.length ? 0.35 : 1 } },
    );
  }, [edges, run]);

  return (
    <div className="grid h-dvh grid-cols-1 lg:grid-cols-[1fr_360px]">
      <div className="relative min-h-[60vh] border-r">
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => addNode("decision")}>+ Decision</Button>
          <Button size="sm" variant="secondary" onClick={() => addNode("outcome")}>+ Outcome</Button>
          <Button size="sm" variant="outline" onClick={resetExample}>Reset example</Button>
          <Button size="sm" variant="outline" onClick={exportJson}>Export JSON</Button>
          <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>Import JSON</Button>
          {run ? (
            <Button size="sm" variant="ghost" onClick={() => setRun(null)}>Clear run</Button>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = "";
            }}
          />
        </div>
        {ioError ? (
          <p className="absolute left-3 top-14 z-10 rounded bg-destructive px-2 py-1 text-xs text-white">{ioError}</p>
        ) : null}
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
        >
          <Background />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>

      <aside className="flex flex-col gap-4 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run the workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} />
            <Button onClick={startRun} disabled={!input.trim() || run?.status === "running" || run?.status === "queued"}>
              Run
            </Button>
            {runError ? <p className="text-destructive">{runError}</p> : null}
          </CardContent>
        </Card>
        {run ? <ExecutionLog run={run} /> : null}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected ? "Edit node" : "AI Decision Flow"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selected ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="label">Label</Label>
                  <Input id="label" value={selected.data.label} onChange={(e) => updateSelected({ label: e.target.value })} />
                </div>
                {selected.type === "decision" ? (
                  <div className="space-y-1">
                    <Label htmlFor="prompt">YES/NO question for the model</Label>
                    <Textarea
                      id="prompt"
                      rows={5}
                      value={selected.data.prompt}
                      onChange={(e) => updateSelected({ prompt: e.target.value })}
                    />
                  </div>
                ) : null}
                <Button size="sm" variant="destructive" onClick={deleteSelected}>Delete node</Button>
              </>
            ) : (
              <p className="text-muted-foreground">
                Click a node to edit it. Drag from a node&apos;s green (YES) or red (NO) handle to another node to
                connect them. The graph is saved in this browser automatically.
              </p>
            )}
          </CardContent>
        </Card>
        <RunHistory runs={history} activeId={run?.id} onSelect={showRun} onRefresh={refreshHistory} />
      </aside>
    </div>
  );
}
