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
import { useCallback, useEffect, useMemo, useState } from "react";

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

import { nodeTypes } from "./nodes";

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${counter++}`;

export function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <div className="grid h-dvh grid-cols-1 lg:grid-cols-[1fr_360px]">
      <div className="relative min-h-[60vh] border-r">
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => addNode("decision")}>+ Decision</Button>
          <Button size="sm" variant="secondary" onClick={() => addNode("outcome")}>+ Outcome</Button>
          <Button size="sm" variant="outline" onClick={resetExample}>Reset example</Button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
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
      </aside>
    </div>
  );
}
