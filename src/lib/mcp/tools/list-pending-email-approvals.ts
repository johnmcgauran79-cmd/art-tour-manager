import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_pending_email_approvals",
  title: "List pending status-change email approvals",
  description:
    "List status-change email approvals currently awaiting review. Filter by tour_id.",
  inputSchema: { tour_id: z.string().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("status_change_email_queue")
      .select("*")
      .order("created_at", { ascending: false });
    if (tour_id) q = q.eq("tour_id", tour_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { queue: data ?? [] },
    };
  },
});