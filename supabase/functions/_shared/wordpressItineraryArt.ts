// Loads a tour's current ART itinerary (days, entries, day photos) and renders
// it as WordPress `itinerary` repeater rows. Mirrors src/lib/mcp/wordpress/_itineraryArt.ts
// so the UI (wp-content-proxy) and the MCP tools always publish identical content.
import { buildWpItineraryRows, type ArtItineraryDayInput, type WpItineraryRow } from "./wordpressItinerary.ts";

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
  images: ArtItineraryDayImage[];
  day_ids: string[];
}

// deno-lint-ignore no-explicit-any
export async function loadArtItinerary(supabase: any, tourId: string): Promise<{ error: string } | ArtItineraryLoad> {
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
    return { tour, itinerary_id: null, days: [], rows: [], images: [], day_ids: [] };
  }

  const { data: days, error: daysError } = await supabase
    .from("tour_itinerary_days")
    .select("id, day_number, activity_date")
    .eq("itinerary_id", itinerary.id)
    .order("day_number");
  if (daysError) return { error: daysError.message };

  const dayIds = (days ?? []).map((d: { id: string }) => d.id);
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
  const dayImages = (images ?? []) as ArtItineraryDayImage[];

  const shaped: ArtItineraryDayInput[] = (days ?? []).map((d: { id: string; day_number: number; activity_date: string }) => ({
    day_number: d.day_number,
    activity_date: d.activity_date,
    gallery_media_ids: dayImages
      .filter((img) => img.day_id === d.id && typeof img.wp_media_id === "number")
      .map((img) => img.wp_media_id as number),
    entries: (entries ?? [])
      .filter((e: { day_id: string }) => e.day_id === d.id)
      .map((e: { subject: string; content: string | null; sort_order: number | null }) => ({
        subject: e.subject,
        content: e.content ?? null,
        sort_order: e.sort_order ?? 0,
      })),
  }));

  const orderedDays = [...(days ?? [])].sort(
    (a: { day_number: number }, b: { day_number: number }) => (a.day_number ?? 0) - (b.day_number ?? 0),
  );
  const orderedShaped = [...shaped].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
  const rows = buildWpItineraryRows(shaped);
  const dayIdsForRows: string[] = [];
  orderedShaped.forEach((day, i) => {
    if (buildWpItineraryRows([day]).length > 0) dayIdsForRows.push(orderedDays[i]?.id);
  });

  return { tour, itinerary_id: itinerary.id, days: shaped, rows, images: dayImages, day_ids: dayIdsForRows };
}
