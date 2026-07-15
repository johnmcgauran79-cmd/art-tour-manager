import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "delete_hotel_booking",
  title: "Delete a hotel booking",
  description: "Remove a hotel booking (unlink a booking from a hotel).",
  inputSchema: { hotel_booking_id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ hotel_booking_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { error } = await supabaseForUser(ctx).from("hotel_bookings").delete().eq("id", hotel_booking_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: "Deleted hotel booking" }] };
  },
});