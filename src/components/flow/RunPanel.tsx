"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Run } from "@/lib/runs";

type RunSummary = Omit<Run, "workflow"> & { nodeCount: number };

const statusVariant = (status: Run["status"]) =>
  status === "failed" ? "destructive" : status === "completed" ? "default" : "secondary";

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString() : "");

/** Execution logs: every step in order, with the model's raw answer, timing and errors. */
export function ExecutionLog({ run }: { run: Run }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Execution log</CardTitle>
        <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <p className="text-muted-foreground">
          Input: <span className="text-foreground">{run.input}</span>
        </p>
        <ol className="space-y-2">
          {run.steps.map((s) => (
            <li key={`${s.index}-${s.nodeId}`} className="rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {s.index + 1}. {s.label}
                </span>
                {s.answer ? (
                  <Badge
                    className={s.answer === "YES" ? "bg-green-600 text-white" : "bg-red-600 text-white"}
                  >
                    {s.answer}
                  </Badge>
                ) : s.kind === "outcome" ? (
                  <Badge variant="outline">outcome</Badge>
                ) : s.error ? (
                  <Badge variant="destructive">error</Badge>
                ) : (
                  <Badge variant="secondary">running…</Badge>
                )}
              </div>
              {s.question ? <p className="mt-1 text-muted-foreground">{s.question}</p> : null}
              <p className="mt-1 text-muted-foreground">
                {time(s.startedAt)}
                {s.durationMs !== undefined ? ` · ${s.durationMs} ms` : ""}
                {s.stub ? " · stub" : s.raw !== undefined ? ` · model said ${JSON.stringify(s.raw)}` : ""}
              </p>
              {s.error ? <p className="mt-1 text-destructive">{s.error}</p> : null}
            </li>
          ))}
        </ol>
        {run.outcome ? (
          <p>
            Result: <strong>{run.outcome}</strong>
          </p>
        ) : null}
        {run.error ? <p className="text-destructive">{run.error}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Execution history: recent runs kept by the server; click one to replay its state on the canvas. */
export function RunHistory({
  runs,
  activeId,
  onSelect,
  onRefresh,
}: {
  runs: RunSummary[];
  activeId?: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">History</CardTitle>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        {runs.length === 0 ? <p className="text-muted-foreground">No runs yet.</p> : null}
        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left hover:bg-muted ${
              r.id === activeId ? "border-primary" : ""
            }`}
          >
            <span className="truncate">
              {time(r.createdAt)} · {r.input}
            </span>
            <Badge variant={statusVariant(r.status)} className="shrink-0">
              {r.outcome ?? r.status}
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
