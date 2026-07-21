import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";

export default defineTool({
  name: "wordpress_find_tour",
  title: "Find WordPress tour",
  description:
    "Search the WordPress tour custom post type by free text (title/slug/content). Returns likely matches with IDs and public URLs. Admin/manager only.",
  inputSchema: { query: z.string().min(1) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const q = {
      search: query,
      per_page: 20,
      orderby: "relevance",
      status: "publish,draft,pending,future,private",
      context: "edit",
      _fields: "id,title,slug,status,link,modified,excerpt",
    };
    try {
      const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint: "tour", query: q });
      const matches = (res.data ?? []).map((t) => ({
        id: t.id,
        title: (t.title as { rendered?: string })?.rendered ?? null,
        slug: t.slug,
        status: t.status,
        link: t.link,
        modified: t.modified,
      }));
      const out = { count: matches.length, matches };
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "find_tour",
        wordpress_object_type: "tour",
        request_summary: requestSummary("tour", "GET", q),
        result_status: "success",
        response_code: res.status,
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "find_tour",
        wordpress_object_type: "tour",
        request_summary: requestSummary("tour", "GET", q),
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});