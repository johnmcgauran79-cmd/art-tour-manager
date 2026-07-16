import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description:
    "List tasks with optional filters. Filter by status, priority, category, tour_id, assignee_user_id, or search text in title/description. Returns up to `limit` (default 50, max 200) most recent tasks.",
  inputSchema: {
    status: z.string().optional().describe("Task status enum value."),
    priority: z.string().optional(),
    category: z.string().optional(),
    tour_id: z.string().optional(),
    assignee_user_id: z.string().optional().describe("Filter tasks assigned to this user id."),
    search: z.string().optional().describe("Case-insensitive substring in title or description."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const limit = input.limit ?? 50;

    let taskIdsForAssignee: string[] | null = null;
    if (input.assignee_user_id) {
      const { data: rows, error } = await supabase
        .from("task_assignments")
        .select("task_id")
        .eq("user_id", input.assignee_user_id);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      taskIdsForAssignee = (rows ?? []).map((r) => r.task_id);
      if (taskIdsForAssignee.length === 0)
        return { content: [{ type: "text", text: "No tasks for that assignee." }], structuredContent: { tasks: [] } };
    }

    let q = supabase
      .from("tasks")
      .select("id, title, status, priority, category, due_date, tour_id, created_by, created_at, updated_at, is_automated, parent_task_id")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (input.status) q = q.eq("status", input.status);
    if (input.priority) q = q.eq("priority", input.priority);
    if (input.category) q = q.eq("category", input.category);
    if (input.tour_id) q = q.eq("tour_id", input.tour_id);
    if (taskIdsForAssignee) q = q.in("id", taskIdsForAssignee);
    if (input.search) q = q.or(`title.ilike.%${input.search}%,description.ilike.%${input.search}%`);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} task(s).` }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});