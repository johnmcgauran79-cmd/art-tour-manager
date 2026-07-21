/// <reference types="node" />

/**
 * Server-side WordPress REST client used by MCP tool handlers and by the
 * wp-content-proxy edge function. Credentials come from environment secrets
 * and never leave the server — never logged, never returned to the caller,
 * never bundled into browser code.
 */

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

export type WordpressEndpoint = (typeof WORDPRESS_ALLOWED_ENDPOINTS)[number];

export class WordpressClientError extends Error {
  readonly status: number;
  readonly category:
    | "unreachable"
    | "timeout"
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "conflict"
    | "validation"
    | "server_error"
    | "unknown";
  readonly detail?: string;

  constructor(
    message: string,
    status: number,
    category: WordpressClientError["category"],
    detail?: string,
  ) {
    super(message);
    this.name = "WordpressClientError";
    this.status = status;
    this.category = category;
    this.detail = detail;
  }
}

function readEnv(name: string): string | undefined {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno;
  const fromDeno = denoEnv?.env?.get?.(name);
  if (fromDeno) return fromDeno;
  if (typeof process !== "undefined" && process.env) return process.env[name];
  return undefined;
}

export interface WordpressConfig {
  baseUrl: string;
  username: string;
  applicationPassword: string;
}

export function loadWordpressConfig(): WordpressConfig {
  const baseUrl = readEnv("WORDPRESS_BASE_URL");
  const username = readEnv("WORDPRESS_USERNAME");
  const applicationPassword = readEnv("WORDPRESS_APPLICATION_PASSWORD");
  if (!baseUrl || !username || !applicationPassword) {
    throw new WordpressClientError(
      "WordPress integration is not configured. Missing WORDPRESS_BASE_URL, WORDPRESS_USERNAME or WORDPRESS_APPLICATION_PASSWORD.",
      500,
      "unknown",
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), username, applicationPassword };
}

function base64(input: string): string {
  if (typeof btoa === "function") return btoa(input);
  // Node fallback
  return Buffer.from(input, "utf8").toString("base64");
}

function buildAuthHeader(cfg: WordpressConfig): string {
  return `Basic ${base64(`${cfg.username}:${cfg.applicationPassword}`)}`;
}

function isAllowedEndpoint(endpoint: string): boolean {
  const first = endpoint.split("/")[0];
  return (WORDPRESS_ALLOWED_ENDPOINTS as readonly string[]).includes(first);
}

export interface WordpressRequestOptions {
  endpoint: string; // e.g. "tour" or "tour/123" or "tour/123/revisions"
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  cfg?: WordpressConfig;
}

export interface WordpressResponse<T = unknown> {
  status: number;
  data: T;
  headers: {
    totalItems?: number;
    totalPages?: number;
  };
}

/**
 * Perform a WordPress REST request. Enforces:
 *  - endpoint allowlist (rejects anything not in WORDPRESS_ALLOWED_ENDPOINTS)
 *  - HTTPS-only base URL
 *  - request timeout (default 15s)
 *  - retries only on network failures / 5xx (default 2)
 *  - sanitised error output (no credentials or Authorization header)
 */
export async function wordpressRequest<T = unknown>(
  opts: WordpressRequestOptions,
): Promise<WordpressResponse<T>> {
  const cfg = opts.cfg ?? loadWordpressConfig();
  const method = opts.method ?? "GET";
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxAttempts = 1 + Math.max(0, opts.retries ?? 2);

  const trimmedEndpoint = opts.endpoint.replace(/^\/+/, "");
  if (!isAllowedEndpoint(trimmedEndpoint)) {
    throw new WordpressClientError(
      `Endpoint '${trimmedEndpoint}' is not on the WordPress integration allowlist.`,
      400,
      "validation",
    );
  }
  if (!cfg.baseUrl.startsWith("https://")) {
    throw new WordpressClientError(
      "WORDPRESS_BASE_URL must be an https URL.",
      500,
      "validation",
    );
  }

  const url = new URL(`${cfg.baseUrl}/wp-json/wp/v2/${trimmedEndpoint}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(cfg),
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

      const total = Number(res.headers.get("X-WP-Total") ?? "");
      const totalPages = Number(res.headers.get("X-WP-TotalPages") ?? "");

      let data: unknown = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          // Non-JSON body (WAF page, HTML error, etc.)
          data = { raw: text.slice(0, 500) };
        }
      }

      if (res.ok) {
        return {
          status: res.status,
          data: data as T,
          headers: {
            totalItems: Number.isFinite(total) ? total : undefined,
            totalPages: Number.isFinite(totalPages) ? totalPages : undefined,
          },
        };
      }

      const category: WordpressClientError["category"] =
        res.status === 401
          ? "unauthorized"
          : res.status === 403
          ? "forbidden"
          : res.status === 404
          ? "not_found"
          : res.status === 409
          ? "conflict"
          : res.status >= 500
          ? "server_error"
          : res.status >= 400
          ? "validation"
          : "unknown";

      const msg = extractWpErrorMessage(data) ??
        `WordPress returned ${res.status} for ${trimmedEndpoint}`;

      if (category === "server_error" && attempt < maxAttempts) {
        lastError = new WordpressClientError(msg, res.status, category);
        await sleep(200 * attempt);
        continue;
      }
      throw new WordpressClientError(msg, res.status, category);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof WordpressClientError) throw err;
      const aborted = (err as { name?: string })?.name === "AbortError";
      const category = aborted ? "timeout" : "unreachable";
      lastError = new WordpressClientError(
        aborted ? "WordPress request timed out." : "WordPress is unreachable.",
        aborted ? 504 : 502,
        category,
      );
      if (attempt < maxAttempts) {
        await sleep(200 * attempt);
        continue;
      }
      throw lastError;
    }
  }
  // Unreachable
  throw lastError instanceof Error
    ? lastError
    : new WordpressClientError("Unknown WordPress error", 500, "unknown");
}

function extractWpErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.message === "string") return d.message;
  if (typeof d.code === "string") return d.code;
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Build a compact log-safe summary of a request. Never includes headers or body.
 */
export function requestSummary(
  endpoint: string,
  method: string,
  query?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    endpoint,
    method,
    query_keys: query ? Object.keys(query).sort() : [],
  };
}