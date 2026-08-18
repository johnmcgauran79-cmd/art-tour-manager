import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest } from "../wordpress/_client";
import { categoriseError } from "../wordpress/_audit";
import {
  WP_INCLUSIONS_FIELD,
  WP_EXCLUSIONS_FIELD,
  buildItemsDiff,
  detectRowShape,
  normaliseWpItems,
  htmlEqual,
  describeDescriptionMismatch,
} from "../wordpress/inclusions";
import { loadArtInclusions } from "../wordpress/_inclusionsArt";
import { loadWordpressTourLink } from "../wordpress/_itineraryArt";

export default defineTool({
  name: "wordpress_preview_tour_inclusions",
  title: "Preview inclusions push to website",
  description:
    "Dry run before publishing inclusions/exclusions/description: diffs the ART lists and Website Description against what is live on the linked WordPress tour page. Changes nothing. Show the diff to the user, then call `wordpress_push_tour_inclusions` with confirm=true. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    wordpress_tour_id: z.number().int().min(1).optional().describe("Override the WordPress tour post id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id, wordpress_tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const art = await loadArtInclusions(ctx, tour_id);
    if ("error" in art) return { content: [{ type: "text", text: art.error }], isError: true };

    let wpId = wordpress_tour_id ?? null;
    if (!wpId) {
      const linked = await loadWordpressTourLink(ctx, tour_id);
      if ("error" in linked) return { content: [{ type: "text", text: linked.error }], isError: true };
      wpId = (linked.link as { wp_tour_id?: number | null } | null)?.wp_tour_id ?? null;
    }
    if (!wpId) {
      return {
        content: [{ type: "text", text: "This tour is not linked to a WordPress tour post. Pass wordpress_tour_id or link the tour first." }],
        isError: true,
      };
    }

    try {
      const res = await wordpressRequest<Record<string, unknown>>({
        endpoint: `tour/${wpId}`,
        query: { context: "edit", _fields: "id,acf,content" },
      });
      const acf = (res.data as { acf?: Record<string, unknown> })?.acf ?? {};
      const wpDescription =
        ((res.data as { content?: { raw?: string; rendered?: string } })?.content?.raw ??
          (res.data as { content?: { rendered?: string } })?.content?.rendered ??
          "") as string;
      const inclusions = buildItemsDiff(art.inclusions, normaliseWpItems(acf[WP_INCLUSIONS_FIELD]));
      const exclusions = buildItemsDiff(art.exclusions, normaliseWpItems(acf[WP_EXCLUSIONS_FIELD]));
      const descriptionChanged =
        art.website_description.trim().length > 0 && !htmlEqual(art.website_description, wpDescription);
      const out = {
        tour_id,
        tour_name: art.tour.name,
        wordpress_tour_id: wpId,
        inclusions,
        exclusions,
        description: { changed: descriptionChanged, art_empty: art.website_description.trim().length === 0 },
        description_mismatch: describeDescriptionMismatch(art.website_description, art.inclusions),
        row_shape_known: {
          inclusions: detectRowShape(acf[WP_INCLUSIONS_FIELD]) !== null,
          exclusions: detectRowShape(acf[WP_EXCLUSIONS_FIELD]) !== null,
        },
        has_changes: inclusions.changed || exclusions.changed || descriptionChanged,
      };
      return {
        content: [{
          type: "text",
          text: out.has_changes
            ? `Differences found against the website.\n${JSON.stringify(out)}`
            : "The website already matches ART for inclusions, exclusions and the description.",
        }],
        structuredContent: out,
      };
    } catch (err) {
      const c = categoriseError(err);
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});
