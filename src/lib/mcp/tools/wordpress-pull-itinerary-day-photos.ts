import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { supabaseForUser } from "./_supabase";
import { ATTACHMENTS_BUCKET, safeFileName, toolError } from "./_uploads";
import { wordpressRequest } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";
import { WP_ITINERARY_FIELD } from "../wordpress/itinerary";
import { loadWordpressTourLink } from "../wordpress/_itineraryArt";

const MAX_DAY_PHOTOS = 3;

/** ACF gallery values can be ids, numeric strings or attachment objects. */
function galleryIds(value: unknown): number[] {
  const list = Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value];
  return list
    .map((item) => {
      if (typeof item === "number") return item;
      if (typeof item === "string" && /^\d+$/.test(item)) return Number(item);
      const id = (item as { id?: number; ID?: number })?.id ?? (item as { ID?: number })?.ID;
      return typeof id === "number" ? id : null;
    })
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
}

export default defineTool({
  name: "wordpress_pull_itinerary_day_photos",
  title: "Import itinerary day photos from the website",
  description:
    "Backfill: copies the photos already published in each WordPress itinerary day gallery into the matching ART itinerary day (max 3 per day, matched day by day in order). Days that already hold ART photos are skipped — ART stays the source of truth and nothing on the website changes. Call without confirm to preview; call with confirm=true to write. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    confirm: z.boolean().optional().describe("true to import the photos into ART. Omit to preview."),
    day_ids: z
      .array(z.string())
      .optional()
      .describe("Optional: only import these ART itinerary day ids. Defaults to every importable day."),
    wordpress_tour_id: z.number().int().min(1).optional().describe("Override the WordPress tour post id."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id, confirm, day_ids, wordpress_tour_id }, ctx) => {
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

    let wpId = wordpress_tour_id ?? null;
    if (!wpId) {
      const linked = await loadWordpressTourLink(ctx, tour_id);
      if ("error" in linked) return toolError(linked.error);
      wpId = (linked.link as { wp_tour_id?: number | null } | null)?.wp_tour_id ?? null;
    }
    if (!wpId)
      return toolError("This tour is not linked to a WordPress tour post. Pass wordpress_tour_id or link the tour first.");

    try {
      const wpRes = await wordpressRequest<Record<string, unknown>>({
        endpoint: `tour/${wpId}`,
        query: { context: "edit", _fields: "id,acf,link" },
      });
      const acf = (wpRes.data as { acf?: Record<string, unknown> })?.acf ?? {};
      const rawRows = Array.isArray(acf[WP_ITINERARY_FIELD]) ? (acf[WP_ITINERARY_FIELD] as unknown[]) : [];
      const idsByRow = rawRows.map((row) => galleryIds((row as { gallery?: unknown })?.gallery));

      const { data: itinerary } = await supabase
        .from("tour_itineraries")
        .select("id")
        .eq("tour_id", tour_id)
        .eq("is_current", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!itinerary) return toolError("This tour has no itinerary in ART yet — create or import the itinerary first.");

      const { data: dayRows, error: dayError } = await supabase
        .from("tour_itinerary_days")
        .select("id, day_number, activity_date")
        .eq("itinerary_id", itinerary.id)
        .order("day_number");
      if (dayError) return toolError(dayError.message);
      const days = (dayRows ?? []) as Array<{ id: string; day_number: number; activity_date: string }>;
      if (days.length === 0) return toolError("This tour's itinerary has no days yet.");

      const { data: existing } = await supabase
        .from("tour_itinerary_day_images")
        .select("id, day_id")
        .in("day_id", days.map((d) => d.id));
      const existingImages = (existing ?? []) as Array<{ id: string; day_id: string }>;

      const warnings: string[] = [];
      if (rawRows.length !== days.length) {
        warnings.push(
          `The website has ${rawRows.length} itinerary day(s) and ART has ${days.length} — photos are matched day by day in order.`,
        );
      }

      const wantedIds = [...new Set(idsByRow.flat())];
      const mediaById = new Map<
        number,
        { id: number; source_url: string | null; caption: string | null; mime_type: string | null; file_name: string | null }
      >();
      for (const id of wantedIds) {
        try {
          const m = await wordpressRequest<Record<string, unknown>>({
            endpoint: `media/${id}`,
            query: { _fields: "id,source_url,alt_text,title,mime_type,media_details" },
          });
          const d = m.data as {
            source_url?: string;
            alt_text?: string;
            title?: { rendered?: string };
            mime_type?: string;
            media_details?: { file?: string };
          };
          const file = d.media_details?.file ? String(d.media_details.file).split("/").pop() ?? null : null;
          mediaById.set(id, {
            id,
            source_url: d.source_url ?? null,
            caption: (d.alt_text || d.title?.rendered || "").trim() || null,
            mime_type: d.mime_type ?? null,
            file_name: file ?? (d.source_url ? String(d.source_url).split("/").pop() ?? null : null),
          });
        } catch (err) {
          warnings.push(`Website image ${id}: ${categoriseError(err).message}`);
        }
      }

      const plan = days.map((day, i) => {
        const artCount = existingImages.filter((img) => img.day_id === day.id).length;
        const media = (idsByRow[i] ?? [])
          .slice(0, MAX_DAY_PHOTOS)
          .map((id) => mediaById.get(id))
          .filter((m): m is NonNullable<typeof m> => !!m && !!m.source_url);
        return {
          day_id: day.id,
          day_number: day.day_number,
          activity_date: day.activity_date,
          art_photo_count: artCount,
          website_photos: media.map((m) => ({ wp_media_id: m.id, caption: m.caption, source_url: m.source_url })),
          importable: artCount === 0 && media.length > 0,
          _media: media,
        };
      });

      if (confirm !== true) {
        const out = {
          preview: true,
          tour_id,
          tour_name: tour.name,
          wordpress_tour_id: wpId,
          wp_link: (wpRes.data as { link?: string })?.link ?? null,
          days: plan.map(({ _media, ...rest }) => rest),
          importable_photos: plan.reduce((n, d) => n + (d.importable ? d._media.length : 0), 0),
          warnings,
        };
        return {
          content: [{
            type: "text",
            text: `Would import ${out.importable_photos} photo(s) from the website into ART. Call again with confirm=true to write.\n${JSON.stringify(out)}`,
          }],
          structuredContent: out,
        };
      }

      const onlyDays = day_ids && day_ids.length > 0 ? new Set(day_ids) : null;
      let imported = 0;
      const errors: string[] = [];
      for (const day of plan) {
        if (!day.importable) continue;
        if (onlyDays && !onlyDays.has(day.day_id)) continue;
        let sort = 0;
        for (const m of day._media) {
          try {
            const res = await fetch(m.source_url as string);
            if (!res.ok) throw new Error(`download failed (${res.status})`);
            const bytes = new Uint8Array(await res.arrayBuffer());
            const name = safeFileName(m.file_name ?? `website-${m.id}.jpg`);
            const path = `itinerary-day-photos/${day.day_id}/${Date.now()}-${name}`;
            const up = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, bytes, {
              contentType: m.mime_type ?? res.headers.get("content-type") ?? "image/jpeg",
              upsert: true,
            });
            if (up.error) throw new Error(up.error.message);
            const { error: insError } = await supabase.from("tour_itinerary_day_images").insert({
              day_id: day.day_id,
              file_path: path,
              file_name: name,
              caption: m.caption,
              sort_order: sort,
              wp_media_id: m.id,
              wp_source_url: m.source_url,
              uploaded_by: ctx.getUserId(),
            });
            if (insError) {
              await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
              throw new Error(insError.message);
            }
            sort++;
            imported++;
          } catch (err) {
            errors.push(`Day ${day.day_number} image ${m.id}: ${categoriseError(err).message}`);
          }
        }
      }

      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "pull_itinerary_photos",
        wordpress_object_type: "tour",
        wordpress_object_id: wpId,
        request_summary: { endpoint: `tour/${wpId}`, method: "GET", art_tour_id: tour_id, imported_photos: imported },
        result_status: errors.length ? "error" : "success",
        response_code: 200,
        error_message: errors.length ? errors.join(" | ") : undefined,
      });

      const out = { tour_id, wordpress_tour_id: wpId, imported_photos: imported, warnings, errors };
      return {
        content: [{
          type: "text",
          text: `Imported ${imported} website photo(s) into the ART itinerary${errors.length ? ` — ${errors.length} failed.` : "."}\n${JSON.stringify(out)}`,
        }],
        structuredContent: out,
      };
    } catch (err) {
      return toolError(categoriseError(err).message);
    }
  },
});
