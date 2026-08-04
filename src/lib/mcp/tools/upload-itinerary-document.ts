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

const TARGETS = {
  itinerary_snapshot: {
    folder: "itinerary-snapshots",
    pathColumn: "snapshot_file_path",
    nameColumn: "snapshot_file_name",
  },
  guest_document: {
    folder: "guest-documents",
    pathColumn: "guest_document_file_path",
    nameColumn: "guest_document_file_name",
  },
} as const;

export default defineTool({
  name: "upload_itinerary_document",
  title: "Upload the itinerary snapshot or guest document",
  description:
    "Upload (or replace) a tour's Itinerary Snapshot or Guest Document file on its itinerary. Choose `document` = 'itinerary_snapshot' or 'guest_document'. Any existing file for that slot is replaced and removed from storage. Provide the file as base64 in `data_base64`, max 20MB. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
    document: z
      .enum(["itinerary_snapshot", "guest_document"])
      .describe("Which slot to fill: 'itinerary_snapshot' or 'guest_document'."),
    filename: z.string().min(1).max(255).describe("Filename including extension, usually a PDF."),
    content_type: z.string().min(1).describe(`MIME type. Allowed: ${ALLOWED_DOCUMENT_TYPES.join(", ")}`),
    data_base64: z.string().min(1).describe("Base64-encoded file contents (no data: prefix)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ tour_id, document, filename, content_type, data_base64 }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const decoded = decodeUpload({ filename, content_type, data_base64, allowedTypes: ALLOWED_DOCUMENT_TYPES });
    if ("error" in decoded) return decoded.error;

    const target = TARGETS[document];
    const supabase = supabaseForUser(ctx);

    const { data: itinerary, error: itineraryError } = await supabase
      .from("tour_itineraries")
      .select("*")
      .eq("tour_id", tour_id)
      .maybeSingle();
    if (itineraryError) return toolError(itineraryError.message);
    if (!itinerary) {
      return toolError(
        `No itinerary exists for tour ${tour_id}. Create one first with create_itinerary.`,
      );
    }

    const uploaded = await uploadToAttachments(ctx, `${target.folder}/${tour_id}`, decoded.file);
    if ("error" in uploaded) return uploaded.error;

    const { error } = await supabase
      .from("tour_itineraries")
      .update({
        [target.pathColumn]: uploaded.path,
        [target.nameColumn]: decoded.file.name,
      })
      .eq("id", (itinerary as { id: string }).id);
    if (error) {
      await removeFromAttachments(ctx, uploaded.path);
      return toolError(error.message);
    }

    const previousPath = (itinerary as Record<string, unknown>)[target.pathColumn];
    if (typeof previousPath === "string" && previousPath && previousPath !== uploaded.path) {
      await removeFromAttachments(ctx, previousPath);
    }

    const out = {
      tour_id,
      document,
      file_path: uploaded.path,
      file_name: decoded.file.name,
      file_size: decoded.file.size,
      replaced_previous: typeof previousPath === "string" && !!previousPath,
      signed_url: await signAttachmentUrl(ctx, uploaded.path),
    };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});