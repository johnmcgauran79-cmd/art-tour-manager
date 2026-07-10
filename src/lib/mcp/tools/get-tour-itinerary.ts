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

    const supabase = supabaseForUser(ctx);

    // NOTE: There are no DB foreign keys between these tables, so PostgREST
    // cannot resolve nested embeds (it returns a schema-cache error).
    // Fetch each level separately, mirroring the app's useItinerary hook.
    const { data: itinerary, error: itError } = await supabase
      .from("tour_itineraries")
      .select("*")
      .eq("tour_id", tour_id)
      .eq("is_current", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (itError)
      return { content: [{ type: "text", text: itError.message }], isError: true };
    if (!itinerary)
      return { content: [{ type: "text", text: "Itinerary not found" }], isError: true };

    const { data: days, error: daysError } = await supabase
      .from("tour_itinerary_days")
      .select("*")
      .eq("itinerary_id", itinerary.id)
      .order("day_number");

    if (daysError)
      return { content: [{ type: "text", text: daysError.message }], isError: true };

    const dayIds = (days ?? []).map((d) => d.id);
    const { data: entries, error: entriesError } = dayIds.length
      ? await supabase
          .from("tour_itinerary_entries")
          .select("*")
          .in("day_id", dayIds)
          .order("sort_order")
      : { data: [], error: null };

    if (entriesError)
      return { content: [{ type: "text", text: entriesError.message }], isError: true };

    const result = {
      ...itinerary,
      tour_itinerary_days: (days ?? []).map((day) => ({
        ...day,
        tour_itinerary_entries: (entries ?? []).filter((e) => e.day_id === day.id),
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: { itinerary: result },
    };
  },
});
