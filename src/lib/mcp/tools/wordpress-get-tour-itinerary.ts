import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest } from "../wordpress/_client";
import { categoriseError } from "../wordpress/_audit";
import { WP_ITINERARY_FIELD, normaliseWpItineraryRows } from "../wordpress/itinerary";

export default defineTool({
  name: "wordpress_get_tour_itinerary",
  title: "Get WordPress tour itinerary",
  description:
    "Read the live itinerary currently published on a WordPress tour post. Returns the `itinerary` ACF repeater rows in order, each with its `date_event` heading and `details` HTML. Read-only, admin/manager only.",
  inputSchema: {
    tour_id: z.number().int().min(1).describe("The WordPress tour post id (not the ART tour uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    try {
      const res = await wordpressRequest<Record<string, unknown>>({
        endpoint: `tour/${tour_id}`,
        query: { context: "edit", _fields: "id,title,acf" },
      });
      const data = res.data as { id?: number; title?: unknown; acf?: Record<string, unknown> };
      const rows = normaliseWpItineraryRows(data?.acf?.[WP_ITINERARY_FIELD]);
      const out = {
        wordpress_tour_id: tour_id,
        title:
          typeof data?.title === "object" && data?.title
            ? ((data.title as { rendered?: string }).rendered ?? null)
            : (data?.title ?? null),
        row_count: rows.length,
        rows,
      };
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = categoriseError(err);
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});
