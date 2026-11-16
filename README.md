# AI Decision Flow

A visual workflow editor where every node is an AI decision that answers **YES** or **NO**.
The graph is drawn with [React Flow](https://reactflow.dev), executed step by step with
[Inngest](https://www.inngest.com), and each decision is made by an LLM through the OpenAI SDK
(pointed at any OpenAI-compatible provider).

```
"Is this a support request?"  --YES-->  Support
                              --NO--->  Sales
```

## Stack

Next.js 15 (App Router) · React Flow (`@xyflow/react`) · Inngest · OpenAI SDK · shadcn/ui · Tailwind

## Setup

```bash
npm install
cp .env.example .env.local      # add LLM_API_KEY, or set LLM_STUB=1 to run without a model
```

## Run (two terminals)

```bash
npm run dev        # Next.js on http://localhost:3000
npm run inngest    # Inngest dev server on http://localhost:8288 (discovers /api/inngest)
```

## Project structure

```
src/app/page.tsx              the editor page
src/app/api/inngest/route.ts  Inngest serve endpoint
src/inngest/client.ts         Inngest client
src/components/ui/            shadcn components
```
