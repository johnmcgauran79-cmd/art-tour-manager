import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_tour_itinerary",
  title: "Get tour itinerary",
  description:
    "Fetch the day-by-day itinerary for a tour, including days and entries with times and descriptions.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid) to fetch the itinerary for."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("tour_itineraries")
      .select(
        "*, tour_itinerary_days (*, tour_itinerary_entries (*))",
      )
      .eq("tour_id", tour_id)
      .eq("is_current", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Itinerary not found" }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { itinerary: data },
    };
  },
});
