import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description:
    "Create a task. Optionally assign users via `assignee_user_ids` (creates task_assignments rows). Status enum: not_started|in_progress|waiting|completed|cancelled|archived|not_required|with_third_party|awaiting_further_information|approval_required|approved|changes_needed. Priority: low|medium|high|critical. Category: operations|finance|marketing|booking|maintenance|general. Due date accepts YYYY-MM-DD (stored as literal date) or full ISO timestamp.",
  inputSchema: {
    title: z.string().min(1),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    due_date: z.string().optional(),
    tour_id: z.string().optional(),
    parent_task_id: z.string().optional(),
    depends_on_task_id: z.string().optional(),
    url_reference: z.string().optional(),
    assignee_user_ids: z.array(z.string()).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const { assignee_user_ids, ...taskInput } = input;
    const insertPayload: Record<string, unknown> = { ...taskInput, created_by: userId };
    const { data, error } = await supabase.from("tasks").insert(insertPayload).select("*").single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    if (assignee_user_ids?.length) {
      const rows = assignee_user_ids.map((uid) => ({ task_id: data.id, user_id: uid, assigned_by: userId }));
      const { error: aerr } = await supabase.from("task_assignments").insert(rows);
      if (aerr) return {
        content: [{ type: "text", text: `Task ${data.id} created but assignment failed: ${aerr.message}` }],
        structuredContent: { task: data },
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: `Created task ${data.title} (${data.id})` }],
      structuredContent: { task: data },
    };
  },
});