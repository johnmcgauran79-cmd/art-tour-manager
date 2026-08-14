import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { signAttachmentUrl, toolError } from "./_uploads";

export default defineTool({
  name: "list_itinerary_day_photos",
  title: "List itinerary day photos",
  description:
    "List the photos attached to a tour's itinerary days (max 3 per day). Returns each photo with its day number/date, caption, a temporary signed preview URL, and the WordPress media id once the photo has been synced to the website gallery (`wp_media_id` null = not yet on the website). Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    day_id: z.string().optional().describe("Optional: only return photos for this itinerary day id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, day_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);

    const { data: itinerary, error: itError } = await supabase
      .from("tour_itineraries")
      .select("id")
      .eq("tour_id", tour_id)
      .eq("is_current", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (itError) return toolError(itError.message);
    if (!itinerary) return toolError(`Tour ${tour_id} has no current itinerary.`);

    const { data: days, error: daysError } = await supabase
      .from("tour_itinerary_days")
      .select("id, day_number, activity_date")
      .eq("itinerary_id", itinerary.id)
      .order("day_number");
    if (daysError) return toolError(daysError.message);

    const dayIds = (days ?? [])
      .map((d) => d.id as string)
      .filter((id) => !day_id || id === day_id);
    if (dayIds.length === 0) {
      const empty = { tour_id, photo_count: 0, photos: [] };
      return { content: [{ type: "text", text: JSON.stringify(empty) }], structuredContent: empty };
    }

    const { data: images, error: imgError } = await supabase
      .from("tour_itinerary_day_images")
      .select("id, day_id, file_path, file_name, caption, sort_order, wp_media_id, wp_source_url, created_at")
      .in("day_id", dayIds)
      .order("sort_order");
    if (imgError) return toolError(imgError.message);

    const photos = await Promise.all(
      (images ?? []).map(async (img) => {
        const day = (days ?? []).find((d) => d.id === img.day_id);
        return {
          ...img,
          day_number: day?.day_number ?? null,
          activity_date: day?.activity_date ?? null,
          signed_url: await signAttachmentUrl(ctx, img.file_path as string),
        };
      }),
    );

    const out = { tour_id, itinerary_id: itinerary.id, photo_count: photos.length, photos };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});
