import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";
import { analyseContent } from "../wordpress/_analyzer";

export default defineTool({
  name: "wordpress_get_tour",
  title: "Get WordPress tour",
  description:
    "Fetch a single WordPress tour by ID including raw editable content (context=edit), taxonomies, ACF/meta fields where exposed, and a content analysis flagging YOOtheme/scripts/iframes. Admin/manager only.",
  inputSchema: { tour_id: z.number().int().min(1) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const endpoint = `tour/${tour_id}`;
    try {
      const res = await wordpressRequest<Record<string, unknown>>({ endpoint, query: { context: "edit" } });
      const t = res.data;
      const contentObj = t.content as { raw?: string; rendered?: string } | undefined;
      const excerptObj = t.excerpt as { raw?: string; rendered?: string } | undefined;
      const titleObj = t.title as { raw?: string; rendered?: string } | undefined;
      const analysis = analyseContent(contentObj?.raw ?? contentObj?.rendered ?? "");
      const out = {
        id: t.id,
        title_raw: titleObj?.raw ?? null,
        title_rendered: titleObj?.rendered ?? null,
        slug: t.slug,
        status: t.status,
        link: t.link,
        date: t.date,
        modified: t.modified,
        content_raw: contentObj?.raw ?? null,
        content_rendered: contentObj?.rendered ?? null,
        excerpt_raw: excerptObj?.raw ?? null,
        excerpt_rendered: excerptObj?.rendered ?? null,
        featured_media: t.featured_media,
        categories: t.categories ?? [],
        tags: t.tags ?? [],
        tours: t.tours ?? [],
        menu_order: t.menu_order,
        author: t.author,
        meta: t.meta ?? null,
        acf: (t as { acf?: unknown }).acf ?? null,
        content_analysis: analysis,
      };
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "get_tour",
        wordpress_object_type: "tour",
        wordpress_object_id: tour_id,
        request_summary: requestSummary(endpoint, "GET", { context: "edit" }),
        result_status: "success",
        response_code: res.status,
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "get_tour",
        wordpress_object_type: "tour",
        wordpress_object_id: tour_id,
        request_summary: requestSummary(endpoint, "GET"),
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});