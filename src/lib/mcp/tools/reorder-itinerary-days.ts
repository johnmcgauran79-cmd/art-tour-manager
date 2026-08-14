import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { toolError } from "./_uploads";

export default defineTool({
  name: "reorder_itinerary_days",
  title: "Reorder itinerary days",
  description:
    "Renumber the days of an itinerary. Provide `day_ids` in the order you want them shown — day_number is rewritten as 1,2,3… Every day of the itinerary must be listed. Dates are not changed. Admin/manager only.",
  inputSchema: {
    itinerary_id: z.string().describe("The itinerary id (uuid)."),
    day_ids: z.array(z.string()).min(1).describe("Itinerary day ids (uuid) in the desired order, first day first."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ itinerary_id, day_ids }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const supabase = supabaseForUser(ctx);
    const { data: existing, error } = await supabase
      .from("tour_itinerary_days")
      .select("id")
      .eq("itinerary_id", itinerary_id);
    if (error) return toolError(error.message);

    const existingIds = new Set((existing ?? []).map((d) => d.id as string));
    if (existingIds.size === 0) return toolError(`Itinerary ${itinerary_id} has no days.`);

    const unique = Array.from(new Set(day_ids));
    if (unique.length !== day_ids.length) return toolError("day_ids contains duplicates.");
    const unknown = unique.filter((id) => !existingIds.has(id));
    if (unknown.length)
      return toolError(`These day ids do not belong to itinerary ${itinerary_id}: ${unknown.join(", ")}`);
    if (unique.length !== existingIds.size)
      return toolError(
        `day_ids must list all ${existingIds.size} days of the itinerary (received ${unique.length}).`,
      );

    // Park day numbers out of range first so the unique(day_number) ordering
    // cannot collide mid-rewrite.
    for (let i = 0; i < unique.length; i++) {
      const res = await supabase
        .from("tour_itinerary_days")
        .update({ day_number: -(i + 1) })
        .eq("id", unique[i]);
      if (res.error) return toolError(res.error.message);
    }
    for (let i = 0; i < unique.length; i++) {
      const res = await supabase
        .from("tour_itinerary_days")
        .update({ day_number: i + 1 })
        .eq("id", unique[i]);
      if (res.error) return toolError(res.error.message);
    }

    const out = { itinerary_id, order: unique };
    return {
      content: [{ type: "text", text: `Renumbered ${unique.length} itinerary days.` }],
      structuredContent: out,
    };
  },
});
