// Shared helpers for the one-off Keap -> Brevo CRM migration and the ongoing
// Brevo connection. Keap is read-only here; nothing in this file writes to Keap.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Verifies the caller is a signed-in admin or manager. */
export async function requireAdminOrManager(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { error: json({ error: "No authorization header" }, 401) };

  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userError || !user) return { error: json({ error: "Invalid authentication" }, 401) };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
  if (!allowed) return { error: json({ error: "Admin or manager access required" }, 403) };

  return { user };
}

// ---------------------------------------------------------------------------
// Keap (read-only)
// ---------------------------------------------------------------------------

const KEAP_API_BASE = "https://api.infusionsoft.com/crm/rest/v1";

export async function keapGet(path: string) {
  const key = Deno.env.get("KEAP_API_KEY");
  if (!key) throw new Error("KEAP_API_KEY is not configured");
  const res = await fetch(`${KEAP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (res.status === 429) throw new Error(`Keap API error [429]: rate limited`);
  if (!res.ok) throw new Error(`Keap API error [${res.status}]: ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Australian-first international phone formatting, mirroring the app rules. */
export function formatPhoneIntl(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  digits = digits.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("61")) return `+${digits}`;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  if (digits.length === 9) return `+61${digits}`;
  if (digits.length === 10) return `+61${digits.slice(1)}`;
  return `+${digits}`;
}

export interface StagedContact {
  keap_contact_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  keap_created_at: string | null;
  opt_in_status: string | null;
  is_blocklisted: boolean;
  raw: unknown;
}

/** Maps a raw Keap contact record into our staging shape. */
export function mapKeapContact(c: any): StagedContact {
  const email = c?.email_addresses?.find((e: any) => e?.email)?.email ?? null;
  const phone = c?.phone_numbers?.find((p: any) => p?.number)?.number ?? null;
  const addr = c?.addresses?.[0] ?? {};
  const optedIn = c?.email_opted_in === true;
  const optStatus: string | null = c?.email_status ?? c?.opt_in_reason ?? null;
  const blocked =
    optedIn === false ||
    /unsubscrib|opt[\s-]?out|hard[\s-]?bounce|non[\s-]?marketable|stop/i.test(optStatus ?? "");

  return {
    keap_contact_id: String(c?.id ?? ""),
    email: email ? String(email).trim().toLowerCase() : null,
    first_name: c?.given_name ?? c?.preferred_name ?? null,
    last_name: c?.family_name ?? null,
    phone: formatPhoneIntl(phone),
    company: c?.company?.company_name ?? null,
    address_line1: addr?.line1 ?? null,
    city: addr?.locality ?? null,
    state: addr?.region ?? null,
    postcode: addr?.zip_code ?? null,
    country: addr?.country_code ?? null,
    keap_created_at: c?.date_created ?? null,
    opt_in_status: optStatus,
    is_blocklisted: !!blocked,
  raw: c,
  };
}

// ---------------------------------------------------------------------------
// Brevo (via the Lovable connector gateway)
// ---------------------------------------------------------------------------

const BREVO_GATEWAY = "https://connector-gateway.lovable.dev/brevo";

export function brevoConfigured() {
  return !!Deno.env.get("LOVABLE_API_KEY") && !!Deno.env.get("BREVO_API_KEY");
}

export async function brevoRequest(
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connectionKey = Deno.env.get("BREVO_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!connectionKey) {
    throw new Error(
      "BREVO_API_KEY is not configured — connect the Brevo account in Lovable first",
    );
  }

  const res = await fetch(`${BREVO_GATEWAY}/${path.replace(/^\//, "")}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Brevo request failed [${res.status}] ${path}: ${text}`);
    throw new Error(`Brevo API error [${res.status}]: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Brevo attribute names must be UPPER_SNAKE_CASE. */
export function brevoAttributeName(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
