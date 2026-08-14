import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../tools/_supabase";
import { buildWpItineraryRows, type ArtItineraryDayInput, type WpItineraryRow } from "./itinerary";

export interface ArtItineraryDayImage {
  id: string;
  day_id: string;
  file_path: string;
  file_name: string | null;
  caption: string | null;
  sort_order: number;
  wp_media_id: number | null;
  wp_source_url: string | null;
}

export interface ArtItineraryLoad {
  tour: { id: string; name: string | null; start_date: string | null };
  itinerary_id: string | null;
  days: ArtItineraryDayInput[];
  rows: WpItineraryRow[];
  /** Day photos for this itinerary, keyed nowhere — grouped by day_id. */
  images: ArtItineraryDayImage[];
  /** day_id per rendered row index (rows filter out empty days). */
  day_ids: string[];
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
      images: [],
      day_ids: [],
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

  const { data: images, error: imagesError } = dayIds.length
    ? await supabase
        .from("tour_itinerary_day_images")
        .select("id, day_id, file_path, file_name, caption, sort_order, wp_media_id, wp_source_url")
        .in("day_id", dayIds)
        .order("sort_order")
    : { data: [], error: null };
  if (imagesError) return { error: imagesError.message };
  const dayImages = (images ?? []) as unknown as ArtItineraryDayImage[];

  const shaped: ArtItineraryDayInput[] = (days ?? []).map((d) => ({
    day_number: d.day_number as number,
    activity_date: d.activity_date as string,
    gallery_media_ids: dayImages
      .filter((img) => img.day_id === d.id && typeof img.wp_media_id === "number")
      .map((img) => img.wp_media_id as number),
    entries: (entries ?? [])
      .filter((e) => e.day_id === d.id)
      .map((e) => ({
        subject: e.subject as string,
        content: (e.content as string | null) ?? null,
        sort_order: (e.sort_order as number | null) ?? 0,
      })),
  }));

  // Row indices skip days that render to nothing — mirror that filter for day ids.
  const orderedDays = [...(days ?? [])].sort(
    (a, b) => ((a.day_number as number) ?? 0) - ((b.day_number as number) ?? 0),
  );
  const orderedShaped = [...shaped].sort(
    (a, b) => (a.day_number ?? 0) - (b.day_number ?? 0),
  );
  const rows = buildWpItineraryRows(shaped);
  const dayIdsForRows: string[] = [];
  orderedShaped.forEach((day, i) => {
    const single = buildWpItineraryRows([day]);
    if (single.length > 0) dayIdsForRows.push(orderedDays[i]?.id as string);
  });

  return {
    tour: tour as ArtItineraryLoad["tour"],
    itinerary_id: itinerary.id as string,
    days: shaped,
    rows,
    images: dayImages,
    day_ids: dayIdsForRows,
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
