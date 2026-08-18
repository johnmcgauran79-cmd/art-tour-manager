import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "update_tour_website_description",
  title: "Update tour website description",
  description:
    "Set the tour's Website Description block — the HTML that publishes to the Tour Details section of the WordPress tour page (intro copy, notes and the inclusions copy shown there). Nothing goes live until `wordpress_push_tour_inclusions` is called. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    website_description: z.string().describe("HTML for the Tour Details description block."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, website_description }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { error } = await supabaseForUser(ctx)
      .from("tours")
      .update({ website_description })
      .eq("id", tour_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const out = { tour_id, length: website_description.length };
    return {
      content: [{ type: "text", text: "Website description saved in ART. Not yet published to the website." }],
      structuredContent: out,
    };
  },
});
