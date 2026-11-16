import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Inngest's dev server calls this endpoint to discover and run our functions.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
