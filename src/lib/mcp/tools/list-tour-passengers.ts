import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_tour_passengers",
  title: "List tour passengers",
  description:
    "List all passengers on a tour with their names, contact details, dietary requirements, medical conditions and accessibility needs.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid) to list passengers for."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("bookings")
      .select(
        "id, group_name, passenger_count, status, booking_notes, customers!lead_passenger_id (id, title, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, date_of_birth), passenger_2:customers!passenger_2_id (id, title, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, date_of_birth), passenger_3:customers!passenger_3_id (id, title, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, date_of_birth)",
      )
      .eq("tour_id", tour_id)
      .order("created_at", { ascending: false });

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});
