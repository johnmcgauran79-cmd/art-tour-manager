import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";

export default defineTool({
  name: "wordpress_list_tours",
  title: "List WordPress tours",
  description:
    "List tours from the public WordPress site (custom post type 'tour'). Returns concise summaries only — no full HTML content. Admin/manager only.",
  inputSchema: {
    search: z.string().optional(),
    status: z.string().optional().describe("Default 'publish'."),
    category_id: z.number().int().optional(),
    tour_taxonomy_id: z.number().int().optional(),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(50).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    orderby: z.enum(["date", "modified", "title", "menu_order"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const query = {
      search: input.search,
      status: input.status ?? "publish",
      categories: input.category_id,
      tours: input.tour_taxonomy_id,
      page: input.page ?? 1,
      per_page: input.per_page ?? 20,
      order: input.order ?? "desc",
      orderby: input.orderby ?? "modified",
      context: "edit",
      _fields:
        "id,title,slug,status,link,modified,excerpt,featured_media,categories,tags,tours,menu_order",
    };
    try {
      const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint: "tour", query });
      const summary = {
        page: query.page,
        per_page: query.per_page,
        total_items: res.headers.totalItems ?? null,
        total_pages: res.headers.totalPages ?? null,
        tours: (res.data ?? []).map((t) => ({
          id: t.id,
          title: (t.title as { rendered?: string })?.rendered ?? null,
          slug: t.slug,
          status: t.status,
          link: t.link,
          modified: t.modified,
          excerpt: (t.excerpt as { rendered?: string })?.rendered ?? null,
          featured_media: t.featured_media,
          categories: t.categories ?? [],
          tours: t.tours ?? [],
          menu_order: t.menu_order,
        })),
      };
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "list_tours",
        wordpress_object_type: "tour",
        request_summary: requestSummary("tour", "GET", query),
        result_status: "success",
        response_code: res.status,
      });
      return { content: [{ type: "text", text: JSON.stringify(summary) }], structuredContent: summary };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "list_tours",
        wordpress_object_type: "tour",
        request_summary: requestSummary("tour", "GET", query),
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});