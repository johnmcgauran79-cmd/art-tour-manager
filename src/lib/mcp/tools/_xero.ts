/// <reference types="node" />
import { createClient } from "@supabase/supabase-js";
import type { XeroErrorCode } from "./_xeroLogic";

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

export type XeroResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: XeroErrorCode };

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
  await supabase
    .from("xero_integration_settings")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", settings.id);

  return tokens.access_token;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Authorised GET against the Xero Accounting API with bounded 429 retry.
 * `path` is the part after /api.xro/2.0/ (already URL-encoded as needed).
 * Returns parsed JSON on success. Never logs tokens/headers/bodies.
 */
export async function xeroGet(
  auth: XeroAuth,
  path: string,
  maxRetries = 3,
): Promise<XeroResult<any>> {
  const headers = {
    Authorization: `Bearer ${auth.token}`,
    "Xero-Tenant-Id": auth.tenantId,
    Accept: "application/json",
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, { headers });
    } catch {
      return { ok: false, code: "INTERNAL_ERROR" };
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      await res.text().catch(() => {});
      if (attempt === maxRetries - 1) return { ok: false, code: "XERO_RATE_LIMITED" };
      await sleep(Math.min(Math.max(retryAfter, 1) * 1000, 10000));
      continue;
    }
    if (res.status === 404) {
      await res.text().catch(() => {});
      return { ok: false, code: "XERO_INVOICE_NOT_FOUND" };
    }
    if (!res.ok) {
      await res.text().catch(() => {});
      return { ok: false, code: "INTERNAL_ERROR" };
    }
    const data = await res.json();
    return { ok: true, data };
  }
  return { ok: false, code: "XERO_RATE_LIMITED" };
}

/** Fetch a single invoice by Xero InvoiceID (full detail incl. line items & payments). */
export async function fetchInvoiceById(
  auth: XeroAuth,
  invoiceId: string,
): Promise<XeroResult<any>> {
  const res = await xeroGet(auth, `Invoices/${encodeURIComponent(invoiceId)}`);
  if (!res.ok) return res;
  const inv = res.data?.Invoices?.[0];
  if (!inv) return { ok: false, code: "XERO_INVOICE_NOT_FOUND" };
  return { ok: true, data: inv };
}

/** Fetch a single invoice by InvoiceNumber, then re-fetch by id for full detail. */
export async function fetchInvoiceByNumber(
  auth: XeroAuth,
  invoiceNumber: string,
): Promise<XeroResult<any>> {
  const where = encodeURIComponent(`InvoiceNumber=="${invoiceNumber.replace(/"/g, "")}"`);
  const res = await xeroGet(auth, `Invoices?where=${where}`);
  if (!res.ok) return res;
  const inv = res.data?.Invoices?.[0];
  if (!inv?.InvoiceID) return { ok: false, code: "XERO_INVOICE_NOT_FOUND" };
  return fetchInvoiceById(auth, inv.InvoiceID);
}