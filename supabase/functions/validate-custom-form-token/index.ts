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
      return new Response(JSON.stringify({ valid: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate token - must be custom_form purpose
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*, customers(*)")
      .eq("token", token)
      .eq("purpose", "custom_form")
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid link" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "This link has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!tokenData.booking_id) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid token - no booking associated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get booking with passengers and tour
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id, passenger_count, tour_id,
        tours(id, name, start_date, end_date),
        lead_passenger:customers!lead_passenger_id(id, first_name, last_name, email),
        passenger_2:customers!passenger_2_id(id, first_name, last_name, email),
        passenger_3:customers!passenger_3_id(id, first_name, last_name, email)
      `)
      .eq("id", tokenData.booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ valid: false, error: "Booking not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get custom form - use form_id from token if available, otherwise fall back to tour lookup
    let form: any;
    if (tokenData.form_id) {
      const { data, error } = await supabase
        .from("tour_custom_forms")
        .select("*")
        .eq("id", tokenData.form_id)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ valid: false, error: "Form no longer available" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      form = data;
    } else {
      // Legacy tokens without form_id - find single published form
      const { data, error } = await supabase
        .from("tour_custom_forms")
        .select("*")
        .eq("tour_id", booking.tour_id)
        .eq("is_published", true)
        .limit(1)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ valid: false, error: "No active form for this tour" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      form = data;
    }

    // Get form fields
    const { data: fields } = await supabase
      .from("tour_custom_form_fields")
      .select("*")
      .eq("form_id", form.id)
      .order("sort_order");

    // Get existing responses for this booking + form
    const { data: existingResponses } = await supabase
      .from("tour_custom_form_responses")
      .select("*")
      .eq("form_id", form.id)
      .eq("booking_id", booking.id);

    const responsesMap = new Map(
      (existingResponses || []).map((r: any) => [r.passenger_slot, r.response_data])
    );

    // Build passengers array
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
        existing_response: responsesMap.get(slot) || null,
      });
    };

    if (booking.lead_passenger) addPassenger(1, booking.lead_passenger);
    if (booking.passenger_count >= 2 && booking.passenger_2) addPassenger(2, booking.passenger_2);
    if (booking.passenger_count >= 3 && booking.passenger_3) addPassenger(3, booking.passenger_3);

    let editableSlots: number[];
    if (form.response_mode === 'per_booking') {
      editableSlots = [1];
    } else {
      editableSlots = passengers
        .filter(p => p.is_token_owner || !p.has_email)
        .map(p => p.slot);
    }

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({ last_used_at: new Date().toISOString(), use_count: tokenData.use_count + 1 })
      .eq("id", tokenData.id);

    const customer = tokenData.customers;

    return new Response(JSON.stringify({
      valid: true,
      customer: { id: customer.id, first_name: customer.first_name, last_name: customer.last_name },
      booking: { id: booking.id, passenger_count: booking.passenger_count },
      tour: booking.tours,
      form: { id: form.id, form_title: form.form_title, form_description: form.form_description, response_mode: form.response_mode },
      fields: (fields || []).map((f: any) => ({
        id: f.id, field_label: f.field_label, field_type: f.field_type,
        field_options: f.field_options || [], is_required: f.is_required,
        placeholder: f.placeholder, sort_order: f.sort_order,
      })),
      passengers,
      editableSlots,
      expiresAt: tokenData.expires_at,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error in validate-custom-form-token:", error);
    return new Response(JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
