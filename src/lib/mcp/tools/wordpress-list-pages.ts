import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";

export default defineTool({
  name: "wordpress_list_pages",
  title: "List WordPress pages",
  description: "List standard WordPress pages. Concise summaries only. Admin/manager only.",
  inputSchema: {
    search: z.string().optional(),
    status: z.string().optional(),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const q = {
      search: input.search,
      status: input.status ?? "publish",
      page: input.page ?? 1,
      per_page: input.per_page ?? 20,
      orderby: "modified",
      order: "desc",
      context: "edit",
      _fields: "id,title,slug,status,link,modified,parent,menu_order",
    };
    try {
      const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint: "pages", query: q });
      const out = {
        page: q.page,
        per_page: q.per_page,
        total_items: res.headers.totalItems ?? null,
        total_pages: res.headers.totalPages ?? null,
        pages: (res.data ?? []).map((p) => ({
          id: p.id,
          title: (p.title as { rendered?: string })?.rendered ?? null,
          slug: p.slug,
          status: p.status,
          link: p.link,
          modified: p.modified,
          parent: p.parent,
          menu_order: p.menu_order,
        })),
      };
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "list_pages",
        wordpress_object_type: "page",
        request_summary: requestSummary("pages", "GET", q),
        result_status: "success",
        response_code: res.status,
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "list_pages",
        wordpress_object_type: "page",
        request_summary: requestSummary("pages", "GET", q),
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});