import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "upsert_itinerary_entry",
  title: "Add or edit itinerary entry",
  description:
    "Add a new entry to an itinerary day, or edit an existing one. To add, provide day_id and subject. To edit, provide entry_id. content is optional.",
  inputSchema: {
    entry_id: z.string().optional().describe("Existing entry id (uuid) to edit. Omit to create a new entry."),
    day_id: z.string().optional().describe("The itinerary day id (uuid). Required when creating."),
    subject: z.string().optional().describe("The entry title/subject."),
    content: z.string().optional().describe("Entry details/description."),
    sort_order: z.number().int().optional().describe("Display order within the day."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ entry_id, day_id, subject, content, sort_order }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const supabase = supabaseForUser(ctx);

    if (entry_id) {
      const updates = Object.fromEntries(
        Object.entries({ subject, content, sort_order }).filter(([, v]) => v !== undefined),
      );
      const { data, error } = await supabase
        .from("tour_itinerary_entries")
        .update(updates)
        .eq("id", entry_id)
        .select()
        .maybeSingle();
      if (error)
        return { content: [{ type: "text", text: error.message }], isError: true };
      if (!data)
        return { content: [{ type: "text", text: "Entry not found or not permitted" }], isError: true };
      return {
        content: [{ type: "text", text: `Updated entry ${data.id}.` }],
        structuredContent: { entry: data },
      };
    }

    if (!day_id || !subject)
      return { content: [{ type: "text", text: "day_id and subject are required to create an entry." }], isError: true };

    const { data, error } = await supabase
      .from("tour_itinerary_entries")
      .insert({ day_id, subject, content: content ?? null, sort_order: sort_order ?? 0 })
      .select()
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Added entry ${data.id}.` }],
      structuredContent: { entry: data },
    };
  },
});