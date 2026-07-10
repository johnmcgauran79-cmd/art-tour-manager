import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "create_itinerary",
  title: "Create tour itinerary",
  description:
    "Create the itinerary for a tour and auto-generate one day per date between the tour's start and end dates. Fails if an itinerary already exists for the tour.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid) to create the itinerary for."),
    title: z.string().optional().describe("Optional itinerary title."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ tour_id, title }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);

    const { data: existing } = await supabase
      .from("tour_itineraries")
      .select("id")
      .eq("tour_id", tour_id)
      .eq("is_current", true)
      .maybeSingle();
    if (existing)
      return { content: [{ type: "text", text: "An itinerary already exists for this tour." }], isError: true };

    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("start_date, end_date")
      .eq("id", tour_id)
      .maybeSingle();
    if (tourError)
      return { content: [{ type: "text", text: tourError.message }], isError: true };
    if (!tour)
      return { content: [{ type: "text", text: "Tour not found" }], isError: true };

    const { data: itinerary, error: itError } = await supabase
      .from("tour_itineraries")
      .insert({ tour_id, title: title ?? "Tour Itinerary", created_by: ctx.getUserId() })
      .select()
      .single();
    if (itError)
      return { content: [{ type: "text", text: itError.message }], isError: true };

    const days: { itinerary_id: string; day_number: number; activity_date: string }[] = [];
    const [y, m, d] = String(tour.start_date).split("-").map(Number);
    const current = new Date(Date.UTC(y, m - 1, d));
    const endStr = String(tour.end_date);
    while (true) {
      const dateStr = current.toISOString().split("T")[0];
      days.push({ itinerary_id: itinerary.id, day_number: days.length + 1, activity_date: dateStr });
      if (dateStr >= endStr) break;
      current.setUTCDate(current.getUTCDate() + 1);
    }

    const { error: daysError } = await supabase.from("tour_itinerary_days").insert(days);
    if (daysError)
      return { content: [{ type: "text", text: daysError.message }], isError: true };

    return {
      content: [{ type: "text", text: `Created itinerary with ${days.length} day(s).` }],
      structuredContent: { itinerary_id: itinerary.id, day_count: days.length },
    };
  },
});