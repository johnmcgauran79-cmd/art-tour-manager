import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import {
  ALLOWED_IMAGE_TYPES,
  decodeUpload,
  removeFromAttachments,
  signAttachmentUrl,
  toolError,
  uploadToAttachments,
} from "./_uploads";

export const MAX_DAY_PHOTOS = 3;

export default defineTool({
  name: "upload_itinerary_day_photo",
  title: "Upload an itinerary day photo",
  description:
    "Upload a photo (JPEG/PNG/WEBP/GIF, base64 in `data_base64`, max 20MB) against one day of a tour's itinerary. Maximum 3 photos per day — delete one first with `delete_itinerary_day_photo` if the day is full. Photos live in the ART admin system; publish them to the website day gallery with `wordpress_sync_itinerary_day_photos`. Get day ids from `get_tour_itinerary`. Admin/manager only.",
  inputSchema: {
    day_id: z.string().describe("The itinerary day id (uuid) from get_tour_itinerary."),
    filename: z.string().min(1).max(255).describe("Filename including extension, e.g. 'day3-flemington.jpg'."),
    content_type: z.string().min(1).describe(`MIME type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`),
    data_base64: z.string().min(1).describe("Base64-encoded image contents (no data: prefix)."),
    caption: z.string().max(500).optional().describe("Optional caption / alt text, also written to WordPress on sync."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ day_id, filename, content_type, data_base64, caption }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const decoded = decodeUpload({ filename, content_type, data_base64, allowedTypes: ALLOWED_IMAGE_TYPES });
    if ("error" in decoded) return decoded.error;

    const supabase = supabaseForUser(ctx);
    const { data: day, error: dayError } = await supabase
      .from("tour_itinerary_days")
      .select("id, day_number, activity_date")
      .eq("id", day_id)
      .maybeSingle();
    if (dayError) return toolError(dayError.message);
    if (!day) return toolError(`No itinerary day found with id ${day_id}.`);

    const { data: existing, error: existingError } = await supabase
      .from("tour_itinerary_day_images")
      .select("id, sort_order")
      .eq("day_id", day_id)
      .order("sort_order");
    if (existingError) return toolError(existingError.message);
    const count = existing?.length ?? 0;
    if (count >= MAX_DAY_PHOTOS) {
      return toolError(
        `Day ${day.day_number} already has the maximum of ${MAX_DAY_PHOTOS} photos. Delete one before uploading another.`,
      );
    }

    const uploaded = await uploadToAttachments(ctx, `itinerary-day-photos/${day_id}`, decoded.file, { upsert: true });
    if ("error" in uploaded) return uploaded.error;

    const { data, error } = await supabase
      .from("tour_itinerary_day_images")
      .insert({
        day_id,
        file_path: uploaded.path,
        file_name: decoded.file.name,
        caption: caption || null,
        sort_order: count,
        uploaded_by: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) {
      await removeFromAttachments(ctx, uploaded.path);
      return toolError(error.message);
    }

    const out = {
      photo: data,
      day_number: day.day_number,
      activity_date: day.activity_date,
      photos_on_day: count + 1,
      signed_url: await signAttachmentUrl(ctx, uploaded.path),
      next_step:
        "Run wordpress_sync_itinerary_day_photos (with the user's approval) to publish this photo into the website day gallery.",
    };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});
