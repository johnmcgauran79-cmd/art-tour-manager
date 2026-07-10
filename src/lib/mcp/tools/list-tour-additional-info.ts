import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_tour_additional_info",
  title: "List additional info sections",
  description:
    "List the Additional Information sections for a tour, in display order. Use the returned ids to edit or delete sections.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("tour_additional_info_sections")
      .select("id, name, icon_name, content, sort_order, is_visible")
      .eq("tour_id", tour_id)
      .order("sort_order", { ascending: true });
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sections: data ?? [] },
    };
  },
});