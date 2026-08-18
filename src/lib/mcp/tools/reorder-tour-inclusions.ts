import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "reorder_tour_inclusions",
  title: "Reorder tour inclusions or exclusions",
  description:
    "Set the display order of a tour's inclusion or exclusion items by listing their ids in the desired order (ids come from `get_tour_inclusions`). Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    item_ids: z.array(z.string()).min(1).describe("Item ids in the desired display order."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, item_ids }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    for (let i = 0; i < item_ids.length; i++) {
      const { error } = await supabase
        .from("tour_inclusion_items")
        .update({ sort_order: i })
        .eq("id", item_ids[i])
        .eq("tour_id", tour_id);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const out = { tour_id, reordered: item_ids.length };
    return { content: [{ type: "text", text: `Reordered ${item_ids.length} item(s).` }], structuredContent: out };
  },
});
