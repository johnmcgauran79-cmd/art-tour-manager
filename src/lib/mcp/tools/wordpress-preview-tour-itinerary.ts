import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest } from "../wordpress/_client";
import { categoriseError } from "../wordpress/_audit";
import { WP_ITINERARY_FIELD, buildItineraryDiff, normaliseWpItineraryRows } from "../wordpress/itinerary";
import { loadArtItineraryRows, loadWordpressTourLink } from "../wordpress/_itineraryArt";

export default defineTool({
  name: "wordpress_preview_tour_itinerary",
  title: "Preview itinerary push to website",
  description:
    "Dry run before publishing: renders the ART itinerary for a tour into WordPress repeater rows and diffs them row-by-row against what is live on the website. Changes nothing. Use this, show the diff to the user, then call `wordpress_push_tour_itinerary` to publish. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    wordpress_tour_id: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Override the WordPress tour post id. Defaults to the linked post for this tour."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id, wordpress_tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const art = await loadArtItineraryRows(ctx, tour_id);
    if ("error" in art) return { content: [{ type: "text", text: art.error }], isError: true };
    if (!art.itinerary_id)
      return {
        content: [{ type: "text", text: `Tour ${art.tour.name ?? tour_id} has no itinerary yet.` }],
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

    try {
      const res = await wordpressRequest<Record<string, unknown>>({
        endpoint: `tour/${wpId}`,
        query: { context: "edit", _fields: "id,acf" },
      });
      const wpRows = normaliseWpItineraryRows(
        (res.data as { acf?: Record<string, unknown> })?.acf?.[WP_ITINERARY_FIELD],
      );
      const diff = buildItineraryDiff(art.rows, wpRows);
      const out = {
        tour_id,
        tour_name: art.tour.name,
        wordpress_tour_id: wpId,
        has_changes: diff.changed,
        art_row_count: art.rows.length,
        wordpress_row_count: wpRows.length,
        changed_rows: diff.rows.filter((r) => r.changed).length,
        diff: diff.rows,
      };
      return {
        content: [{
          type: "text",
          text: diff.changed
            ? `${out.changed_rows} of ${diff.rows.length} itinerary rows differ from the website.\n${JSON.stringify(out)}`
            : `The website itinerary already matches ART (${art.rows.length} rows).`,
        }],
        structuredContent: out,
      };
    } catch (err) {
      const c = categoriseError(err);
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});
