import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";

export default defineTool({
  name: "wordpress_get_media",
  title: "Get WordPress media item",
  description: "Fetch a WordPress media item by ID. Admin/manager only.",
  inputSchema: { media_id: z.number().int().min(1) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ media_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const endpoint = `media/${media_id}`;
    try {
      const res = await wordpressRequest<Record<string, unknown>>({ endpoint, query: { context: "edit" } });
      const m = res.data;
      const titleObj = m.title as { rendered?: string } | undefined;
      const captionObj = m.caption as { rendered?: string } | undefined;
      const out = {
        id: m.id,
        title: titleObj?.rendered ?? null,
        filename: (m.media_details as { file?: string } | undefined)?.file ?? null,
        mime_type: m.mime_type,
        source_url: m.source_url,
        alt_text: m.alt_text ?? null,
        caption: captionObj?.rendered ?? null,
        media_details: m.media_details ?? null,
        date: m.date,
      };
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "get_media",
        wordpress_object_type: "media",
        wordpress_object_id: media_id,
        request_summary: requestSummary(endpoint, "GET"),
        result_status: "success",
        response_code: res.status,
      });
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "get_media",
        wordpress_object_type: "media",
        wordpress_object_id: media_id,
        request_summary: requestSummary(endpoint, "GET"),
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});