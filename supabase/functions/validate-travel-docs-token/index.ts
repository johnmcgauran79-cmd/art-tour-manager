import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateTokenPayload {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token }: ValidateTokenPayload = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token - must be a travel_documents purpose token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*, customers(*)")
      .eq("token", token)
      .eq("purpose", "travel_documents")
      .single();

    if (tokenError || !tokenData) {
      console.log("Token not found or wrong purpose:", tokenError);
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid link" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "This link has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Token must have a booking_id for travel docs
    if (!tokenData.booking_id) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid token - no booking associated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get booking with tour details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, tours(id, name, start_date, end_date)")
      .eq("id", tokenData.booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ valid: false, error: "Booking not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customer = tokenData.customers;

    return new Response(
      JSON.stringify({
        valid: true,
        customer: {
          id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
        },
        booking: {
          id: booking.id,
          passport_number: booking.passport_number,
          passport_expiry_date: booking.passport_expiry_date,
          passport_country: booking.passport_country,
          nationality: booking.nationality,
          id_number: booking.id_number,
        },
        tour: booking.tours,
        expiresAt: tokenData.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in validate-travel-docs-token:", error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
