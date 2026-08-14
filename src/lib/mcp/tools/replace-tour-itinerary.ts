import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { toolError } from "./_uploads";

const entrySchema = z.object({
  subject: z.string().min(1).describe("Entry title, e.g. 'Ferry Transfer'."),
  time_slot: z.string().optional().describe("Time of day, e.g. '09:00' or 'Morning'."),
  content: z.string().optional().describe("Entry details/description."),
});

const daySchema = z.object({
  activity_date: z.string().describe("Date for this day, YYYY-MM-DD."),
  entries: z.array(entrySchema).default([]).describe("Entries for the day, in display order."),
});

export default defineTool({
  name: "replace_tour_itinerary",
  title: "Replace the whole tour itinerary",
  description:
    "Replace a tour's current itinerary in one call: every existing day and entry is deleted and rebuilt from the `days` array (day numbers assigned in array order, entry sort order in array order). Destructive — always show the user the new itinerary and confirm before calling. Creates the itinerary if the tour has none. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
    days: z.array(daySchema).min(1).describe("The complete new itinerary, ordered day 1 first."),
    title: z.string().optional().describe("Optional itinerary title (only applied when supplied)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ tour_id, days, title }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const supabase = supabaseForUser(ctx);

    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("id, name")
      .eq("id", tour_id)
      .maybeSingle();
    if (tourError) return toolError(tourError.message);
    if (!tour) return toolError(`No tour found with id ${tour_id}.`);

    let { data: itinerary, error: itError } = await supabase
      .from("tour_itineraries")
      .select("id")
      .eq("tour_id", tour_id)
      .eq("is_current", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (itError) return toolError(itError.message);

    if (!itinerary) {
      const created = await supabase
        .from("tour_itineraries")
        .insert({
          tour_id,
          version: 1,
          is_current: true,
          title: title ?? null,
          created_by: ctx.getUserId(),
        })
        .select("id")
        .single();
      if (created.error) return toolError(created.error.message);
      itinerary = created.data;
    } else if (title !== undefined) {
      await supabase.from("tour_itineraries").update({ title }).eq("id", itinerary.id);
    }

    // Wipe existing days + entries.
    const { data: existingDays, error: existingError } = await supabase
      .from("tour_itinerary_days")
      .select("id")
      .eq("itinerary_id", itinerary.id);
    if (existingError) return toolError(existingError.message);
    const existingIds = (existingDays ?? []).map((d) => d.id as string);
    if (existingIds.length) {
      const delEntries = await supabase
        .from("tour_itinerary_entries")
        .delete()
        .in("day_id", existingIds);
      if (delEntries.error) return toolError(delEntries.error.message);
      const delDays = await supabase.from("tour_itinerary_days").delete().in("id", existingIds);
      if (delDays.error) return toolError(delDays.error.message);
    }

    // Rebuild.
    const dayRows = days.map((d, i) => ({
      itinerary_id: itinerary!.id,
      activity_date: d.activity_date,
      day_number: i + 1,
    }));
    const insertedDays = await supabase
      .from("tour_itinerary_days")
      .insert(dayRows)
      .select("id, day_number, activity_date");
    if (insertedDays.error) return toolError(insertedDays.error.message);

    const byNumber = new Map<number, string>();
    for (const d of insertedDays.data ?? []) byNumber.set(d.day_number as number, d.id as string);

    const entryRows: Array<Record<string, unknown>> = [];
    days.forEach((d, i) => {
      const dayId = byNumber.get(i + 1);
      if (!dayId) return;
      (d.entries ?? []).forEach((e, j) => {
        entryRows.push({
          day_id: dayId,
          subject: e.subject,
          time_slot: e.time_slot ?? null,
          content: e.content ?? null,
          sort_order: j,
        });
      });
    });
    if (entryRows.length) {
      const insertedEntries = await supabase.from("tour_itinerary_entries").insert(entryRows);
      if (insertedEntries.error) return toolError(insertedEntries.error.message);
    }

    const out = {
      tour_id,
      tour_name: (tour as { name?: string }).name ?? null,
      itinerary_id: itinerary.id,
      days_created: dayRows.length,
      entries_created: entryRows.length,
      days_replaced: existingIds.length,
    };
    return {
      content: [{
        type: "text",
        text: `Replaced itinerary for ${out.tour_name}: ${out.days_created} days, ${out.entries_created} entries.`,
      }],
      structuredContent: out,
    };
  },
});
