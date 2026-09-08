import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ingestExternalLead } from "../_shared/externalLeadIntake.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Native Meta (Facebook/Instagram) Lead Ads webhook.
 *
 * Meta only sends the lead id, so the full answers are fetched from the Graph
 * API and then handed to the SAME generic external intake used by Zapier and
 * partners. No lead-processing logic lives here.
 *
 * Required secrets: META_VERIFY_TOKEN, META_APP_SECRET, META_PAGE_ACCESS_TOKEN.
 * The integration record used is the one with key `meta_lead_ads`.
 */
const hmacHex = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const verifyToken = Deno.env.get("META_VERIFY_TOKEN");
    if (!verifyToken) return json({ error: "Not configured" }, 503);
    if (
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === verifyToken
    )
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    return json({ error: "Verification failed" }, 403);
  }

  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const appSecret = Deno.env.get("META_APP_SECRET");
  const pageToken = Deno.env.get("META_PAGE_ACCESS_TOKEN");
  const raw = await req.text();

  if (!appSecret || !pageToken) {
    console.error("meta-leads-webhook: Meta secrets are not configured");
    return json({ error: "Not configured" }, 503);
  }
  if (raw.length > 128 * 1024) return json({ error: "Payload too large" }, 413);

  const presented = (req.headers.get("x-hub-signature-256") || "").replace("sha256=", "");
  const expected = await hmacHex(appSecret, raw);
  if (!presented || presented !== expected) return json({ error: "Invalid signature" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: integration } = await db
    .from("lead_integrations")
    .select("*")
    .eq("key", "meta_lead_ads")
    .maybeSingle();
  if (!integration || !integration.is_enabled) {
    console.error("meta-leads-webhook: meta_lead_ads integration missing or disabled");
    return json({ ok: true, skipped: true });
  }

  try {
    const body = JSON.parse(raw || "{}");
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const leadgenId = change?.value?.leadgen_id;
        if (!leadgenId) continue;
        const res = await fetch(
          `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${encodeURIComponent(pageToken)}`
        );
        const lead = await res.json();
        if (!res.ok) {
          console.error("meta-leads-webhook graph error:", JSON.stringify(lead).slice(0, 400));
          continue;
        }
        await ingestExternalLead(db, integration, {
          ...lead,
          external_submission_id: String(leadgenId),
          leadgen_id: String(leadgenId),
          form_id: change?.value?.form_id || lead?.form_id || null,
          campaign_id: change?.value?.campaign_id || lead?.campaign_id || null,
          adset_id: change?.value?.adgroup_id || lead?.adset_id || null,
          ad_id: change?.value?.ad_id || lead?.ad_id || null,
          platform: change?.value?.platform || "facebook",
          created_time: lead?.created_time || null,
        });
      }
    }
    // Meta requires a fast 200 regardless of downstream outcome.
    return json({ ok: true });
  } catch (err) {
    console.error("meta-leads-webhook error:", err instanceof Error ? err.message : err);
    return json({ ok: true });
  }
});
