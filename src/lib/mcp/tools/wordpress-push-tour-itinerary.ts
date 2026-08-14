import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";
import { WP_ITINERARY_FIELD, buildItineraryDiff, normaliseWpItineraryRows } from "../wordpress/itinerary";
import { loadArtItineraryRows, loadWordpressTourLink } from "../wordpress/_itineraryArt";

export default defineTool({
  name: "wordpress_push_tour_itinerary",
  title: "Push itinerary to website",
  description:
    "Publish the ART itinerary for a tour to its linked WordPress tour post, replacing the live `itinerary` repeater rows (this is what guests see on the website). ART is the source of truth; the push is one-way ART → WordPress. Run `wordpress_preview_tour_itinerary` first, show the diff, and only call this once the user has approved — you must pass confirm=true. Every call is written to the WordPress audit log with a before/after snapshot. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    confirm: z
      .boolean()
      .describe("Must be true. Confirms the user has reviewed the diff and approved publishing to the live website."),
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
          text: "Not published. Review the diff with wordpress_preview_tour_itinerary, get the user's approval, then call again with confirm=true.",
        }],
        isError: true,
      };

    const art = await loadArtItineraryRows(ctx, tour_id);
    if ("error" in art) return { content: [{ type: "text", text: art.error }], isError: true };
    if (!art.itinerary_id || art.rows.length === 0)
      return {
        content: [{
          type: "text",
          text: `Tour ${art.tour.name ?? tour_id} has no itinerary content to publish. Refusing to blank the website itinerary.`,
        }],
        isError: true,
      };

    let wpId = wordpress_tour_id ?? null;
    if (!wpId) {
      const linked = await loadWordpressTourLink(ctx, tour_id);
      if ("error" in linked) return { content: [{ type: "text", text: linked.error }], isError: true };
      const link = linked.link as { wp_tour_id?: number | null } | null;
      wpId = link?.wp_tour_id ?? null;
    }
    if (!wpId)
      return {
        content: [{
          type: "text",
          text: "This tour is not linked to a WordPress tour post. Pass wordpress_tour_id explicitly or link the tour first.",
        }],
        isError: true,
      };

    const endpoint = `tour/${wpId}`;
    let before: Record<string, unknown> | null = null;
    try {
      const b = await wordpressRequest<Record<string, unknown>>({
        endpoint,
        query: { context: "edit", _fields: "id,acf" },
      });
      before = (b.data as { acf?: Record<string, unknown> })?.acf ?? null;
    } catch {
      /* before snapshot is best-effort */
    }

    try {
      const res = await wordpressRequest<Record<string, unknown>>({
        endpoint,
        method: "POST",
        body: { acf: { [WP_ITINERARY_FIELD]: art.rows } },
      });
      const after = (res.data as { acf?: Record<string, unknown> })?.acf ?? null;
      const liveRows = normaliseWpItineraryRows(after?.[WP_ITINERARY_FIELD]);
      const verify = buildItineraryDiff(art.rows, liveRows);

      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "push_tour_itinerary",
        wordpress_object_type: "tour",
        wordpress_object_id: wpId,
        request_summary: {
          ...requestSummary(endpoint, "POST"),
          changed_fields: [WP_ITINERARY_FIELD],
          art_tour_id: tour_id,
          row_count: art.rows.length,
        },
        result_status: "success",
        response_code: res.status,
        before_snapshot: before ? { [WP_ITINERARY_FIELD]: before[WP_ITINERARY_FIELD] ?? null } : null,
        after_snapshot: { [WP_ITINERARY_FIELD]: after?.[WP_ITINERARY_FIELD] ?? null },
      });

      const out = {
        tour_id,
        tour_name: art.tour.name,
        wordpress_tour_id: wpId,
        rows_published: art.rows.length,
        live_row_count: liveRows.length,
        verified: !verify.changed,
      };
      return {
        content: [{
          type: "text",
          text: out.verified
            ? `Published ${out.rows_published} itinerary rows to the website for ${out.tour_name}.`
            : `Published ${out.rows_published} rows, but the live itinerary still differs — check the WordPress post.\n${JSON.stringify(out)}`,
        }],
        structuredContent: out,
      };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "push_tour_itinerary",
        wordpress_object_type: "tour",
        wordpress_object_id: wpId,
        request_summary: {
          ...requestSummary(endpoint, "POST"),
          changed_fields: [WP_ITINERARY_FIELD],
          art_tour_id: tour_id,
        },
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
        before_snapshot: before,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});
