// Deno-side WordPress REST client for the wp-content-proxy edge function.
// Kept in lockstep with src/lib/mcp/wordpress/_client.ts; edge functions
// cannot import from src/.

export const WORDPRESS_ALLOWED_ENDPOINTS = [
  "tour",
  "pages",
  "media",
  "categories",
  "tags",
  "tours",
  "types",
  "taxonomies",
  "users/me",
] as const;

export class WordpressClientError extends Error {
  status: number;
  category: string;
  constructor(message: string, status: number, category: string) {
    super(message);
    this.name = "WordpressClientError";
    this.status = status;
    this.category = category;
  }
}

export interface WordpressConfig {
  baseUrl: string;
  username: string;
  applicationPassword: string;
}

export function loadWordpressConfig(): WordpressConfig {
  const baseUrl = Deno.env.get("WORDPRESS_BASE_URL");
  const username = Deno.env.get("WORDPRESS_USERNAME");
  const applicationPassword = Deno.env.get("WORDPRESS_APPLICATION_PASSWORD");
  if (!baseUrl || !username || !applicationPassword) {
    throw new WordpressClientError("WordPress integration is not configured.", 500, "unknown");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), username, applicationPassword };
}

function isAllowed(endpoint: string): boolean {
  const list = WORDPRESS_ALLOWED_ENDPOINTS as readonly string[];
  if (list.includes(endpoint)) return true;
  const first = endpoint.split("/")[0];
  return list.includes(first);
}

export interface WpRequestOpts {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
}

export interface WpResponse<T = unknown> {
  status: number;
  data: T;
  totalItems?: number;
  totalPages?: number;
}

export async function wordpressRequest<T = unknown>(opts: WpRequestOpts): Promise<WpResponse<T>> {
  const cfg = loadWordpressConfig();
  const method = opts.method ?? "GET";
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxAttempts = 1 + Math.max(0, opts.retries ?? 2);

  const endpoint = opts.endpoint.replace(/^\/+/, "");
  if (!isAllowed(endpoint)) {
    throw new WordpressClientError(`Endpoint '${endpoint}' not on allowlist.`, 400, "validation");
  }
  if (!cfg.baseUrl.startsWith("https://")) {
    throw new WordpressClientError("WORDPRESS_BASE_URL must be https.", 500, "validation");
  }

  const url = new URL(`${cfg.baseUrl}/wp-json/wp/v2/${endpoint}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${cfg.username}:${cfg.applicationPassword}`)}`,
    Accept: "application/json",
    "User-Agent": "ART-Admin-WordPress-Integration/1.0",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let attempt = 0;
  let lastError: unknown;
  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
      }
      if (res.ok) {
        const total = Number(res.headers.get("X-WP-Total") ?? "");
        const pages = Number(res.headers.get("X-WP-TotalPages") ?? "");
        return {
          status: res.status,
          data: data as T,
          totalItems: Number.isFinite(total) ? total : undefined,
          totalPages: Number.isFinite(pages) ? pages : undefined,
        };
      }
      const category =
        res.status === 401 ? "unauthorized"
        : res.status === 403 ? "forbidden"
        : res.status === 404 ? "not_found"
        : res.status === 409 ? "conflict"
        : res.status >= 500 ? "server_error"
        : "validation";
      const msg = (data && typeof data === "object" && "message" in data && typeof (data as {message: unknown}).message === "string")
        ? (data as { message: string }).message
        : `WordPress returned ${res.status}`;
      if (category === "server_error" && attempt < maxAttempts) {
        lastError = new WordpressClientError(msg, res.status, category);
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
      throw new WordpressClientError(msg, res.status, category);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof WordpressClientError) throw err;
      const aborted = (err as { name?: string })?.name === "AbortError";
      lastError = new WordpressClientError(
        aborted ? "WordPress request timed out." : "WordPress is unreachable.",
        aborted ? 504 : 502,
        aborted ? "timeout" : "unreachable",
      );
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError instanceof Error ? lastError : new WordpressClientError("Unknown error", 500, "unknown");
}