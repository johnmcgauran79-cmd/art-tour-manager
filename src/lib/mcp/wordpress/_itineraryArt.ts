import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../tools/_supabase";
import { buildWpItineraryRows, type ArtItineraryDayInput, type WpItineraryRow } from "./itinerary";

export interface ArtItineraryLoad {
  tour: { id: string; name: string | null; start_date: string | null };
  itinerary_id: string | null;
  days: ArtItineraryDayInput[];
  rows: WpItineraryRow[];
}

/** Load a tour's current ART itinerary and render it as WordPress repeater rows. */
export async function loadArtItineraryRows(
  ctx: ToolContext,
  tourId: string,
): Promise<{ error: string } | ArtItineraryLoad> {
  const supabase = supabaseForUser(ctx);

  const { data: tour, error: tourError } = await supabase
    .from("tours")
    .select("id, name, start_date")
    .eq("id", tourId)
    .maybeSingle();
  if (tourError) return { error: tourError.message };
  if (!tour) return { error: `No tour found with id ${tourId}.` };

  const { data: itinerary, error: itError } = await supabase
    .from("tour_itineraries")
    .select("id")
    .eq("tour_id", tourId)
    .eq("is_current", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (itError) return { error: itError.message };
  if (!itinerary) {
    return {
      tour: tour as ArtItineraryLoad["tour"],
      itinerary_id: null,
      days: [],
      rows: [],
    };
  }

  const { data: days, error: daysError } = await supabase
    .from("tour_itinerary_days")
    .select("id, day_number, activity_date")
    .eq("itinerary_id", itinerary.id)
    .order("day_number");
  if (daysError) return { error: daysError.message };

  const dayIds = (days ?? []).map((d) => d.id as string);
  const { data: entries, error: entriesError } = dayIds.length
    ? await supabase
        .from("tour_itinerary_entries")
        .select("id, day_id, subject, content, sort_order")
        .in("day_id", dayIds)
        .order("sort_order")
    : { data: [], error: null };
  if (entriesError) return { error: entriesError.message };

  const shaped: ArtItineraryDayInput[] = (days ?? []).map((d) => ({
    day_number: d.day_number as number,
    activity_date: d.activity_date as string,
    entries: (entries ?? [])
      .filter((e) => e.day_id === d.id)
      .map((e) => ({
        subject: e.subject as string,
        content: (e.content as string | null) ?? null,
        sort_order: (e.sort_order as number | null) ?? 0,
      })),
  }));

  return {
    tour: tour as ArtItineraryLoad["tour"],
    itinerary_id: itinerary.id as string,
    days: shaped,
    rows: buildWpItineraryRows(shaped),
  };
}

/** Resolve the linked WordPress tour post for an ART tour. */
export async function loadWordpressTourLink(ctx: ToolContext, tourId: string) {
  const { data, error } = await supabaseForUser(ctx)
    .from("wordpress_tour_links")
    .select("*")
    .eq("tour_id", tourId)
    .maybeSingle();
  if (error) return { error: error.message } as const;
  return { link: data ?? null } as const;
}
