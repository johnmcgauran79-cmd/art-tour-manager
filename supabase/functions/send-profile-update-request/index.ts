import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfileUpdateRequestPayload {
  customerId: string;
  bookingId?: string;
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

    const { customerId, bookingId }: ProfileUpdateRequestPayload = await req.json();

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Customer ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      console.error("Customer fetch error:", customerError);
      return new Response(
        JSON.stringify({ error: "Customer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!customer.email) {
      return new Response(
        JSON.stringify({ error: "Customer does not have an email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create access token (24-hour expiry)
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .insert({
        customer_id: customerId,
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
    const updateLink = `${baseUrl}/update-profile/${tokenData.token}`;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Australian Racing Tours <info@australianracingtours.com.au>",
      to: [customer.email],
      subject: "Update Your Profile Details",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">Update Your Profile</h1>
          </div>
          
          <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin-top: 0;">Dear ${customer.first_name},</p>
            
            <p>We'd like to ensure we have your most up-to-date information on file. Please click the button below to review and update your contact details, emergency contacts, and dietary requirements.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${updateLink}" style="display: inline-block; background: #1e3a5f; color: #fff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Update My Profile</a>
            </div>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                <strong>Important:</strong> This link will expire in 24 hours. You can make multiple updates within this timeframe.
              </p>
            </div>
            
            <p>If you didn't request this email or have any questions, please contact us.</p>
            
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

    console.log("Profile update email sent:", emailResponse);

    // Log the email send
    if (emailResponse.data?.id) {
      await supabase.from("email_logs").insert({
        message_id: emailResponse.data.id,
        recipient_email: customer.email,
        recipient_name: `${customer.first_name} ${customer.last_name}`,
        subject: "Update Your Profile Details",
        template_name: "profile_update_request",
        booking_id: bookingId || null,
        sent_by: user.id,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Profile update request sent successfully",
        expiresAt: tokenData.expires_at
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-profile-update-request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
