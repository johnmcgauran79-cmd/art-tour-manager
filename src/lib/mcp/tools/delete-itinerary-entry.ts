import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "delete_itinerary_entry",
  title: "Delete itinerary entry",
  description: "Permanently delete a single itinerary entry by its id.",
  inputSchema: {
    entry_id: z.string().describe("The itinerary entry id (uuid) to delete."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ entry_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { error } = await supabaseForUser(ctx)
      .from("tour_itinerary_entries")
      .delete()
      .eq("id", entry_id);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Deleted entry ${entry_id}.` }] };
  },
});