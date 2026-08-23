import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Public preference centre: read and update marketing subscription state by
 * token. Marketing only — never affects booking/transactional email.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const action = String(body?.action || "get");
    if (!/^[a-f0-9]{20,80}$/i.test(token)) return json({ error: "Invalid link" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pref, error } = await supabase
      .from("marketing_preferences")
      .select("id, email, customer_id, subscribed, interests")
      .eq("token", token)
      .maybeSingle();
    if (error) throw error;
    if (!pref) return json({ error: "This link is no longer valid" }, 404);

    if (action === "get") {
      return json({
        email: pref.email,
        subscribed: pref.subscribed,
        interests: pref.interests || [],
      });
    }

    if (action === "update") {
      const subscribed = body?.subscribed === true;
      const interests = Array.isArray(body?.interests)
        ? body.interests.filter((i: unknown) => typeof i === "string").slice(0, 20)
        : [];

      await supabase
        .from("marketing_preferences")
        .update({
          subscribed,
          interests,
          unsubscribed_at: subscribed ? null : new Date().toISOString(),
        })
        .eq("id", pref.id);

      if (pref.customer_id) {
        await supabase
          .from("customers")
          .update({ marketing_consent: subscribed })
          .eq("id", pref.customer_id);
      }

      return json({ ok: true, subscribed, interests });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("marketing-preferences error:", msg);
    return json({ error: msg }, 500);
  }
});
