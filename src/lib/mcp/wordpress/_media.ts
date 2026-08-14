import { loadWordpressConfig, type WordpressConfig } from "./_client";

function b64Auth(user: string, pass: string): string {
  if (typeof btoa === "function") return btoa(`${user}:${pass}`);
  return (globalThis as { Buffer?: { from: (s: string, e: string) => { toString: (enc: string) => string } } })
    .Buffer!.from(`${user}:${pass}`, "utf8")
    .toString("base64");
}

export interface WpMediaUploadResult {
  id: number | null;
  source_url: string | null;
  status: number;
}

/**
 * Upload raw bytes into the WordPress media library and (optionally) set the
 * attachment title/caption. Credentials never leave the server.
 */
export async function uploadWpMedia(args: {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  title?: string | null;
  caption?: string | null;
  cfg?: WordpressConfig;
}): Promise<{ error: string; status?: number } | WpMediaUploadResult> {
  const cfg = args.cfg ?? loadWordpressConfig();
  if (!cfg.baseUrl.startsWith("https://")) return { error: "WORDPRESS_BASE_URL must be an https URL." };

  const safeName = args.filename.replace(/[^\w.\-]+/g, "_").slice(0, 180) || "photo.jpg";
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2/media`;
  const auth = `Basic ${b64Auth(cfg.username, cfg.applicationPassword)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": args.contentType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      Accept: "application/json",
      "User-Agent": "ART-Admin-WordPress-Integration/1.0",
    },
    body: args.bytes as BodyInit,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }
  if (!res.ok) {
    return {
      error: (data as { message?: string })?.message ?? `WordPress returned ${res.status} uploading media.`,
      status: res.status,
    };
  }

  const id = (data as { id?: number }).id ?? null;
  if (id && (args.title || args.caption)) {
    try {
      await fetch(`${url}/${id}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...(args.title ? { title: args.title } : {}),
          ...(args.caption ? { caption: args.caption, alt_text: args.caption } : {}),
        }),
      });
    } catch { /* non-fatal */ }
  }

  return { id, source_url: (data as { source_url?: string }).source_url ?? null, status: res.status };
}
