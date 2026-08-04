import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";

export const ATTACHMENTS_BUCKET = "attachments";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function toolError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

function decodeBase64(input: string): Uint8Array {
  const clean = input.includes(",") && input.trim().startsWith("data:")
    ? input.slice(input.indexOf(",") + 1)
    : input;
  if (typeof atob === "function") {
    const bin = atob(clean.replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(
    (globalThis as { Buffer?: { from: (s: string, e: string) => Uint8Array } })
      .Buffer!.from(clean, "base64"),
  );
}

/** Sanitise a filename for safe use inside a storage object key. */
export function safeFileName(filename: string): string {
  const base = filename.split(/[\\/]/).pop() || "file";
  return base.replace(/[^\w.\-]+/g, "_").slice(0, 180);
}

export interface DecodedFile {
  bytes: Uint8Array;
  size: number;
  name: string;
  contentType: string;
}

/**
 * Validate + decode a base64 payload coming from an MCP client.
 * Returns either an error tool result or the decoded file.
 */
export function decodeUpload(args: {
  filename: string;
  content_type: string;
  data_base64: string;
  allowedTypes: readonly string[];
}): { error: ReturnType<typeof toolError> } | { file: DecodedFile } {
  const { filename, content_type, data_base64, allowedTypes } = args;
  if (!allowedTypes.includes(content_type)) {
    return {
      error: toolError(
        `Unsupported content_type '${content_type}'. Allowed: ${allowedTypes.join(", ")}`,
      ),
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(data_base64);
  } catch {
    return { error: toolError("data_base64 is not valid base64.") };
  }
  if (bytes.byteLength === 0) return { error: toolError("Decoded file is empty.") };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return {
      error: toolError(`File exceeds the 20MB limit (${bytes.byteLength} bytes).`),
    };
  }
  return {
    file: {
      bytes,
      size: bytes.byteLength,
      name: safeFileName(filename),
      contentType: content_type,
    },
  };
}

/** Upload decoded bytes into the private `attachments` bucket. */
export async function uploadToAttachments(
  ctx: ToolContext,
  folderPath: string,
  file: DecodedFile,
  opts: { upsert?: boolean } = {},
): Promise<{ error: ReturnType<typeof toolError> } | { path: string }> {
  const path = `${folderPath.replace(/\/+$/, "")}/${Date.now()}-${file.name}`;
  const { error } = await supabaseForUser(ctx)
    .storage.from(ATTACHMENTS_BUCKET)
    .upload(path, file.bytes, {
      contentType: file.contentType,
      upsert: opts.upsert ?? false,
    });
  if (error) return { error: toolError(`Storage upload failed: ${error.message}`) };
  return { path };
}

/** Best-effort cleanup after a failed DB insert so we don't orphan objects. */
export async function removeFromAttachments(ctx: ToolContext, path: string) {
  try {
    await supabaseForUser(ctx).storage.from(ATTACHMENTS_BUCKET).remove([path]);
  } catch {
    /* non-fatal */
  }
}

/** Create a time-limited signed URL for a stored object. */
export async function signAttachmentUrl(
  ctx: ToolContext,
  path: string,
  expiresIn = 3600,
) {
  const { data, error } = await supabaseForUser(ctx)
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}