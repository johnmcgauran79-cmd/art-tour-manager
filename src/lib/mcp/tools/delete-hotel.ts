import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "delete_hotel",
  title: "Delete hotel",
  description: "Delete a hotel by id. This cascades to hotel bookings — confirm with the user first.",
  inputSchema: { hotel_id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ hotel_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { error } = await supabaseForUser(ctx).from("hotels").delete().eq("id", hotel_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: "Deleted hotel" }] };
  },
});