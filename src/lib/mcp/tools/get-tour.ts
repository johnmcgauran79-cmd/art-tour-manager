import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_tour",
  title: "Get tour details",
  description:
    "Fetch full details for a single tour by its id, including dates, pricing, capacity and host.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("tours")
      .select(
        "id, name, location, start_date, end_date, days, nights, status, capacity, minimum_passengers_required, tour_host, tour_type, price_single, price_double, price_twin, deposit_required, notes",
      )
      .eq("id", tour_id)
      .maybeSingle();

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Tour not found" }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { tour: data },
    };
  },
});