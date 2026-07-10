// Pure, dependency-free Xero HTTP retry + request-scoped cache engine.
//
// This module has NO node/supabase/fetch-provider imports so it can be
// unit-tested directly under Deno with mocked transports. `_xero.ts` wires the
// real `fetch` + service-role token refresh into `requestWithRetry`.
//
// It NEVER stores, returns or logs tokens, refresh tokens, Basic auth headers
// or raw Xero payloads — callers pass a token in and receive parsed JSON out.

export type XeroHttpCode =
  | "XERO_TOKEN_REFRESH_FAILED"
  | "XERO_UNAUTHORISED"
  | "XERO_RATE_LIMITED"
  | "XERO_INVOICE_NOT_FOUND"
  | "INTERNAL_ERROR";

/** Minimal response shape so the engine never touches a concrete Response. */
export interface HttpResponseLike {
  status: number;
  getHeader: (name: string) => string | null;
  json: () => Promise<any>;
  /** Drain/ignore the body so the connection can be reused. Never logged. */
  discardBody: () => Promise<void>;
}

export interface XeroGetResult {
  ok: boolean;
  status?: number;
  data?: any;
  code?: XeroHttpCode;
}

export interface RetryConfig {
  /** Retries AFTER the initial request for HTTP 429. */
  max429Retries: number;
  /** Retries AFTER the initial request for transient 5xx. */
  max5xxRetries: number;
  /** Absolute backstop on total attempts so no path can loop indefinitely. */
  globalAttemptCap: number;
}

// Bounded, documented attempt budgets:
//   normal request : 1 attempt (no retry)
//   401 refresh    : initial + exactly 1 retry after ONE forced refresh (<=2)
//   429 path       : initial + max429Retries (<=3 attempts)
//   transient 5xx  : initial + max5xxRetries (<=3 attempts)
//   global backstop: globalAttemptCap total attempts, whatever the mix
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max429Retries: 2,
  max5xxRetries: 2,
  globalAttemptCap: 8,
};

export const RETRYABLE_5XX = [500, 502, 503, 504];

export interface RequestMetrics {
  retry_count: number;
}

/** Short exponential backoff with jitter, capped for an interactive request. */
export function backoffDelayMs(retryNumber: number, rnd: () => number = Math.random): number {
  const base = Math.min(400 * Math.pow(2, retryNumber - 1), 3200); // 400ms, 800ms, ...
  const jitter = rnd() * 250;
  return Math.round(base + jitter);
}

/**
 * Perform a Xero GET with bounded retry handling:
 *  - a single forced token refresh + one retry on HTTP 401,
 *  - bounded retry on transient 5xx (with backoff+jitter),
 *  - the existing bounded 429 retry (honouring Retry-After),
 *  - no retry for other 4xx (except the single 401 flow), 404 is terminal.
 *
 * `doFetch` receives the CURRENT access token. `forceRefresh` performs exactly
 * one rotation and returns the new token (or null on failure). Neither the
 * token nor any header/payload is ever logged here.
 */
export async function requestWithRetry(
  doFetch: (token: string) => Promise<HttpResponseLike>,
  initialToken: string,
  forceRefresh: () => Promise<string | null>,
  opts?: {
    config?: RetryConfig;
    metrics?: RequestMetrics;
    sleep?: (ms: number) => Promise<void>;
    rnd?: () => number;
  },
): Promise<XeroGetResult> {
  const cfg = opts?.config ?? DEFAULT_RETRY_CONFIG;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const rnd = opts?.rnd ?? Math.random;
  const metrics = opts?.metrics;
  const bump = () => {
    if (metrics) metrics.retry_count++;
  };

  let token = initialToken;
  let refreshed = false; // one forced refresh only, ever
  let retries429 = 0;
  let retries5xx = 0;
  let attempts = 0;

  while (attempts < cfg.globalAttemptCap) {
    attempts++;
    let res: HttpResponseLike;
    try {
      res = await doFetch(token);
    } catch {
      return { ok: false, code: "INTERNAL_ERROR" };
    }
    const status = res.status;

    // ---- Single forced-refresh 401 flow ----
    if (status === 401) {
      await res.discardBody().catch(() => {});
      if (refreshed) {
        // Already refreshed and retried once; do not repeat the cycle.
        return { ok: false, status, code: "XERO_UNAUTHORISED" };
      }
      refreshed = true;
      bump();
      const newToken = await forceRefresh();
      if (!newToken) return { ok: false, status, code: "XERO_TOKEN_REFRESH_FAILED" };
      token = newToken;
      continue; // retry original request exactly once
    }

    // ---- Existing bounded 429 handling (preserved) ----
    if (status === 429) {
      const retryAfter = parseInt(res.getHeader("Retry-After") || "2", 10);
      await res.discardBody().catch(() => {});
      if (retries429 >= cfg.max429Retries) return { ok: false, status, code: "XERO_RATE_LIMITED" };
      retries429++;
      bump();
      await sleep(Math.min(Math.max(retryAfter, 1) * 1000, 10000));
      continue;
    }

    // ---- Bounded transient 5xx handling ----
    if (RETRYABLE_5XX.includes(status)) {
      await res.discardBody().catch(() => {});
      if (retries5xx >= cfg.max5xxRetries) return { ok: false, status, code: "INTERNAL_ERROR" };
      retries5xx++;
      bump();
      await sleep(backoffDelayMs(retries5xx, rnd));
      continue;
    }

    if (status === 404) {
      await res.discardBody().catch(() => {});
      return { ok: false, status, code: "XERO_INVOICE_NOT_FOUND" };
    }

    // Any other non-2xx (incl. non-401 4xx) is terminal and NOT retried.
    if (status < 200 || status >= 300) {
      await res.discardBody().catch(() => {});
      return { ok: false, status, code: "INTERNAL_ERROR" };
    }

    const data = await res.json();
    return { ok: true, status, data };
  }
  // Backstop: should be unreachable given the per-class caps above.
  return { ok: false, code: "INTERNAL_ERROR" };
}

// ---- Request-scoped invoice cache ----------------------------------------
// Exists only for the lifetime of a single MCP tool invocation. Nothing is
// persisted to Supabase, local storage or any other cache. Access tokens and
// raw payloads are never stored — only the already-normalised tool result.

export interface FetchContextMetrics {
  unique_invoice_ids: number;
  invoice_fetch_count: number;
  invoice_cache_hits: number;
  retry_count: number;
}

export interface InvoiceFetchContext<T> {
  cache: Map<string, T>;
  seen: Set<string>;
  metrics: FetchContextMetrics;
}

export function createInvoiceFetchContext<T>(): InvoiceFetchContext<T> {
  return {
    cache: new Map<string, T>(),
    seen: new Set<string>(),
    metrics: {
      unique_invoice_ids: 0,
      invoice_fetch_count: 0,
      invoice_cache_hits: 0,
      retry_count: 0,
    },
  };
}

/**
 * Fetch an invoice at most once per invocation. The same InvoiceID referenced
 * by multiple mappings or bookings is fetched from Xero only once; subsequent
 * references reuse the cached (normalised) result. Successful AND sanitised
 * failure results are cached to prevent repeated failing requests in one call.
 */
export async function cachedInvoiceFetch<T>(
  ctx: InvoiceFetchContext<T>,
  invoiceId: string,
  fetcher: (id: string) => Promise<{ result: T; retryCount: number }>,
): Promise<T> {
  if (!ctx.seen.has(invoiceId)) {
    ctx.seen.add(invoiceId);
    ctx.metrics.unique_invoice_ids++;
  }
  if (ctx.cache.has(invoiceId)) {
    ctx.metrics.invoice_cache_hits++;
    return ctx.cache.get(invoiceId) as T;
  }
  const { result, retryCount } = await fetcher(invoiceId);
  ctx.metrics.invoice_fetch_count++;
  ctx.metrics.retry_count += retryCount;
  ctx.cache.set(invoiceId, result);
  return result;
}
