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

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ valid: false, error: "Token is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*, customers(*)")
      .eq("token", token)
      .eq("purpose", "pickup")
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid link" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "This link has expired" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tokenData.booking_id) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid token - no booking associated" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get booking with tour
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, selected_pickup_option_id, tours(id, name, start_date, end_date)")
      .eq("id", tokenData.booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ valid: false, error: "Booking not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pickup options for this tour
    const tourId = (booking.tours as any)?.id;
    const { data: pickupOptions } = await supabase
      .from("tour_pickup_options")
      .select("id, name, pickup_time, details")
      .eq("tour_id", tourId)
      .order("sort_order", { ascending: true });

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({ last_used_at: new Date().toISOString(), use_count: tokenData.use_count + 1 })
      .eq("id", tokenData.id);

    const customer = tokenData.customers;

    return new Response(
      JSON.stringify({
        valid: true,
        customer: { first_name: customer.first_name, last_name: customer.last_name },
        tour: booking.tours,
        pickupOptions: pickupOptions || [],
        currentSelection: booking.selected_pickup_option_id,
        expiresAt: tokenData.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in validate-pickup-token:", error);
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
