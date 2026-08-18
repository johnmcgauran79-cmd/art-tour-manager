import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { supabaseForUser } from "./_supabase";
import { wordpressRequest } from "../wordpress/_client";
import { categoriseError } from "../wordpress/_audit";
import {
  WP_INCLUSIONS_FIELD,
  WP_EXCLUSIONS_FIELD,
  normaliseWpItems,
  sanitiseInlineHtml,
} from "../wordpress/inclusions";
import { loadWordpressTourLink } from "../wordpress/_itineraryArt";

export default defineTool({
  name: "wordpress_pull_tour_inclusions",
  title: "Import inclusions from website",
  description:
    "One-time import: reads the live WordPress tour page's inclusions, exclusions and Tour Details description and copies them into ART for that tour. Call without confirm to preview what would be imported; call with confirm=true to write (this REPLACES the tour's ART lists). Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    confirm: z.boolean().optional().describe("true to write the imported content into ART. Omit to preview."),
    wordpress_tour_id: z.number().int().min(1).optional().describe("Override the WordPress tour post id."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id, confirm, wordpress_tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

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
      const inclusions = normaliseWpItems(acf[WP_INCLUSIONS_FIELD]).map((s) => sanitiseInlineHtml(s));
      const exclusions = normaliseWpItems(acf[WP_EXCLUSIONS_FIELD]).map((s) => sanitiseInlineHtml(s));
      const description =
        ((res.data as { content?: { raw?: string; rendered?: string } })?.content?.raw ??
          (res.data as { content?: { rendered?: string } })?.content?.rendered ??
          "") as string;

      if (confirm !== true) {
        const preview = { tour_id, wordpress_tour_id: wpId, preview: true, inclusions, exclusions, description };
        return {
          content: [{
            type: "text",
            text: `Would import ${inclusions.length} inclusion(s), ${exclusions.length} exclusion(s) and the description. Call again with confirm=true to write.\n${JSON.stringify(preview)}`,
          }],
          structuredContent: preview,
        };
      }

      const supabase = supabaseForUser(ctx);
      const del = await supabase.from("tour_inclusion_items").delete().eq("tour_id", tour_id);
      if (del.error) return { content: [{ type: "text", text: del.error.message }], isError: true };
      const rows = [
        ...inclusions.map((content_html, i) => ({ tour_id, kind: "inclusion", content_html, sort_order: i })),
        ...exclusions.map((content_html, i) => ({ tour_id, kind: "exclusion", content_html, sort_order: i })),
      ];
      if (rows.length > 0) {
        const { error } = await supabase.from("tour_inclusion_items").insert(rows);
        if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      }
      if (description.trim().length > 0) {
        const { error } = await supabase.from("tours").update({ website_description: description }).eq("id", tour_id);
        if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      }

      const out = {
        tour_id,
        wordpress_tour_id: wpId,
        imported_inclusions: inclusions.length,
        imported_exclusions: exclusions.length,
        imported_description: description.trim().length > 0,
      };
      return {
        content: [{ type: "text", text: `Imported ${inclusions.length} inclusion(s) and ${exclusions.length} exclusion(s) into ART.` }],
        structuredContent: out,
      };
    } catch (err) {
      const c = categoriseError(err);
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});
