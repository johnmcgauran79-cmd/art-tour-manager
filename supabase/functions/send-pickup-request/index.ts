import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Fetch email header image from settings
    const { data: headerSetting } = await supabase
      .from('general_settings')
      .select('setting_value')
      .eq('setting_key', 'email_header_image_url')
      .single();
    const emailHeaderImageUrl = (headerSetting?.setting_value as string) || 'https://art-tour-manager.lovable.app/images/email-header-default.png';

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bookingId } = await req.json();
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "Booking ID is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        customers!lead_passenger_id (id, first_name, last_name, email, preferred_name),
        tours (id, name, start_date, end_date, pickup_location_required)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!booking.tours?.pickup_location_required) {
      return new Response(JSON.stringify({ error: "This tour does not require pickup location selection" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!booking.customers?.email) {
      return new Response(JSON.stringify({ error: "No email address found for lead passenger" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tour = booking.tours;
    const passenger = booking.customers;
    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "https://art-tour-manager.lovable.app";

    // Create pickup token (7-day expiry)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 168);

    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .insert({
        customer_id: passenger.id,
        booking_id: bookingId,
        purpose: "pickup",
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (tokenError) {
      console.error("Token creation error:", tokenError);
      return new Response(JSON.stringify({ error: "Failed to create access token" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pickupLink = `${baseUrl}/select-pickup/${tokenData.token}`;
    const displayName = passenger.preferred_name || passenger.first_name;

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    };

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <img src="${emailHeaderImageUrl}" alt="Australian Racing Tours" style="height: 50px; max-width: 200px; width: auto; margin-bottom: 10px;" />
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Select Your Pickup Location</h1>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Dear ${displayName},</p>
    
    <p>As part of your booking for <strong>${tour.name}</strong> (${formatDate(tour.start_date)} - ${formatDate(tour.end_date)}), we need you to select your preferred pickup location.</p>
    
    <p>Please click the button below to view the available pickup options and make your selection:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${pickupLink}" style="display: inline-block; background: #232628; color: #F5C518; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">UPDATE PICKUP LOCATION</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">This link will expire in 7 days. If you have any questions, please don't hesitate to contact us.</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p style="margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin: 5px 0; word-break: break-all;">${pickupLink}</p>
  </div>
</body>
</html>`;

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "Australian Racing Tours <bookings@australianracingtours.com.au>",
      to: [passenger.email],
      subject: `Select Your Pickup Location - ${tour.name}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      return new Response(JSON.stringify({ error: "Failed to send email", sentTo: [], failed: [passenger.email] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (emailResult?.id) {
      await supabase.from("email_logs").insert({
        booking_id: bookingId,
        tour_id: tour.id,
        recipient_email: passenger.email,
        recipient_name: `${passenger.first_name} ${passenger.last_name}`,
        subject: `Select Your Pickup Location - ${tour.name}`,
        message_id: emailResult.id,
        template_name: "pickup_request",
        sent_by: user.id,
      });
    }

    return new Response(
      JSON.stringify({ success: true, sentTo: [passenger.email], failed: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-pickup-request:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
