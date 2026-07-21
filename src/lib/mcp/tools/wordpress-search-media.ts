import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";

export default defineTool({
  name: "wordpress_search_media",
  title: "Search WordPress media",
  description: "Search the WordPress media library. Admin/manager only.",
  inputSchema: {
    search: z.string().min(1),
    media_type: z.enum(["image", "video", "audio", "application"]).optional(),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const q = {
      search: input.search,
      media_type: input.media_type,
      page: input.page ?? 1,
      per_page: input.per_page ?? 20,
      orderby: "date",
      order: "desc",
      context: "edit",
      _fields: "id,title,source_url,mime_type,alt_text,date,media_details",
    };
    try {
      const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint: "media", query: q });
      const out = {
        page: q.page,
        per_page: q.per_page,
        total_items: res.headers.totalItems ?? null,
        total_pages: res.headers.totalPages ?? null,
        media: (res.data ?? []).map((m) => ({
          id: m.id,
          title: (m.title as { rendered?: string })?.rendered ?? null,
          source_url: m.source_url,
          mime_type: m.mime_type,
          alt_text: m.alt_text ?? null,
          date: m.date,
          filename: (m.media_details as { file?: string } | undefined)?.file ?? null,
        })),
      };
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "search_media",
        wordpress_object_type: "media",
        request_summary: requestSummary("media", "GET", q),
        result_status: "success",
        response_code: res.status,
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "search_media",
        wordpress_object_type: "media",
        request_summary: requestSummary("media", "GET", q),
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});