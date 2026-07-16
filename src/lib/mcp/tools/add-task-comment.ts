import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "add_task_comment",
  title: "Add task comment",
  description: "Add a comment to a task. Optionally reply to another comment via parent_comment_id.",
  inputSchema: {
    task_id: z.string(),
    comment: z.string().min(1),
    parent_comment_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("task_comments")
      .insert({ ...input, user_id: ctx.getUserId() })
      .select("*")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Comment added (${data.id})` }],
      structuredContent: { comment: data },
    };
  },
});