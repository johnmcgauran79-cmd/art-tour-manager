import { defineTool } from "@lovable.dev/mcp-js";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";

export default defineTool({
  name: "wordpress_get_taxonomies",
  title: "Get WordPress taxonomies",
  description:
    "Return WordPress standard categories, tags, and the custom 'tours' taxonomy terms with their IDs. Admin/manager only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (_input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const q = { per_page: 100, context: "edit", _fields: "id,name,slug,count,taxonomy" };
    const out: Record<string, unknown> = {};
    const errors: Array<{ where: string; message: string; status: number }> = [];
    for (const endpoint of ["categories", "tags", "tours"] as const) {
      try {
        const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint, query: q });
        out[endpoint] = (res.data ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          count: t.count,
          taxonomy: t.taxonomy,
        }));
      } catch (err) {
        const c = categoriseError(err);
        out[endpoint] = [];
        errors.push({ where: endpoint, message: c.message, status: c.status });
      }
    }
    const result = { ...out, errors };
    await auditWordpressCall(ctx, {
      source: "mcp",
      action: "get_taxonomies",
      request_summary: requestSummary("categories,tags,tours", "GET"),
      result_status: errors.length === 3 ? "error" : "success",
      response_code: errors.length === 3 ? errors[0]?.status ?? 500 : 200,
      error_message: errors.length === 3 ? errors[0]?.message ?? null : null,
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});