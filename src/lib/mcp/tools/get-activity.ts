import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_activity",
  title: "Get activity details",
  description:
    "Fetch full details for a single activity, including pickup journeys and which bookings are attending.",
  inputSchema: {
    activity_id: z.string().describe("The activity id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ activity_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("activities")
      .select(
        "*, activity_journeys (*), activity_bookings (id, booking_id, passengers_attending)",
      )
      .eq("id", activity_id)
      .maybeSingle();

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Activity not found" }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { activity: data },
    };
  },
});
