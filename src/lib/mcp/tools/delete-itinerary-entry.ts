import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "delete_itinerary_entry",
  title: "Delete itinerary entry",
  description: "Permanently delete a single itinerary entry by its id.",
  inputSchema: {
    entry_id: z.string().describe("The itinerary entry id (uuid) to delete."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ entry_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const { error } = await supabaseForUser(ctx)
      .from("tour_itinerary_entries")
      .delete()
      .eq("id", entry_id);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Deleted entry ${entry_id}.` }] };
  },
});