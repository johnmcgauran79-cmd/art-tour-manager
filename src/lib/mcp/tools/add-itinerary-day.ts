import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "add_itinerary_day",
  title: "Add itinerary day",
  description:
    "Add a single day to an existing itinerary. Provide the itinerary_id and the activity_date (YYYY-MM-DD). The day number is assigned automatically as the next in sequence.",
  inputSchema: {
    itinerary_id: z.string().describe("The itinerary id (uuid)."),
    activity_date: z.string().describe("The date for the new day, YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ itinerary_id, activity_date }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { data: last } = await supabase
      .from("tour_itinerary_days")
      .select("day_number")
      .eq("itinerary_id", itinerary_id)
      .order("day_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("tour_itinerary_days")
      .insert({
        itinerary_id,
        activity_date,
        day_number: (last?.day_number ?? 0) + 1,
      })
      .select()
      .single();

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: `Added day ${data.day_number} (${data.id}).` }],
      structuredContent: { day: data },
    };
  },
});