import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_booking_passenger_details",
  title: "Get booking passenger details",
  description:
    "Fetch full passenger details for a single booking, including passport details, travel docs, waivers, hotel, activity bookings, dietary and medical info.",
  inputSchema: {
    booking_id: z.string().describe("The booking id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ booking_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("bookings")
      .select(
        "*, tours (name), customers!lead_passenger_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes), secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone), passenger_2:customers!passenger_2_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes), passenger_3:customers!passenger_3_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes), hotel_bookings (id, hotel_id, check_in_date, check_out_date, nights, bedding, allocated, room_type, room_upgrade, confirmation_number, room_requests, hotels (name)), activity_bookings (id, activity_id, passengers_attending, activities (name, activity_date, start_time, end_time, location)), booking_travel_docs (*), booking_waivers (*), selected_pickup:tour_pickup_options (id, name, description, pickup_time, location)",
      )
      .eq("id", booking_id)
      .maybeSingle();

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Booking not found" }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { booking: data },
    };
  },
});
