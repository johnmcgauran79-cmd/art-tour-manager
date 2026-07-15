import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_activity_attachments",
  title: "List activity attachments",
  description: "List file attachments (contracts, briefs, tickets) uploaded against an activity.",
  inputSchema: { activity_id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ activity_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("activity_attachments")
      .select("*")
      .eq("activity_id", activity_id)
      .order("uploaded_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { attachments: data ?? [] },
    };
  },
});