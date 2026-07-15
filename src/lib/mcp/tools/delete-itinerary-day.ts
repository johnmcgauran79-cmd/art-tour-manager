import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "delete_itinerary_day",
  title: "Delete itinerary day",
  description:
    "Permanently delete an itinerary day and all of its entries by the day id.",
  inputSchema: {
    day_id: z.string().describe("The itinerary day id (uuid) to delete."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ day_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const supabase = supabaseForUser(ctx);
    await supabase.from("tour_itinerary_entries").delete().eq("day_id", day_id);
    const { error } = await supabase.from("tour_itinerary_days").delete().eq("id", day_id);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Deleted day ${day_id}.` }] };
  },
});