import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { removeFromAttachments, toolError } from "./_uploads";

export default defineTool({
  name: "delete_itinerary_day_photo",
  title: "Delete an itinerary day photo",
  description:
    "Remove a photo from an itinerary day in the ART admin system (also deletes the stored file). The WordPress media library copy is left in place, but the photo drops out of the website day gallery the next time you run `wordpress_sync_itinerary_day_photos`. Must pass confirm=true. Admin/manager only.",
  inputSchema: {
    photo_id: z.string().describe("The itinerary day photo id (uuid) from list_itinerary_day_photos."),
    confirm: z.boolean().describe("Must be true — confirms the user approved deleting this photo."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ photo_id, confirm }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!confirm) return toolError("Not deleted. Confirm with the user, then call again with confirm=true.");

    const supabase = supabaseForUser(ctx);
    const { data: photo, error: readError } = await supabase
      .from("tour_itinerary_day_images")
      .select("id, day_id, file_path, file_name")
      .eq("id", photo_id)
      .maybeSingle();
    if (readError) return toolError(readError.message);
    if (!photo) return toolError(`No itinerary day photo found with id ${photo_id}.`);

    const { error } = await supabase.from("tour_itinerary_day_images").delete().eq("id", photo_id);
    if (error) return toolError(error.message);
    await removeFromAttachments(ctx, photo.file_path as string);

    const out = { deleted: true, photo_id, day_id: photo.day_id, file_name: photo.file_name };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});
