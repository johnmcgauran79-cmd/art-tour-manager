import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_tour_hotels",
  title: "List tour hotels",
  description:
    "List hotels and hotel bookings for a given tour id, including check-in/out dates, bedding and allocated rooms.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid) to list hotels for."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("hotels")
      .select(
        "id, name, address, contact_name, contact_phone, contact_email, default_check_in, default_check_out, default_room_type, rooms_reserved, rooms_booked, rooms_available, operations_notes, booking_status, payment_status, hotel_bookings (id, booking_id, check_in_date, check_out_date, nights, bedding, allocated, room_type, room_upgrade, confirmation_number, room_requests, required)",
      )
      .eq("tour_id", tour_id)
      .order("created_at", { ascending: true });

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { hotels: data ?? [] },
    };
  },
});
