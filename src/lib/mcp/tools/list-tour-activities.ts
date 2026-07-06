import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_tour_activities",
  title: "List tour activities",
  description:
    "List activities for a given tour id, including dates, times, locations, transport and dress code.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid) to list activities for."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("activities")
      .select(
        "id, name, activity_date, start_time, end_time, location, depart_for_activity, transport_mode, transport_company, transport_contact_name, transport_phone, transport_email, pickup_location_transport, driver_name, driver_phone, dress_code, hospitality_inclusions, notes, operations_notes, transport_status, spots_available, spots_booked, spots_remaining",
      )
      .eq("tour_id", tour_id)
      .order("activity_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { activities: data ?? [] },
    };
  },
});
