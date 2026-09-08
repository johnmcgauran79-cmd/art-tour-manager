import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256Hex } from "../_shared/externalLeadIntake.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const newKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `art_lead_${hex}`;
};

/**
 * Staff-only: generate or rotate an integration API key. The plain key is shown
 * once and never stored — only its SHA-256 hash is kept.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return json({ error: "Not signed in" }, 401);

    const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
      admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      admin.rpc("has_role", { _user_id: user.id, _role: "manager" }),
    ]);
    if (isAdmin !== true && isManager !== true)
      return json({ error: "You don't have access to do this" }, 403);

    const body = await req.json().catch(() => ({}));
    const integrationId = String(body?.integration_id || "");
    const action = String(body?.action || "rotate");
    if (!integrationId) return json({ error: "integration_id required" }, 400);

    const { data: integration } = await admin
      .from("lead_integrations")
      .select("id, name, key")
      .eq("id", integrationId)
      .maybeSingle();
    if (!integration) return json({ error: "Integration not found" }, 404);

    if (action === "revoke") {
      await admin
        .from("lead_integrations")
        .update({ token_hash: null, token_prefix: null, token_rotated_at: new Date().toISOString() })
        .eq("id", integrationId);
      await admin.from("audit_log").insert({
        user_id: user.id,
        operation_type: "lead_integration_key_revoked",
        table_name: "lead_integrations",
        record_id: integrationId,
        details: { integration: integration.key },
      });
      return json({ ok: true, revoked: true });
    }

    const key = newKey();
    const hash = await sha256Hex(key);
    const { error } = await admin
      .from("lead_integrations")
      .update({
        token_hash: hash,
        token_prefix: key.slice(0, 16),
        token_rotated_at: new Date().toISOString(),
      })
      .eq("id", integrationId);
    if (error) throw error;

    await admin.from("audit_log").insert({
      user_id: user.id,
      operation_type: "lead_integration_key_rotated",
      table_name: "lead_integrations",
      record_id: integrationId,
      details: { integration: integration.key },
    });

    return json({ ok: true, api_key: key, prefix: key.slice(0, 16) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("lead-integration-keys error:", msg);
    return json({ error: msg }, 500);
  }
});
