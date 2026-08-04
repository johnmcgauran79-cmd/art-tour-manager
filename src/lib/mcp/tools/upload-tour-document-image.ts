import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import {
  ALLOWED_IMAGE_TYPES,
  decodeUpload,
  removeFromAttachments,
  signAttachmentUrl,
  toolError,
  uploadToAttachments,
} from "./_uploads";

const MAX_DOCUMENT_IMAGES = 10;

export default defineTool({
  name: "upload_tour_document_image",
  title: "Upload a tour guest document image",
  description:
    "Upload an image used in a tour's guest documents (max 10 per tour), with an optional caption. Provide the file as base64 in `data_base64`, max 20MB. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
    filename: z.string().min(1).max(255).describe("Filename including extension, e.g. 'flemington.jpg'."),
    content_type: z.string().min(1).describe(`MIME type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`),
    data_base64: z.string().min(1).describe("Base64-encoded image contents (no data: prefix)."),
    caption: z.string().max(500).optional().describe("Optional caption shown under the image."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ tour_id, filename, content_type, data_base64, caption }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const decoded = decodeUpload({ filename, content_type, data_base64, allowedTypes: ALLOWED_IMAGE_TYPES });
    if ("error" in decoded) return decoded.error;

    const supabase = supabaseForUser(ctx);
    const { data: existing, error: existingError } = await supabase
      .from("tour_document_images")
      .select("id")
      .eq("tour_id", tour_id);
    if (existingError) return toolError(existingError.message);
    const count = existing?.length ?? 0;
    if (count >= MAX_DOCUMENT_IMAGES) {
      return toolError(
        `This tour already has the maximum of ${MAX_DOCUMENT_IMAGES} document images. Delete one before uploading another.`,
      );
    }

    const uploaded = await uploadToAttachments(ctx, `document-images/${tour_id}`, decoded.file, { upsert: true });
    if ("error" in uploaded) return uploaded.error;

    const { data, error } = await supabase
      .from("tour_document_images")
      .insert({
        tour_id,
        file_path: uploaded.path,
        caption: caption || null,
        sort_order: count,
        uploaded_by: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) {
      await removeFromAttachments(ctx, uploaded.path);
      return toolError(error.message);
    }

    const out = { image: data, signed_url: await signAttachmentUrl(ctx, uploaded.path) };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});