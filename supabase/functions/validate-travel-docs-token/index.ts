import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateTokenPayload {
  token: string;
}

interface PassengerInfo {
  slot: number;
  customer_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  has_email: boolean;
  is_token_owner: boolean;
  travel_docs: {
    name_as_per_passport: string | null;
    passport_number: string | null;
    passport_expiry_date: string | null;
    passport_country: string | null;
    nationality: string | null;
    date_of_birth: string | null;
  } | null;
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

    // Get booking with all passengers and tour details
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

    // Get existing travel docs for this booking
    const { data: existingDocs } = await supabase
      .from("booking_travel_docs")
      .select("*")
      .eq("booking_id", booking.id);

    const docsMap = new Map(
      (existingDocs || []).map((doc: any) => [doc.passenger_slot, doc])
    );

    // Build passengers array based on passenger_count
    const passengers: PassengerInfo[] = [];
    const tokenOwnerCustomerId = tokenData.customer_id;

    // Helper to add passenger info
    const addPassenger = (slot: number, customer: any) => {
      if (!customer) return;
      
      const existingDoc = docsMap.get(slot);
      passengers.push({
        slot,
        customer_id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        has_email: !!customer.email,
        is_token_owner: customer.id === tokenOwnerCustomerId,
        travel_docs: existingDoc ? {
          name_as_per_passport: existingDoc.name_as_per_passport,
          passport_number: existingDoc.passport_number,
          passport_expiry_date: existingDoc.passport_expiry_date,
          passport_country: existingDoc.passport_country,
          nationality: existingDoc.nationality,
          date_of_birth: existingDoc.date_of_birth,
        } : null,
      });
    };

    // Add lead passenger (slot 1)
    if (booking.lead_passenger) {
      addPassenger(1, booking.lead_passenger);
    }

    // Add passenger 2 (slot 2) if passenger_count >= 2
    if (booking.passenger_count >= 2 && booking.passenger_2) {
      addPassenger(2, booking.passenger_2);
    }

    // Add passenger 3 (slot 3) if passenger_count >= 3
    if (booking.passenger_count >= 3 && booking.passenger_3) {
      addPassenger(3, booking.passenger_3);
    }

    // Determine which passengers this token owner can edit
    // Token owner can edit their own docs + any passenger without email
    const editableSlots = passengers
      .filter(p => p.is_token_owner || !p.has_email)
      .map(p => p.slot);

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({ 
        last_used_at: new Date().toISOString(),
        use_count: tokenData.use_count + 1 
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
        booking: {
          id: booking.id,
          passenger_count: booking.passenger_count,
        },
        tour: booking.tours,
        passengers,
        editableSlots,
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
