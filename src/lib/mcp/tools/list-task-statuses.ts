import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_task_statuses",
  title: "List task statuses",
  description: "List configured task status values (label, value, sort order, is_finished flag).",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("task_statuses")
      .select("*")
      .order("sort_order");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} statuses.` }],
      structuredContent: { statuses: data ?? [] },
    };
  },
});