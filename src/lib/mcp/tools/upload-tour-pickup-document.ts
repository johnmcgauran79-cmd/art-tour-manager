import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { ALLOWED_DOCUMENT_TYPES, decodeUpload, toolError } from "./_uploads";

// The pickup/arrival document must be readable by guests straight from an
// email, so it lives in the public `email-attachments` bucket (same as the UI).
const BUCKET = "email-attachments";

export default defineTool({
  name: "upload_tour_pickup_document",
  title: "Upload tour pickup/arrival document",
  description:
    "Upload the tour's Pickup/Arrival document (e.g. an arrivals map PDF) and attach it to the tour. Provide the file as base64 in `data_base64`, max 20MB. Replaces any existing pickup document. Returns a public URL you can hyperlink from the Pickup/Arrival message (e.g. 'For further details, see map here.'). Set `insert_link_text` to append that hyperlink to the message automatically. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
    filename: z.string().min(1).max(255).describe("Filename including extension, e.g. 'sydney-arrivals-map.pdf'."),
    content_type: z.string().min(1).describe(`MIME type. Allowed: ${ALLOWED_DOCUMENT_TYPES.join(", ")}`),
    data_base64: z.string().min(1).describe("Base64-encoded file contents (no data: prefix)."),
    insert_link_text: z
      .string()
      .optional()
      .describe("Optional link text, e.g. 'see map here'. When supplied, a paragraph hyperlinking the document is appended to the Pickup/Arrival message."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ tour_id, filename, content_type, data_base64, insert_link_text }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const decoded = decodeUpload({
      filename,
      content_type,
      data_base64,
      allowedTypes: ALLOWED_DOCUMENT_TYPES,
    });
    if ("error" in decoded) return decoded.error;

    const supabase = supabaseForUser(ctx);
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("id, name, pickup_arrival_doc_path, pickup_arrival_message")
      .eq("id", tour_id)
      .maybeSingle();
    if (tourError) return toolError(tourError.message);
    if (!tour) return toolError(`No tour found with id ${tour_id}.`);

    const previous = (tour as { pickup_arrival_doc_path?: string | null }).pickup_arrival_doc_path ?? null;
    const path = `pickup-docs/${tour_id}/${Date.now()}-${decoded.file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, decoded.file.bytes, {
        contentType: decoded.file.contentType,
        upsert: true,
      });
    if (uploadError) return toolError(`Storage upload failed: ${uploadError.message}`);

    const public_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const payload: Record<string, unknown> = {
      pickup_arrival_doc_path: path,
      pickup_arrival_doc_name: decoded.file.name,
    };
    if (insert_link_text && insert_link_text.trim()) {
      const existing =
        (tour as { pickup_arrival_message?: string | null }).pickup_arrival_message ?? "";
      const anchor = `<p><a href="${public_url}" target="_blank" rel="noopener noreferrer">${insert_link_text.trim()}</a></p>`;
      payload.pickup_arrival_message = existing ? `${existing}\n${anchor}` : anchor;
    }

    const { error } = await supabase.from("tours").update(payload).eq("id", tour_id);
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]).catch?.(() => {});
      return toolError(error.message);
    }
    if (previous && previous !== path) {
      try {
        await supabase.storage.from(BUCKET).remove([previous]);
      } catch {
        /* stale file cleanup is non-fatal */
      }
    }

    const out = {
      tour_id,
      tour_name: (tour as { name?: string }).name ?? null,
      file_name: decoded.file.name,
      file_path: path,
      file_size: decoded.file.size,
      public_url,
      link_inserted: !!(insert_link_text && insert_link_text.trim()),
    };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});
