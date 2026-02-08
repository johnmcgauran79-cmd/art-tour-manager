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
      return new Response(
        JSON.stringify({ valid: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token - must be a waiver purpose token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*, customers(*)")
      .eq("token", token)
      .eq("purpose", "waiver")
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid link" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "This link has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenData.booking_id) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid token - no booking associated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get booking with passengers and tour
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id, passenger_count,
        tours(id, name, start_date, end_date),
        lead_passenger:customers!lead_passenger_id(id, first_name, last_name, email),
        passenger_2:customers!passenger_2_id(id, first_name, last_name, email),
        passenger_3:customers!passenger_3_id(id, first_name, last_name, email)
      `)
      .eq("id", tokenData.booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ valid: false, error: "Booking not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if waiver already signed
    const { data: existingWaivers } = await supabase
      .from("booking_waivers")
      .select("id, passenger_slot, signed_name, signed_at")
      .eq("booking_id", booking.id)
      .eq("customer_id", tokenData.customer_id);

    const alreadySigned = (existingWaivers || []).length > 0;

    // Get waiver text and version from settings
    const { data: waiverTextSetting } = await supabase
      .from("general_settings")
      .select("setting_value")
      .eq("setting_key", "waiver_form_text")
      .single();

    const { data: waiverVersionSetting } = await supabase
      .from("general_settings")
      .select("setting_value")
      .eq("setting_key", "waiver_form_version")
      .single();

    const waiverText = waiverTextSetting?.setting_value || "";
    const waiverVersion = waiverVersionSetting?.setting_value || 1;

    // Build passengers list
    const tokenOwnerCustomerId = tokenData.customer_id;
    const passengers: any[] = [];

    const addPassenger = (slot: number, customer: any) => {
      if (!customer) return;
      passengers.push({
        slot,
        customer_id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        has_email: !!customer.email,
        is_token_owner: customer.id === tokenOwnerCustomerId,
      });
    };

    if (booking.lead_passenger) addPassenger(1, booking.lead_passenger);
    if (booking.passenger_count >= 2 && booking.passenger_2) addPassenger(2, booking.passenger_2);
    if (booking.passenger_count >= 3 && booking.passenger_3) addPassenger(3, booking.passenger_3);

    // Token owner can sign for themselves + passengers without email
    const editableSlots = passengers
      .filter(p => p.is_token_owner || !p.has_email)
      .map(p => p.slot);

    // Check which passengers have already signed
    const { data: allWaivers } = await supabase
      .from("booking_waivers")
      .select("passenger_slot, signed_name, signed_at, customer_id")
      .eq("booking_id", booking.id);

    const signedSlots = (allWaivers || []).map((w: any) => ({
      slot: w.passenger_slot,
      signed_name: w.signed_name,
      signed_at: w.signed_at,
    }));

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({
        last_used_at: new Date().toISOString(),
        use_count: tokenData.use_count + 1,
      })
      .eq("id", tokenData.id);

    const customer = tokenData.customers;

    return new Response(
      JSON.stringify({
        valid: true,
        customer: {
          id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
        },
        booking: { id: booking.id, passenger_count: booking.passenger_count },
        tour: booking.tours,
        passengers,
        editableSlots,
        signedSlots,
        alreadySigned,
        waiverText: typeof waiverText === "string" ? waiverText : JSON.stringify(waiverText),
        waiverVersion: typeof waiverVersion === "number" ? waiverVersion : Number(waiverVersion),
        expiresAt: tokenData.expires_at,
        tokenId: tokenData.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in validate-waiver-token:", error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
