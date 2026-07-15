import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_tour_alerts",
  title: "List tour alerts",
  description: "List capacity, cancellation, unread-email and other alerts raised for a tour.",
  inputSchema: {
    tour_id: z.string(),
    include_acknowledged: z.boolean().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, include_acknowledged }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("tour_alerts")
      .select("*")
      .eq("tour_id", tour_id)
      .order("created_at", { ascending: false });
    if (!include_acknowledged) q = q.is("acknowledged_at", null);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { alerts: data ?? [] },
    };
  },
});