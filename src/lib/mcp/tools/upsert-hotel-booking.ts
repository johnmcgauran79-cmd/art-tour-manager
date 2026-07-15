import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "upsert_hotel_booking",
  title: "Create or update a hotel booking",
  description:
    "Create a hotel booking (link a booking to a hotel with dates/bedding/room) or update it if hotel_booking_id is supplied.",
  inputSchema: {
    hotel_booking_id: z.string().optional().describe("Provide to update; omit to create."),
    hotel_id: z.string().optional(),
    booking_id: z.string().optional(),
    check_in_date: z.string().optional(),
    check_out_date: z.string().optional(),
    nights: z.number().int().optional(),
    bedding: z.string().optional(),
    allocated: z.boolean().optional(),
    room_type: z.string().optional(),
    room_upgrade: z.string().optional(),
    confirmation_number: z.string().optional(),
    room_requests: z.string().optional(),
    required: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ hotel_booking_id, ...fields }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const clean = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );
    const sb = supabaseForUser(ctx);
    if (hotel_booking_id) {
      const { data, error } = await sb.from("hotel_bookings").update(clean).eq("id", hotel_booking_id).select("*").maybeSingle();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return { content: [{ type: "text", text: "Updated hotel booking" }], structuredContent: { hotel_booking: data } };
    }
    if (!fields.hotel_id || !fields.booking_id)
      return { content: [{ type: "text", text: "hotel_id and booking_id are required to create" }], isError: true };
    const { data, error } = await sb.from("hotel_bookings").insert(clean as any).select("*").single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Created hotel booking ${data.id}` }], structuredContent: { hotel_booking: data } };
  },
});