import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import {
  ALLOWED_DOCUMENT_TYPES,
  decodeUpload,
  removeFromAttachments,
  signAttachmentUrl,
  toolError,
  uploadToAttachments,
} from "./_uploads";

export default defineTool({
  name: "upload_activity_attachment",
  title: "Upload a file to an activity",
  description:
    "Upload a document or image against an activity (contracts, briefs, tickets, dress code sheets). Provide the file as base64 in `data_base64`, max 20MB. Admin/manager only.",
  inputSchema: {
    activity_id: z.string().describe("The activity id (uuid)."),
    filename: z.string().min(1).max(255).describe("Filename including extension."),
    content_type: z.string().min(1).describe(`MIME type. Allowed: ${ALLOWED_DOCUMENT_TYPES.join(", ")}`),
    data_base64: z.string().min(1).describe("Base64-encoded file contents (no data: prefix)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ activity_id, filename, content_type, data_base64 }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const decoded = decodeUpload({ filename, content_type, data_base64, allowedTypes: ALLOWED_DOCUMENT_TYPES });
    if ("error" in decoded) return decoded.error;

    const supabase = supabaseForUser(ctx);
    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, name")
      .eq("id", activity_id)
      .maybeSingle();
    if (activityError) return toolError(activityError.message);
    if (!activity) return toolError(`No activity found with id ${activity_id}.`);

    const uploaded = await uploadToAttachments(ctx, `activities/${activity_id}`, decoded.file);
    if ("error" in uploaded) return uploaded.error;

    const { data, error } = await supabase
      .from("activity_attachments")
      .insert({
        activity_id,
        file_name: decoded.file.name,
        file_path: uploaded.path,
        file_size: decoded.file.size,
        file_type: decoded.file.contentType,
        uploaded_by: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) {
      await removeFromAttachments(ctx, uploaded.path);
      return toolError(error.message);
    }

    const out = {
      attachment: data,
      activity_name: (activity as { name?: string }).name ?? null,
      signed_url: await signAttachmentUrl(ctx, uploaded.path),
    };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});