import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  requestWithRetry,
  createInvoiceFetchContext,
  cachedInvoiceFetch,
  backoffDelayMs,
  DEFAULT_RETRY_CONFIG,
  type HttpResponseLike,
} from "../../../src/lib/mcp/tools/_xeroHttp.ts";

// ---- test transport helpers -------------------------------------------------
function resp(status: number, body: any = {}, headers: Record<string, string> = {}): HttpResponseLike {
  return {
    status,
    getHeader: (n: string) => headers[n] ?? headers[n.toLowerCase()] ?? null,
    json: async () => body,
    discardBody: async () => {},
  };
}

const noSleep = async (_ms: number) => {};
const fixedRnd = () => 0; // deterministic backoff

function scriptedFetch(statuses: (number | { status: number; body?: any; headers?: Record<string, string> })[]) {
  const calls: string[] = [];
  const doFetch = async (token: string): Promise<HttpResponseLike> => {
    calls.push(token);
    const next = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    if (typeof next === "number") return resp(next, { Invoices: [{ InvoiceID: "x" }] });
    return resp(next.status, next.body ?? { Invoices: [{ InvoiceID: "x" }] }, next.headers ?? {});
  };
  return { doFetch, calls };
}

// ---- 401 forced-refresh flow -----------------------------------------------
Deno.test("401 then successful refresh + retry succeeds", async () => {
  const { doFetch, calls } = scriptedFetch([401, 200]);
  let refreshes = 0;
  const metrics = { retry_count: 0 };
  const r = await requestWithRetry(doFetch, "old", async () => { refreshes++; return "new"; }, { metrics, sleep: noSleep });
  assert(r.ok);
  assertEquals(refreshes, 1);
  assertEquals(calls, ["old", "new"]); // retried with refreshed token
  assertEquals(metrics.retry_count, 1);
});

Deno.test("401 then refresh failure returns XERO_TOKEN_REFRESH_FAILED", async () => {
  const { doFetch } = scriptedFetch([401, 200]);
  const r = await requestWithRetry(doFetch, "old", async () => null, { sleep: noSleep });
  assert(!r.ok);
  assertEquals(r.code, "XERO_TOKEN_REFRESH_FAILED");
});

Deno.test("401 then second 401 returns XERO_UNAUTHORISED without looping", async () => {
  const { doFetch, calls } = scriptedFetch([401, 401, 401]);
  let refreshes = 0;
  const r = await requestWithRetry(doFetch, "old", async () => { refreshes++; return "new"; }, { sleep: noSleep });
  assert(!r.ok);
  assertEquals(r.code, "XERO_UNAUTHORISED");
  assertEquals(refreshes, 1); // refreshed only once
  assertEquals(calls.length, 2); // initial + one retry, no more
});

// ---- transient 5xx handling -------------------------------------------------
Deno.test("500 then success", async () => {
  const { doFetch, calls } = scriptedFetch([500, 200]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep, rnd: fixedRnd });
  assert(r.ok);
  assertEquals(calls.length, 2);
});

Deno.test("502 then success", async () => {
  const { doFetch } = scriptedFetch([502, 200]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep, rnd: fixedRnd });
  assert(r.ok);
});

Deno.test("repeated 503 stops after configured retry limit", async () => {
  const { doFetch, calls } = scriptedFetch([503, 503, 503, 503, 503]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep, rnd: fixedRnd });
  assert(!r.ok);
  assertEquals(r.code, "INTERNAL_ERROR");
  // initial + max5xxRetries(2) = 3 attempts, then stop
  assertEquals(calls.length, DEFAULT_RETRY_CONFIG.max5xxRetries + 1);
});

Deno.test("504 keeps failing -> non-ok (drives partial results upstream)", async () => {
  const { doFetch } = scriptedFetch([504, 504, 504]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep, rnd: fixedRnd });
  assert(!r.ok);
  assertEquals(r.code, "INTERNAL_ERROR");
});

// ---- non-retryable + terminal codes ----------------------------------------
Deno.test("400 is not retried", async () => {
  const { doFetch, calls } = scriptedFetch([400, 200]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep });
  assert(!r.ok);
  assertEquals(r.code, "INTERNAL_ERROR");
  assertEquals(calls.length, 1); // no retry
});

Deno.test("404 remains XERO_INVOICE_NOT_FOUND and is terminal", async () => {
  const { doFetch, calls } = scriptedFetch([404, 200]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep });
  assert(!r.ok);
  assertEquals(r.code, "XERO_INVOICE_NOT_FOUND");
  assertEquals(calls.length, 1);
});

// ---- 429 bounded behaviour (preserved) -------------------------------------
Deno.test("429 retried then success", async () => {
  const { doFetch, calls } = scriptedFetch([{ status: 429, headers: { "Retry-After": "0" } }, 200]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep });
  assert(r.ok);
  assertEquals(calls.length, 2);
});

Deno.test("repeated 429 stops bounded", async () => {
  const { doFetch, calls } = scriptedFetch([
    { status: 429, headers: { "Retry-After": "0" } },
    { status: 429, headers: { "Retry-After": "0" } },
    { status: 429, headers: { "Retry-After": "0" } },
    { status: 429, headers: { "Retry-After": "0" } },
  ]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep });
  assert(!r.ok);
  assertEquals(r.code, "XERO_RATE_LIMITED");
  assertEquals(calls.length, DEFAULT_RETRY_CONFIG.max429Retries + 1);
});

// ---- combined path cannot loop indefinitely --------------------------------
Deno.test("combined 401 + 429 + 5xx path terminates within global cap", async () => {
  // 401 (refresh), then 429, then 500, then 503 x... always failing
  const { doFetch, calls } = scriptedFetch([
    401,
    { status: 429, headers: { "Retry-After": "0" } },
    500, 502, 503, 504, 500, 502, 503, 504,
  ]);
  const r = await requestWithRetry(doFetch, "t", async () => "n", { sleep: noSleep, rnd: fixedRnd });
  assert(!r.ok);
  assert(calls.length <= DEFAULT_RETRY_CONFIG.globalAttemptCap);
});

// ---- backoff is bounded -----------------------------------------------------
Deno.test("backoff delay is bounded and increases", async () => {
  const d1 = backoffDelayMs(1, fixedRnd);
  const d2 = backoffDelayMs(2, fixedRnd);
  assert(d2 >= d1);
  assert(backoffDelayMs(10, () => 1) <= 3200 + 250);
});

// ---- request-scoped cache ---------------------------------------------------
Deno.test("same InvoiceID across two bookings is fetched once per invocation", async () => {
  const ctx = createInvoiceFetchContext<{ ok: boolean }>();
  let fetches = 0;
  const fetcher = async (_id: string) => { fetches++; return { result: { ok: true }, retryCount: 0 }; };
  // booking 1 references INV-1, booking 2 references INV-1 again
  await cachedInvoiceFetch(ctx, "INV-1", fetcher);
  await cachedInvoiceFetch(ctx, "INV-1", fetcher);
  assertEquals(fetches, 1);
  assertEquals(ctx.metrics.unique_invoice_ids, 1);
  assertEquals(ctx.metrics.invoice_fetch_count, 1);
  assertEquals(ctx.metrics.invoice_cache_hits, 1);
});

Deno.test("cache hit count increments correctly across many references", async () => {
  const ctx = createInvoiceFetchContext<{ ok: boolean }>();
  const fetcher = async (_id: string) => ({ result: { ok: true }, retryCount: 1 });
  await cachedInvoiceFetch(ctx, "A", fetcher); // miss
  await cachedInvoiceFetch(ctx, "B", fetcher); // miss
  await cachedInvoiceFetch(ctx, "A", fetcher); // hit
  await cachedInvoiceFetch(ctx, "A", fetcher); // hit
  await cachedInvoiceFetch(ctx, "B", fetcher); // hit
  assertEquals(ctx.metrics.unique_invoice_ids, 2);
  assertEquals(ctx.metrics.invoice_fetch_count, 2);
  assertEquals(ctx.metrics.invoice_cache_hits, 3);
  assertEquals(ctx.metrics.retry_count, 2); // only counted on actual fetches
});

Deno.test("sanitised failure result is cached to avoid repeated failing requests", async () => {
  const ctx = createInvoiceFetchContext<{ ok: boolean; code?: string }>();
  let fetches = 0;
  const fetcher = async (_id: string) => { fetches++; return { result: { ok: false, code: "INTERNAL_ERROR" }, retryCount: 2 }; };
  const a = await cachedInvoiceFetch(ctx, "F", fetcher);
  const b = await cachedInvoiceFetch(ctx, "F", fetcher);
  assertEquals(fetches, 1);
  assertEquals(a.ok, false);
  assertEquals(b.ok, false);
  assertEquals(ctx.metrics.invoice_cache_hits, 1);
});
