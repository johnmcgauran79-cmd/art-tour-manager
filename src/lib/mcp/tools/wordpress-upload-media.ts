import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { loadWordpressConfig, WordpressClientError } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

function b64ToBytes(input: string): Uint8Array {
  // Support browsers/Deno via atob; falls back to Buffer in Node.
  if (typeof atob === "function") {
    const bin = atob(input);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node fallback
  return new Uint8Array(
    (globalThis as { Buffer?: { from: (s: string, e: string) => Uint8Array } })
      .Buffer!.from(input, "base64"),
  );
}

function b64Auth(user: string, pass: string): string {
  if (typeof btoa === "function") return btoa(`${user}:${pass}`);
  return (globalThis as { Buffer?: { from: (s: string, e: string) => { toString: (enc: string) => string } } })
    .Buffer!.from(`${user}:${pass}`, "utf8")
    .toString("base64");
}

export default defineTool({
  name: "wordpress_upload_media",
  title: "Upload a file to the WordPress media library",
  description:
    "Upload a PDF or image (JPEG/PNG/WEBP/GIF) into the connected WordPress site's media library and return the new attachment id + source_url. Max 20MB. Provide the file as base64 in `data_base64`. Typical use: uploading a brochure PDF, then passing the returned id into `wordpress_update_tour_fields` under `acf.attach_brochure_here` (and setting `acf.add_download_brochure` to enable the download button). Admin/manager only; every upload is written to wordpress_integration_audit_logs.",
  inputSchema: {
    filename: z.string().min(1).max(255).describe("Filename including extension, e.g. '2027-darwin-cup-brochure.pdf'."),
    content_type: z.string().min(1).describe("MIME type. Allowed: application/pdf, image/jpeg, image/png, image/webp, image/gif."),
    data_base64: z.string().min(1).describe("Base64-encoded file contents (no data: prefix). Max 20MB after decoding."),
    title: z.string().max(255).optional().describe("Optional attachment title shown in WordPress. Defaults to the filename."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async ({ filename, content_type, data_base64, title }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    if (!ALLOWED_CONTENT_TYPES.has(content_type)) {
      return {
        content: [{
          type: "text",
          text: `Unsupported content_type '${content_type}'. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`,
        }],
        isError: true,
      };
    }

    let bytes: Uint8Array;
    try {
      bytes = b64ToBytes(data_base64);
    } catch {
      return { content: [{ type: "text", text: "data_base64 is not valid base64." }], isError: true };
    }
    if (bytes.byteLength === 0) {
      return { content: [{ type: "text", text: "Decoded file is empty." }], isError: true };
    }
    if (bytes.byteLength > MAX_BYTES) {
      return { content: [{ type: "text", text: `File exceeds 20MB limit (${bytes.byteLength} bytes).` }], isError: true };
    }

    let cfg;
    try {
      cfg = loadWordpressConfig();
    } catch (err) {
      const c = categoriseError(err);
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
    if (!cfg.baseUrl.startsWith("https://")) {
      return { content: [{ type: "text", text: "WORDPRESS_BASE_URL must be an https URL." }], isError: true };
    }

    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    const url = `${cfg.baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2/media`;

    const requestSummary = {
      endpoint: "media",
      method: "POST",
      filename: safeName,
      size: bytes.byteLength,
      content_type,
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${b64Auth(cfg.username, cfg.applicationPassword)}`,
          "Content-Type": content_type,
          "Content-Disposition": `attachment; filename="${safeName}"`,
          Accept: "application/json",
          "User-Agent": "ART-Admin-WordPress-Integration/1.0",
        },
        body: bytes as BodyInit,
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }

      if (!res.ok) {
        const msg = (data as { message?: string })?.message ?? `WordPress returned ${res.status}`;
        await auditWordpressCall(ctx, {
          source: "mcp",
          action: "upload_media",
          wordpress_object_type: "media",
          request_summary: requestSummary,
          result_status: "error",
          response_code: res.status,
          error_message: msg,
        });
        return { content: [{ type: "text", text: msg }], isError: true };
      }

      const attachmentId = (data as { id?: number }).id ?? null;

      // Optionally set title after upload (WP /media POST doesn't accept a title in the binary body).
      if (title && attachmentId) {
        try {
          await fetch(`${url}/${attachmentId}`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${b64Auth(cfg.username, cfg.applicationPassword)}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ title }),
          });
        } catch { /* non-fatal */ }
      }

      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "upload_media",
        wordpress_object_type: "media",
        wordpress_object_id: attachmentId,
        request_summary: requestSummary,
        result_status: "success",
        response_code: res.status,
      });

      const out = {
        id: attachmentId,
        source_url: (data as { source_url?: string }).source_url ?? null,
        mime_type: (data as { mime_type?: string }).mime_type ?? null,
        title: ((data as { title?: { rendered?: string } }).title?.rendered) ?? title ?? safeName,
        size: bytes.byteLength,
      };
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = err instanceof WordpressClientError
        ? { message: err.message, status: err.status }
        : categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "upload_media",
        wordpress_object_type: "media",
        request_summary: requestSummary,
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});