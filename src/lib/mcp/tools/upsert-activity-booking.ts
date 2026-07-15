import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "upsert_activity_booking",
  title: "Create or update an activity booking",
  description:
    "Assign a booking to an activity with a passenger count, or update the count. Provide activity_booking_id to update, or activity_id + booking_id to create.",
  inputSchema: {
    activity_booking_id: z.string().optional(),
    activity_id: z.string().optional(),
    booking_id: z.string().optional(),
    passengers_attending: z.number().int().describe("Number of passengers attending (0 to opt out)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ activity_booking_id, activity_id, booking_id, passengers_attending }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const sb = supabaseForUser(ctx);
    if (activity_booking_id) {
      const { data, error } = await sb.from("activity_bookings").update({ passengers_attending }).eq("id", activity_booking_id).select("*").maybeSingle();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return { content: [{ type: "text", text: "Updated activity booking" }], structuredContent: { activity_booking: data } };
    }
    if (!activity_id || !booking_id)
      return { content: [{ type: "text", text: "activity_id and booking_id required to create" }], isError: true };
    const { data, error } = await sb.from("activity_bookings").insert({ activity_id, booking_id, passengers_attending }).select("*").single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Created activity booking ${data.id}` }], structuredContent: { activity_booking: data } };
  },
});