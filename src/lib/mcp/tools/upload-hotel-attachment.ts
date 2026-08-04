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
  name: "upload_hotel_attachment",
  title: "Upload a file to a hotel",
  description:
    "Upload a document or image against a hotel (contracts, rooming confirmations, invoices). Provide the file as base64 in `data_base64`, max 20MB. Admin/manager only.",
  inputSchema: {
    hotel_id: z.string().describe("The hotel id (uuid)."),
    filename: z.string().min(1).max(255).describe("Filename including extension."),
    content_type: z.string().min(1).describe(`MIME type. Allowed: ${ALLOWED_DOCUMENT_TYPES.join(", ")}`),
    data_base64: z.string().min(1).describe("Base64-encoded file contents (no data: prefix)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ hotel_id, filename, content_type, data_base64 }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const decoded = decodeUpload({ filename, content_type, data_base64, allowedTypes: ALLOWED_DOCUMENT_TYPES });
    if ("error" in decoded) return decoded.error;

    const supabase = supabaseForUser(ctx);
    const { data: hotel, error: hotelError } = await supabase
      .from("hotels")
      .select("id, name")
      .eq("id", hotel_id)
      .maybeSingle();
    if (hotelError) return toolError(hotelError.message);
    if (!hotel) return toolError(`No hotel found with id ${hotel_id}.`);

    const uploaded = await uploadToAttachments(ctx, `hotels/${hotel_id}`, decoded.file);
    if ("error" in uploaded) return uploaded.error;

    const { data, error } = await supabase
      .from("hotel_attachments")
      .insert({
        hotel_id,
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
      hotel_name: (hotel as { name?: string }).name ?? null,
      signed_url: await signAttachmentUrl(ctx, uploaded.path),
    };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});