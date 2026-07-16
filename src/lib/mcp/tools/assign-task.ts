import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "assign_task",
  title: "Assign task",
  description: "Assign one or more users to a task (adds task_assignments rows; existing assignments unchanged).",
  inputSchema: {
    task_id: z.string(),
    user_ids: z.array(z.string()).min(1),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ task_id, user_ids }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const rows = user_ids.map((uid) => ({ task_id, user_id: uid, assigned_by: ctx.getUserId() }));
    const { data, error } = await supabaseForUser(ctx)
      .from("task_assignments")
      .upsert(rows, { onConflict: "task_id,user_id", ignoreDuplicates: true })
      .select("*");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Assigned ${user_ids.length} user(s) to task ${task_id}` }],
      structuredContent: { assignments: data ?? [] },
    };
  },
});