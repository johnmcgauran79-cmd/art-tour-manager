import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "add_task_subtask",
  title: "Add task subtask",
  description: "Add a subtask (checklist item) to a task.",
  inputSchema: {
    task_id: z.string(),
    title: z.string().min(1),
    sort_order: z.number().int().optional(),
    due_date: z.string().optional().describe("YYYY-MM-DD"),
    assignee_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("task_subtasks")
      .insert({ ...input, created_by: ctx.getUserId() })
      .select("*")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Added subtask ${data.id}` }],
      structuredContent: { subtask: data },
    };
  },
});