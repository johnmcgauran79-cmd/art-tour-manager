import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "get_task",
  title: "Get task",
  description:
    "Return full task detail: task row, assignments, watchers, approvers, subtasks, comments, entity links, and attachments metadata.",
  inputSchema: { task_id: z.string() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ task_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const [task, assignments, watchers, approvers, subtasks, comments, links, attachments] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", task_id).maybeSingle(),
      supabase.from("task_assignments").select("*").eq("task_id", task_id),
      supabase.from("task_watchers").select("*").eq("task_id", task_id),
      supabase.from("task_approvers").select("*").eq("task_id", task_id),
      supabase.from("task_subtasks").select("*").eq("task_id", task_id).order("sort_order"),
      supabase.from("task_comments").select("*").eq("task_id", task_id).order("created_at"),
      supabase.from("task_entity_links").select("*").eq("task_id", task_id),
      supabase.from("task_attachments").select("*").eq("task_id", task_id),
    ]);
    if (task.error) return { content: [{ type: "text", text: task.error.message }], isError: true };
    if (!task.data) return { content: [{ type: "text", text: "Task not found" }], isError: true };
    return {
      content: [{ type: "text", text: `Task: ${task.data.title}` }],
      structuredContent: {
        task: task.data,
        assignments: assignments.data ?? [],
        watchers: watchers.data ?? [],
        approvers: approvers.data ?? [],
        subtasks: subtasks.data ?? [],
        comments: comments.data ?? [],
        entity_links: links.data ?? [],
        attachments: attachments.data ?? [],
      },
    };
  },
});