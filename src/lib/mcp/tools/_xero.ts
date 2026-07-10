/// <reference types="node" />
import { createClient } from "@supabase/supabase-js";
import type { XeroErrorCode } from "./_xeroLogic";
import {
  requestWithRetry,
  type HttpResponseLike,
  type RequestMetrics,
} from "./_xeroHttp";

/**
 * Service-role Xero accessor.
 *
 * The service-role client is used ONLY to: read stored Xero credentials,
 * refresh+persist Xero OAuth tokens, and make authorised server-side Xero API
 * calls. Callers MUST have already passed assertFinancialAccess (and any
 * booking/tour access check) before any function here is invoked. Nothing in
 * this module is exposed to the browser or the MCP client, and tokens/secrets
 * are never returned or logged.
 *
 * NOTE (tech debt): the token-refresh logic below intentionally duplicates
 * getValidAccessToken from supabase/functions/xero-webhook and
 * xero-create-invoice. Those production functions are deliberately left
 * untouched in this phase; a later task should extract one shared module.
 */

export interface XeroAuth {
  token: string;
  tenantId: string;
}

// strictNullChecks is off in this project, so discriminated unions do not
// narrow. Use a single shape with optional fields.
export interface XeroResult<T> {
  ok: boolean;
  data?: T;
  code?: XeroErrorCode;
}

function serviceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function refreshAccessToken(
  supabase: ReturnType<typeof serviceClient>,
  settings: any,
): Promise<string | null> {
  const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
  const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) return null;

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: settings.refresh_token,
      }),
    });
  } catch {
    return null;
  }

  if (!tokenResponse.ok) {
    await tokenResponse.text().catch(() => {});
    return null;
  }

  const tokens = await tokenResponse.json();
  // Concurrency guard: only overwrite the stored tokens if the refresh_token we
  // used is STILL the current one. If a concurrent call already rotated it, our
  // conditional update matches 0 rows and we do not clobber the newer refresh
  // token with an older one. Our freshly minted access token is still valid to
  // return to the caller for the in-flight request.
  await supabase
    .from("xero_integration_settings")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", settings.id)
    .eq("refresh_token", settings.refresh_token);

  return tokens.access_token;
}

/**
 * Force a single token rotation for the mid-call 401 flow. Re-reads the LATEST
 * stored settings (so it uses the newest refresh_token) then refreshes and
 * persists via the concurrency-guarded path. Returns the new access token or
 * null. Never returns/logs the refresh token, client secret or Basic header.
 */
async function forceRefresh(): Promise<string | null> {
  const supabase = serviceClient();
  const { data: settings } = await supabase
    .from("xero_integration_settings")
    .select("*")
    .eq("is_connected", true)
    .maybeSingle();
  if (!settings || !settings.refresh_token) return null;
  return refreshAccessToken(supabase, settings);
}

/**
 * Read the connected Xero integration and return a valid access token +
 * the stored tenant id. The tenant id is always taken from storage — a
 * caller-supplied tenant is never accepted.
 */
export async function getXeroAuth(): Promise<XeroResult<XeroAuth>> {
  const supabase = serviceClient();
  const { data: settings } = await supabase
    .from("xero_integration_settings")
    .select("*")
    .eq("is_connected", true)
    .maybeSingle();

  if (!settings || !settings.refresh_token || !settings.tenant_id) {
    return { ok: false, code: "XERO_NOT_CONNECTED" };
  }

  const expiresAt = new Date(settings.token_expires_at).getTime();
  if (Date.now() >= expiresAt - 300000) {
    const refreshed = await refreshAccessToken(supabase, settings);
    if (!refreshed) return { ok: false, code: "XERO_TOKEN_REFRESH_FAILED" };
    return { ok: true, data: { token: refreshed, tenantId: settings.tenant_id } };
  }

  return { ok: true, data: { token: settings.access_token, tenantId: settings.tenant_id } };
}

/** Options accepted by the read-only Xero GET helpers. */
export interface XeroGetOpts {
  /** Accumulates the number of retries (401/429/5xx) consumed by this request. */
  metrics?: RequestMetrics;
}

/** Wrap a real fetch Response in the transport-agnostic shape the engine uses. */
async function xeroFetch(
  token: string,
  tenantId: string,
  path: string,
): Promise<HttpResponseLike> {
  const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Xero-Tenant-Id": tenantId,
      Accept: "application/json",
    },
  });
  return {
    status: res.status,
    getHeader: (n: string) => res.headers.get(n),
    json: () => res.json(),
    discardBody: async () => {
      await res.text().catch(() => {});
    },
  };
}

/**
 * Authorised GET against the Xero Accounting API with bounded retry handling:
 * one forced token refresh + single retry on 401, bounded transient-5xx retry,
 * and the existing bounded 429 retry. `path` is the part after /api.xro/2.0/
 * (already URL-encoded as needed). Never logs tokens/headers/bodies.
 */
export async function xeroGet(
  auth: XeroAuth,
  path: string,
  opts?: XeroGetOpts,
): Promise<XeroResult<any>> {
  const res = await requestWithRetry(
    (token) => xeroFetch(token, auth.tenantId, path),
    auth.token,
    forceRefresh,
    { metrics: opts?.metrics },
  );
  if (res.ok) return { ok: true, data: res.data };
  // Map the transport code onto the tool-facing XeroErrorCode set.
  const code = (res.code === "XERO_UNAUTHORISED"
    ? "XERO_TOKEN_REFRESH_FAILED"
    : res.code) as XeroErrorCode;
  return { ok: false, code };
}

/** Fetch a single invoice by Xero InvoiceID (full detail incl. line items & payments). */
export async function fetchInvoiceById(
  auth: XeroAuth,
  invoiceId: string,
  opts?: XeroGetOpts,
): Promise<XeroResult<any>> {
  const res = await xeroGet(auth, `Invoices/${encodeURIComponent(invoiceId)}`, opts);
  if (!res.ok) return res;
  const inv = res.data?.Invoices?.[0];
  if (!inv) return { ok: false, code: "XERO_INVOICE_NOT_FOUND" };
  return { ok: true, data: inv };
}

/** Fetch a single invoice by InvoiceNumber, then re-fetch by id for full detail. */
export async function fetchInvoiceByNumber(
  auth: XeroAuth,
  invoiceNumber: string,
  opts?: XeroGetOpts,
): Promise<XeroResult<any>> {
  const where = encodeURIComponent(`InvoiceNumber=="${invoiceNumber.replace(/"/g, "")}"`);
  const res = await xeroGet(auth, `Invoices?where=${where}`, opts);
  if (!res.ok) return res;
  const inv = res.data?.Invoices?.[0];
  if (!inv?.InvoiceID) return { ok: false, code: "XERO_INVOICE_NOT_FOUND" };
  return fetchInvoiceById(auth, inv.InvoiceID, opts);
}