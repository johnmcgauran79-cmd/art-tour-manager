import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "delete_additional_info_section",
  title: "Delete additional info section",
  description: "Permanently delete an Additional Information section by its id.",
  inputSchema: {
    section_id: z.string().describe("The section id (uuid) to delete."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ section_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const { error } = await supabaseForUser(ctx)
      .from("tour_additional_info_sections")
      .delete()
      .eq("id", section_id);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Deleted section ${section_id}.` }] };
  },
});