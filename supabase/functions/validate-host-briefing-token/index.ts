// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: tokenRow, error } = await supabase
      .from("host_briefing_tokens")
      .select("id, tour_id, host_user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !tokenRow) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid token" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (new Date(tokenRow.expires_at) <= new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: tour } = await supabase
      .from("tours")
      .select("id, name, pickup_location_required")
      .eq("id", tokenRow.tour_id)
      .maybeSingle();

    if (!tour) {
      return new Response(
        JSON.stringify({ valid: false, error: "Tour not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark token as accessed (first view) — does not invalidate it
    if (!tokenRow.used_at) {
      await supabase
        .from("host_briefing_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        tourId: tour.id,
        tourName: tour.name,
        pickupLocationRequired: tour.pickup_location_required ?? false,
        hostUserId: tokenRow.host_user_id,
        expiresAt: tokenRow.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("validate-host-briefing-token error:", err);
    return new Response(
      JSON.stringify({ valid: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});