import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { signAttachmentUrl, toolError } from "./_uploads";

export default defineTool({
  name: "get_attachment_download_url",
  title: "Get a download link for a stored file",
  description:
    "Create a temporary signed download link for a file already stored in the private attachments bucket. Pass the `file_path` returned by any list_*_attachments / upload_* tool. Admin/manager only.",
  inputSchema: {
    file_path: z.string().min(1).describe("Storage object path, e.g. 'tours/<uuid>/1712345678-doc.pdf'."),
    expires_in_seconds: z
      .number()
      .int()
      .min(60)
      .max(604800)
      .optional()
      .describe("Link lifetime in seconds (default 3600, max 604800 = 7 days)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ file_path, expires_in_seconds }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const url = await signAttachmentUrl(ctx, file_path, expires_in_seconds ?? 3600);
    if (!url) return toolError(`Could not create a signed URL for '${file_path}'. Check the path exists.`);
    const out = { file_path, signed_url: url, expires_in_seconds: expires_in_seconds ?? 3600 };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});