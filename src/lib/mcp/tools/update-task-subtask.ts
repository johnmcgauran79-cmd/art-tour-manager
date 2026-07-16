import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "update_task_subtask",
  title: "Update task subtask",
  description: "Update a subtask. Set completed=true to mark it done (fills completed_at/by).",
  inputSchema: {
    subtask_id: z.string(),
    title: z.string().optional(),
    completed: z.boolean().optional(),
    sort_order: z.number().int().optional(),
    due_date: z.string().nullable().optional(),
    assignee_id: z.string().nullable().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ subtask_id, completed, ...rest }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const updates: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    if (completed !== undefined) {
      updates.completed = completed;
      updates.completed_at = completed ? new Date().toISOString() : null;
      updates.completed_by = completed ? ctx.getUserId() : null;
    }
    if (Object.keys(updates).length === 0)
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("task_subtasks")
      .update(updates)
      .eq("id", subtask_id)
      .select("*")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Subtask not found" }], isError: true };
    return {
      content: [{ type: "text", text: `Updated subtask ${data.id}` }],
      structuredContent: { subtask: data },
    };
  },
});