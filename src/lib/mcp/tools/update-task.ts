import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "update_task",
  title: "Update task",
  description: "Update fields on an existing task. Only supplied fields are changed. Set status to 'completed' to complete a task.",
  inputSchema: {
    task_id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    due_date: z.string().nullable().optional(),
    tour_id: z.string().nullable().optional(),
    parent_task_id: z.string().nullable().optional(),
    depends_on_task_id: z.string().nullable().optional(),
    url_reference: z.string().nullable().optional(),
    quick_update: z.string().optional().describe("Short status note; timestamps set automatically."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ task_id, quick_update, ...rest }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const updates: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    if (quick_update !== undefined) {
      updates.quick_update = quick_update;
      updates.quick_update_at = new Date().toISOString();
      updates.quick_update_by = ctx.getUserId();
    }
    if (updates.status === "completed") updates.completed_at = new Date().toISOString();
    if (Object.keys(updates).length === 0)
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", task_id)
      .select("*")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Task not found or not permitted" }], isError: true };
    return {
      content: [{ type: "text", text: `Updated task ${data.title}` }],
      structuredContent: { task: data },
    };
  },
});