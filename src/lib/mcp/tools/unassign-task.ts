import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "unassign_task",
  title: "Unassign task",
  description: "Remove a user's assignment from a task.",
  inputSchema: { task_id: z.string(), user_id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ task_id, user_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { error } = await supabaseForUser(ctx)
      .from("task_assignments")
      .delete()
      .eq("task_id", task_id)
      .eq("user_id", user_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Unassigned user ${user_id} from task ${task_id}` }] };
  },
});