import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Submission {
  slot: number;
  customer_id: string | null;
  response_data: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, submissions, formId: requestFormId } = await req.json() as { token: string; submissions: Submission[]; formId?: string };

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return new Response(JSON.stringify({ error: "Submissions are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*, customers(*)")
      .eq("token", token)
      .eq("purpose", "custom_form")
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!tokenData.booking_id) {
      return new Response(JSON.stringify({ error: "Invalid token - no booking associated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bookingId = tokenData.booking_id;

    // Determine form ID: from token, from request body, or from tour lookup
    let resolvedFormId: string;

    if (tokenData.form_id) {
      resolvedFormId = tokenData.form_id;
    } else if (requestFormId) {
      resolvedFormId = requestFormId;
    } else {
      // Legacy fallback: find single published form for the tour
      const { data: booking } = await supabase
        .from("bookings")
        .select("tour_id")
        .eq("id", bookingId)
        .single();

      if (!booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: form } = await supabase
        .from("tour_custom_forms")
        .select("id")
        .eq("tour_id", booking.tour_id)
        .eq("is_published", true)
        .limit(1)
        .single();

      if (!form) {
        return new Response(JSON.stringify({ error: "No active form for this tour" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      resolvedFormId = form.id;
    }

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Upsert responses
    for (const sub of submissions) {
      const { data: existing } = await supabase
        .from("tour_custom_form_responses")
        .select("id")
        .eq("form_id", resolvedFormId)
        .eq("booking_id", bookingId)
        .eq("passenger_slot", sub.slot)
        .single();

      if (existing) {
        await supabase
          .from("tour_custom_form_responses")
          .update({
            response_data: sub.response_data,
            customer_id: sub.customer_id,
            updated_at: new Date().toISOString(),
            ip_address: ipAddress,
            user_agent: userAgent,
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("tour_custom_form_responses")
          .insert({
            form_id: resolvedFormId,
            booking_id: bookingId,
            passenger_slot: sub.slot,
            customer_id: sub.customer_id,
            response_data: sub.response_data,
            token_id: tokenData.id,
            ip_address: ipAddress,
            user_agent: userAgent,
          });
      }
    }

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({ last_used_at: new Date().toISOString(), use_count: tokenData.use_count + 1 })
      .eq("id", tokenData.id);

    return new Response(JSON.stringify({
      success: true,
      message: "Form submitted successfully",
      responsesCount: submissions.length,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error in submit-custom-form:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
