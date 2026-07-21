import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";
import { analyseContent } from "../wordpress/_analyzer";

export default defineTool({
  name: "wordpress_get_page",
  title: "Get WordPress page",
  description:
    "Fetch a WordPress page by ID with raw and rendered content plus a content analysis flagging YOOtheme layouts and other builder markers. Admin/manager only.",
  inputSchema: { page_id: z.number().int().min(1) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ page_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const endpoint = `pages/${page_id}`;
    try {
      const res = await wordpressRequest<Record<string, unknown>>({ endpoint, query: { context: "edit" } });
      const p = res.data;
      const contentObj = p.content as { raw?: string; rendered?: string } | undefined;
      const titleObj = p.title as { raw?: string; rendered?: string } | undefined;
      const analysis = analyseContent(contentObj?.raw ?? contentObj?.rendered ?? "");
      const out = {
        id: p.id,
        title_raw: titleObj?.raw ?? null,
        title_rendered: titleObj?.rendered ?? null,
        slug: p.slug,
        status: p.status,
        link: p.link,
        modified: p.modified,
        parent: p.parent,
        menu_order: p.menu_order,
        content_raw: contentObj?.raw ?? null,
        content_rendered: contentObj?.rendered ?? null,
        contains_yootheme_layout: analysis.contains_yootheme_layout,
        editable_content_type: analysis.editable_content_type,
        content_analysis: analysis,
      };
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "get_page",
        wordpress_object_type: "page",
        wordpress_object_id: page_id,
        request_summary: requestSummary(endpoint, "GET"),
        result_status: "success",
        response_code: res.status,
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "get_page",
        wordpress_object_type: "page",
        wordpress_object_id: page_id,
        request_summary: requestSummary(endpoint, "GET"),
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});