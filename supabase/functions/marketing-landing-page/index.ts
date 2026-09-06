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
        "id, slug, title, headline, subheadline, body_html, hero_image_url, fields, consent_text, thank_you_message, thank_you_heading, submit_button_text, is_active, tour_id, form_type, tour_ids, success_redirect_url, show_country, show_travellers, show_previous_traveller, show_preferred_contact, allow_multiple_tours, brand:brands(name, logo_url, color_primary, color_button, color_button_text, company_website, company_phone)"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.is_active) return json({ error: "Page not found" }, 404);

    // Tour options offered on the form: the page's explicit list, or its single
    // linked tour, or (when neither is set) all upcoming published tours.
    const ids: string[] = Array.isArray((data as any).tour_ids)
      ? (data as any).tour_ids
      : [];
    if (!ids.length && data.tour_id) ids.push(data.tour_id);

    let tours: { id: string; name: string; start_date: string | null; end_date: string | null }[] = [];
    if (ids.length) {
      const { data: rows } = await supabase
        .from("tours")
        .select("id, name, start_date, end_date")
        .in("id", ids)
        .order("start_date");
      tours = (rows as any) || [];
    } else {
      const { data: rows } = await supabase
        .from("tours")
        .select("id, name, start_date, end_date")
        .gte("start_date", new Date().toISOString().slice(0, 10))
        .not("status", "in", "(cancelled,archived)")
        .order("start_date")
        .limit(30);
      tours = (rows as any) || [];
    }

    return json({ page: data, tour: tours[0] || null, tours });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("marketing-landing-page error:", msg);
    return json({ error: msg }, 500);
  }
});
