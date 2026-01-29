import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TravelDocsRequestPayload {
  bookingId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get the authorization header to identify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { bookingId }: TravelDocsRequestPayload = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "Booking ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get booking with customer and tour details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        customers!lead_passenger_id (id, first_name, last_name, email),
        tours (id, name, start_date, end_date, travel_documents_required)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking fetch error:", bookingError);
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customer = booking.customers;
    const tour = booking.tours;

    if (!customer) {
      return new Response(
        JSON.stringify({ error: "No lead passenger found for this booking" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!customer.email) {
      return new Response(
        JSON.stringify({ error: "Lead passenger does not have an email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tour?.travel_documents_required) {
      return new Response(
        JSON.stringify({ error: "This tour does not require travel documents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create access token for travel docs (72-hour expiry, booking-specific)
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .insert({
        customer_id: customer.id,
        booking_id: bookingId,
        purpose: 'travel_documents',
        created_by: user.id,
      })
      .select()
      .single();

    if (tokenError) {
      console.error("Token creation error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to create access token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the magic link URL
    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://art-tour-manager.lovable.app";
    const updateLink = `${baseUrl}/update-travel-docs/${tokenData.token}`;

    // Format tour dates
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-AU', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    };

    // Check what passport details we already have
    const existingDetails = [];
    if (booking.passport_number) existingDetails.push(`Passport Number: ${booking.passport_number}`);
    if (booking.passport_country) existingDetails.push(`Passport Country: ${booking.passport_country}`);
    if (booking.passport_expiry_date) existingDetails.push(`Expiry Date: ${formatDate(booking.passport_expiry_date)}`);
    if (booking.nationality) existingDetails.push(`Nationality: ${booking.nationality}`);
    if (booking.id_number) existingDetails.push(`ID Number: ${booking.id_number}`);

    const existingDetailsHtml = existingDetails.length > 0 
      ? `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #333;">Current Details on File:</h4>
          <ul style="margin: 0; padding-left: 20px;">
            ${existingDetails.map(d => `<li style="margin: 5px 0;">${d}</li>`).join('')}
          </ul>
        </div>
      `
      : `
        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>No travel documents on file yet.</strong> Please provide your passport details as soon as possible.
          </p>
        </div>
      `;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Australian Racing Tours <info@australianracingtours.com.au>",
      to: [customer.email],
      subject: `Travel Documents Required - ${tour.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <img src="https://art-tour-manager.lovable.app/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" alt="Australian Racing Tours" style="height: 50px; margin-bottom: 10px;" />
            <h1 style="color: #fff; margin: 0; font-size: 24px;">Travel Documents Required</h1>
          </div>
          
          <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin-top: 0;">Dear ${customer.first_name},</p>
            
            <p>We require your passport details for your upcoming tour:</p>
            
            <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #2e7d32;">${tour.name}</h3>
              <p style="margin: 0; font-size: 14px;">
                <strong>Tour Dates:</strong> ${formatDate(tour.start_date)} - ${formatDate(tour.end_date)}
              </p>
            </div>
            
            ${existingDetailsHtml}
            
            <p>Please click the button below to provide or update your travel document details:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${updateLink}" style="display: inline-block; background: #232628; color: #F5C518; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Submit Travel Documents</a>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #1565c0;">
                <strong>Note:</strong> This link will expire in 72 hours. Your passport details are securely stored and will be automatically deleted 30 days after your tour ends.
              </p>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p style="margin-bottom: 0;">Kind regards,<br><strong>Australian Racing Tours</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
            <p style="margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="margin: 5px 0; word-break: break-all;">${updateLink}</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Travel docs request email sent:", emailResponse);

    // Log the email send
    if (emailResponse.data?.id) {
      await supabase.from("email_logs").insert({
        message_id: emailResponse.data.id,
        recipient_email: customer.email,
        recipient_name: `${customer.first_name} ${customer.last_name}`,
        subject: `Travel Documents Required - ${tour.name}`,
        template_name: "travel_documents_request",
        booking_id: bookingId,
        tour_id: tour.id,
        sent_by: user.id,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Travel documents request sent successfully",
        expiresAt: tokenData.expires_at
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-travel-docs-request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
