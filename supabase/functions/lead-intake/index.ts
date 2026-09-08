import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ingestExternalLead,
  resolveIntegrationByToken,
} from "../_shared/externalLeadIntake.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-art-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_BODY_BYTES = 128 * 1024;
const MAX_PER_MINUTE = 120;

/**
 * Generic external lead endpoint (Zapier, Meta via Zapier, partners, any future
 * system). Authenticated with a per-integration API key; the lead itself is
 * processed by the existing Phase 2 intake pipeline.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const length = Number(req.headers.get("content-length") || 0);
    if (length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

    const presented =
      (req.headers.get("x-api-key") || req.headers.get("x-art-api-key") || "").trim() ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

    const { integration, reason } = await resolveIntegrationByToken(db, presented);
    if (!integration) {
      if (reason === "disabled") return json({ error: "This integration is switched off" }, 403);
      return json({ error: "Invalid API key" }, 401);
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
    let body: any;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return json({ error: "Body must be valid JSON" }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ error: "Body must be a JSON object" }, 400);

    // Simple per-integration rate limit.
    const minuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db
      .from("landing_page_submissions")
      .select("id", { count: "exact", head: true })
      .eq("integration_id", integration.id)
      .gte("created_at", minuteAgo);
    if ((count || 0) >= MAX_PER_MINUTE) return json({ error: "Too many requests" }, 429);

    await db
      .from("lead_integrations")
      .update({ token_last_used_at: new Date().toISOString() })
      .eq("id", integration.id);

    const res = await ingestExternalLead(db, integration, body);
    return json(res.body, res.status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("lead-intake error:", msg);
    return json({ error: "We could not record this lead — it has not been stored." }, 500);
  }
});
