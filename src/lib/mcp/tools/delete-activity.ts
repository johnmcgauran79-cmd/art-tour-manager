import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "delete_activity",
  title: "Delete activity",
  description: "Delete an activity by id. Cascades to activity bookings — confirm first.",
  inputSchema: { activity_id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ activity_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { error } = await supabaseForUser(ctx).from("activities").delete().eq("id", activity_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: "Deleted activity" }] };
  },
});