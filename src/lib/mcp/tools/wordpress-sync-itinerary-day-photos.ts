import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { signAttachmentUrl } from "./_uploads";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";
import { uploadWpMedia } from "../wordpress/_media";
import {
  WP_ITINERARY_FIELD,
  normaliseWpItineraryRows,
  preserveGalleries,
} from "../wordpress/itinerary";
import { loadArtItineraryRows, loadWordpressTourLink } from "../wordpress/_itineraryArt";

function guessContentType(name: string | null): string {
  const ext = (name ?? "").toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export default defineTool({
  name: "wordpress_sync_itinerary_day_photos",
  title: "Publish itinerary day photos to the website",
  description:
    "Publish the photos attached to a tour's itinerary days (uploaded with `upload_itinerary_day_photo`) into the matching day galleries on the linked WordPress tour post. Any photo not yet in the WordPress media library is uploaded first, then each itinerary row's `gallery` is set to that day's photos in order (days with no ART photos keep whatever gallery is already live). ART is the source of truth and the sync is one-way ART → WordPress. Requires confirm=true; every call is audited with a before/after snapshot. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    confirm: z.boolean().describe("Must be true. Confirms the user approved publishing these photos to the live website."),
    wordpress_tour_id: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Override the WordPress tour post id. Defaults to the linked post for this tour."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id, confirm, wordpress_tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!confirm)
      return {
        content: [{
          type: "text",
          text: "Nothing published. Confirm with the user that these day photos should go live, then call again with confirm=true.",
        }],
        isError: true,
      };

    const supabase = supabaseForUser(ctx);
    const art = await loadArtItineraryRows(ctx, tour_id);
    if ("error" in art) return { content: [{ type: "text", text: art.error }], isError: true };
    if (!art.itinerary_id || art.rows.length === 0)
      return {
        content: [{ type: "text", text: `Tour ${art.tour.name ?? tour_id} has no itinerary rows to attach photos to.` }],
        isError: true,
      };
    if (art.images.length === 0)
      return {
        content: [{
          type: "text",
          text: `No itinerary day photos have been uploaded for ${art.tour.name ?? tour_id}. Upload them first with upload_itinerary_day_photo.`,
        }],
        isError: true,
      };

    let wpId = wordpress_tour_id ?? null;
    if (!wpId) {
      const linked = await loadWordpressTourLink(ctx, tour_id);
      if ("error" in linked) return { content: [{ type: "text", text: linked.error }], isError: true };
      wpId = (linked.link as { wp_tour_id?: number | null } | null)?.wp_tour_id ?? null;
    }
    if (!wpId)
      return {
        content: [{
          type: "text",
          text: "This tour is not linked to a WordPress tour post. Pass wordpress_tour_id explicitly or link the tour first.",
        }],
        isError: true,
      };

    // 1. Make sure every ART photo exists in the WordPress media library.
    const uploadErrors: string[] = [];
    let uploadedCount = 0;
    for (const img of art.images) {
      if (typeof img.wp_media_id === "number") continue;
      const signed = await signAttachmentUrl(ctx, img.file_path, 600);
      if (!signed) {
        uploadErrors.push(`${img.file_name ?? img.id}: could not read the stored file.`);
        continue;
      }
      try {
        const fileRes = await fetch(signed);
        if (!fileRes.ok) {
          uploadErrors.push(`${img.file_name ?? img.id}: download failed (${fileRes.status}).`);
          continue;
        }
        const bytes = new Uint8Array(await fileRes.arrayBuffer());
        const result = await uploadWpMedia({
          filename: img.file_name ?? `itinerary-photo-${img.id}.jpg`,
          contentType: guessContentType(img.file_name),
          bytes,
          title: img.file_name ?? undefined,
          caption: img.caption ?? undefined,
        });
        if ("error" in result) {
          uploadErrors.push(`${img.file_name ?? img.id}: ${result.error}`);
          continue;
        }
        img.wp_media_id = result.id;
        img.wp_source_url = result.source_url;
        uploadedCount++;
        await supabase
          .from("tour_itinerary_day_images")
          .update({ wp_media_id: result.id, wp_source_url: result.source_url })
          .eq("id", img.id);
        await auditWordpressCall(ctx, {
          source: "mcp",
          action: "upload_media",
          wordpress_object_type: "media",
          wordpress_object_id: result.id,
          request_summary: { endpoint: "media", method: "POST", art_itinerary_day_image_id: img.id, size: bytes.byteLength },
          result_status: "success",
          response_code: result.status,
        });
      } catch (err) {
        uploadErrors.push(`${img.file_name ?? img.id}: ${categoriseError(err).message}`);
      }
    }

    // 2. Rebuild the itinerary rows with the resolved galleries and push them.
    const galleriesByRow = art.day_ids.map((dayId) =>
      art.images
        .filter((img) => img.day_id === dayId && typeof img.wp_media_id === "number")
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => img.wp_media_id as number),
    );
    const artRows = art.rows.map((row, i) =>
      galleriesByRow[i]?.length ? { ...row, gallery: galleriesByRow[i] } : { ...row },
    );

    const endpoint = `tour/${wpId}`;
    let before: Record<string, unknown> | null = null;
    try {
      const b = await wordpressRequest<Record<string, unknown>>({
        endpoint,
        query: { context: "edit", _fields: "id,acf" },
      });
      before = (b.data as { acf?: Record<string, unknown> })?.acf ?? null;
    } catch { /* best effort */ }

    try {
      const beforeRows = normaliseWpItineraryRows(before?.[WP_ITINERARY_FIELD]);
      const rowsToPush = preserveGalleries(artRows, beforeRows);
      const res = await wordpressRequest<Record<string, unknown>>({
        endpoint,
        method: "POST",
        body: { acf: { [WP_ITINERARY_FIELD]: rowsToPush } },
      });
      const after = (res.data as { acf?: Record<string, unknown> })?.acf ?? null;
      const liveRows = normaliseWpItineraryRows(after?.[WP_ITINERARY_FIELD]);

      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "sync_itinerary_day_photos",
        wordpress_object_type: "tour",
        wordpress_object_id: wpId,
        request_summary: {
          ...requestSummary(endpoint, "POST"),
          changed_fields: [WP_ITINERARY_FIELD],
          art_tour_id: tour_id,
          photos_uploaded: uploadedCount,
          photo_count: art.images.length,
        },
        result_status: uploadErrors.length ? "error" : "success",
        response_code: res.status,
        before_snapshot: before ? { [WP_ITINERARY_FIELD]: before[WP_ITINERARY_FIELD] ?? null } : null,
        after_snapshot: { [WP_ITINERARY_FIELD]: after?.[WP_ITINERARY_FIELD] ?? null },
        error_message: uploadErrors.length ? uploadErrors.join(" | ") : undefined,
      });

      const out = {
        tour_id,
        tour_name: art.tour.name,
        wordpress_tour_id: wpId,
        photos_total: art.images.length,
        photos_uploaded_to_wordpress: uploadedCount,
        days_with_photos: galleriesByRow.filter((g) => g.length > 0).length,
        rows_published: rowsToPush.length,
        live_row_count: liveRows.length,
        galleries: art.day_ids.map((dayId, i) => ({
          row_index: i,
          day_id: dayId,
          date_event: rowsToPush[i]?.date_event ?? null,
          media_ids: galleriesByRow[i] ?? [],
        })),
        errors: uploadErrors,
      };
      return {
        content: [{
          type: "text",
          text: `Published ${out.photos_total} photo(s) across ${out.days_with_photos} itinerary day(s) for ${out.tour_name}${uploadErrors.length ? ` — ${uploadErrors.length} photo(s) failed.` : "."}\n${JSON.stringify(out)}`,
        }],
        structuredContent: out,
      };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "sync_itinerary_day_photos",
        wordpress_object_type: "tour",
        wordpress_object_id: wpId,
        request_summary: { ...requestSummary(endpoint, "POST"), art_tour_id: tour_id },
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
        before_snapshot: before,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});
