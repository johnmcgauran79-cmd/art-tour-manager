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
 * Public read of a register-interest landing page by slug.
 * Landing pages are staff-only in the database, so anonymous visitors read
 * them through this function instead of the Data API.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug || "").trim().toLowerCase();
    if (!slug || slug.length > 120) return json({ error: "Valid slug required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("landing_pages")
      .select(
        "id, slug, title, headline, subheadline, body_html, hero_image_url, fields, consent_text, thank_you_message, is_active, tour_id, brand:brands(name, logo_url, color_primary, color_button, color_button_text, company_website, company_phone)"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.is_active) return json({ error: "Page not found" }, 404);

    let tour: { id: string; name: string } | null = null;
    if (data.tour_id) {
      const { data: t } = await supabase
        .from("tours")
        .select("id, name")
        .eq("id", data.tour_id)
        .maybeSingle();
      tour = (t as any) || null;
    }

    return json({ page: data, tour });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("marketing-landing-page error:", msg);
    return json({ error: msg }, 500);
  }
});
