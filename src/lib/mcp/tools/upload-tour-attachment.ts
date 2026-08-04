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
  name: "upload_tour_attachment",
  title: "Upload a file to a tour",
  description:
    "Upload a document or image against a tour (guest docs, contracts, ops paperwork). Provide the file as base64 in `data_base64`, max 20MB. Appears in the tour's Attachments section. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
    filename: z.string().min(1).max(255).describe("Filename including extension, e.g. 'darwin-cup-guest-doc.pdf'."),
    content_type: z.string().min(1).describe(`MIME type. Allowed: ${ALLOWED_DOCUMENT_TYPES.join(", ")}`),
    data_base64: z.string().min(1).describe("Base64-encoded file contents (no data: prefix)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ tour_id, filename, content_type, data_base64 }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const decoded = decodeUpload({ filename, content_type, data_base64, allowedTypes: ALLOWED_DOCUMENT_TYPES });
    if ("error" in decoded) return decoded.error;

    const supabase = supabaseForUser(ctx);
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("id, name")
      .eq("id", tour_id)
      .maybeSingle();
    if (tourError) return toolError(tourError.message);
    if (!tour) return toolError(`No tour found with id ${tour_id}.`);

    const uploaded = await uploadToAttachments(ctx, `tours/${tour_id}`, decoded.file);
    if ("error" in uploaded) return uploaded.error;

    const { data, error } = await supabase
      .from("tour_attachments")
      .insert({
        tour_id,
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
      tour_name: (tour as { name?: string }).name ?? null,
      signed_url: await signAttachmentUrl(ctx, uploaded.path),
    };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});