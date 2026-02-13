import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, pickupOptionId } = await req.json();

    if (!token || !pickupOptionId) {
      return new Response(JSON.stringify({ error: "Token and pickup option are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*")
      .eq("token", token)
      .eq("purpose", "pickup")
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This link has expired" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the pickup option exists
    const { data: option, error: optionError } = await supabase
      .from("tour_pickup_options")
      .select("id")
      .eq("id", pickupOptionId)
      .single();

    if (optionError || !option) {
      return new Response(JSON.stringify({ error: "Invalid pickup option" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update booking with selected pickup option
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ selected_pickup_option_id: pickupOptionId })
      .eq("id", tokenData.booking_id);

    if (updateError) {
      console.error("Error updating booking:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save selection" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({ last_used_at: new Date().toISOString(), use_count: tokenData.use_count + 1 })
      .eq("id", tokenData.id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in submit-pickup-selection:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
