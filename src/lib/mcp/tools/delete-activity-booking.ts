import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "delete_activity_booking",
  title: "Delete an activity booking",
  description: "Remove a booking's assignment to an activity.",
  inputSchema: { activity_booking_id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ activity_booking_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { error } = await supabaseForUser(ctx).from("activity_bookings").delete().eq("id", activity_booking_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: "Deleted activity booking" }] };
  },
});