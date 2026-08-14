import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { toolError } from "./_uploads";

export default defineTool({
  name: "reorder_itinerary_entries",
  title: "Reorder itinerary entries",
  description:
    "Set the display order of the entries within one itinerary day. Provide `entry_ids` in the order you want them shown — sort_order is rewritten as 0,1,2… Every entry of the day must be listed. Admin/manager only.",
  inputSchema: {
    day_id: z.string().describe("The itinerary day id (uuid)."),
    entry_ids: z.array(z.string()).min(1).describe("Entry ids (uuid) in the desired display order."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ day_id, entry_ids }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const supabase = supabaseForUser(ctx);
    const { data: existing, error } = await supabase
      .from("tour_itinerary_entries")
      .select("id")
      .eq("day_id", day_id);
    if (error) return toolError(error.message);

    const existingIds = new Set((existing ?? []).map((e) => e.id as string));
    if (existingIds.size === 0) return toolError(`Day ${day_id} has no entries.`);

    const unique = Array.from(new Set(entry_ids));
    if (unique.length !== entry_ids.length) return toolError("entry_ids contains duplicates.");
    const unknown = unique.filter((id) => !existingIds.has(id));
    if (unknown.length)
      return toolError(`These entry ids do not belong to day ${day_id}: ${unknown.join(", ")}`);
    if (unique.length !== existingIds.size)
      return toolError(
        `entry_ids must list all ${existingIds.size} entries of the day (received ${unique.length}).`,
      );

    for (let i = 0; i < unique.length; i++) {
      const res = await supabase
        .from("tour_itinerary_entries")
        .update({ sort_order: i })
        .eq("id", unique[i]);
      if (res.error) return toolError(res.error.message);
    }

    const out = { day_id, order: unique };
    return {
      content: [{ type: "text", text: `Reordered ${unique.length} entries on day ${day_id}.` }],
      structuredContent: out,
    };
  },
});
