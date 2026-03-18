import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token - must be an itinerary purpose token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*")
      .eq("token", token)
      .eq("purpose", "itinerary")
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid or expired link" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "This link has expired. Please contact us for an updated itinerary." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update use count
    await supabase
      .from("customer_access_tokens")
      .update({ use_count: (tokenData.use_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    // The booking_id links us to the tour
    if (!tokenData.booking_id) {
      return new Response(
        JSON.stringify({ valid: false, error: "No tour information associated with this link" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the tour_id from the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("tour_id")
      .eq("id", tokenData.booking_id)
      .single();

    if (bookingError || !booking?.tour_id) {
      return new Response(
        JSON.stringify({ valid: false, error: "Tour not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tourId = booking.tour_id;

    // Call generate-itinerary-document to get the HTML
    // First find the itinerary for this tour
    const { data: itinerary, error: itineraryError } = await supabase
      .from("tour_itineraries")
      .select("id")
      .eq("tour_id", tourId)
      .limit(1)
      .single();

    if (itineraryError || !itinerary) {
      return new Response(
        JSON.stringify({ valid: false, error: "No itinerary has been created for this tour yet" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate the HTML via the existing function
    const generateResponse = await fetch(
      `${supabaseUrl}/functions/v1/generate-itinerary-document`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          tourId,
          itineraryId: itinerary.id,
          format: "html",
          options: {
            includeHotels: true,
            includeTourInfo: true,
            includeAdditionalInfo: true,
          },
        }),
      }
    );

    if (!generateResponse.ok) {
      throw new Error(`Failed to generate itinerary: ${await generateResponse.text()}`);
    }

    const { html } = await generateResponse.json();

    // Get tour name for the page title
    const { data: tour } = await supabase
      .from("tours")
      .select("name")
      .eq("id", tourId)
      .single();

    return new Response(
      JSON.stringify({
        valid: true,
        html,
        tourName: tour?.name || "Tour Itinerary",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in validate-itinerary-token:", error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
