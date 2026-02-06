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

interface PassengerInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  preferred_name: string | null;
  slot: 'lead' | 'pax2' | 'pax3';
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

    // Get booking with all passenger and tour details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        customers!lead_passenger_id (id, first_name, last_name, email, preferred_name),
        passenger_2:customers!passenger_2_id (id, first_name, last_name, email, preferred_name),
        passenger_3:customers!passenger_3_id (id, first_name, last_name, email, preferred_name),
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

    const tour = booking.tours;

    if (!tour?.travel_documents_required) {
      return new Response(
        JSON.stringify({ error: "This tour does not require travel documents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect all passengers with email addresses
    const passengers: PassengerInfo[] = [];
    
    if (booking.customers?.email) {
      passengers.push({
        id: booking.customers.id,
        first_name: booking.customers.first_name,
        last_name: booking.customers.last_name,
        email: booking.customers.email,
        preferred_name: booking.customers.preferred_name,
        slot: 'lead'
      });
    }
    
    if (booking.passenger_2?.email) {
      passengers.push({
        id: booking.passenger_2.id,
        first_name: booking.passenger_2.first_name,
        last_name: booking.passenger_2.last_name,
        email: booking.passenger_2.email,
        preferred_name: booking.passenger_2.preferred_name,
        slot: 'pax2'
      });
    }
    
    if (booking.passenger_3?.email) {
      passengers.push({
        id: booking.passenger_3.id,
        first_name: booking.passenger_3.first_name,
        last_name: booking.passenger_3.last_name,
        email: booking.passenger_3.email,
        preferred_name: booking.passenger_3.preferred_name,
        slot: 'pax3'
      });
    }

    if (passengers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No passengers with email addresses found on this booking" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format tour dates helper
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-AU', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    };

    // Try to fetch the database template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("type", "travel_documents_request")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .single();

    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://art-tour-manager.lovable.app";
    const sentEmails: string[] = [];
    const failedEmails: string[] = [];

    // Send individual emails to each passenger
    for (const passenger of passengers) {
      try {
        // Create access token for this specific passenger
        const { data: tokenData, error: tokenError } = await supabase
          .from("customer_access_tokens")
          .insert({
            customer_id: passenger.id,
            booking_id: bookingId,
            purpose: 'travel_documents',
            created_by: user.id,
          })
          .select()
          .single();

        if (tokenError) {
          console.error(`Token creation error for ${passenger.email}:`, tokenError);
          failedEmails.push(passenger.email);
          continue;
        }

        const updateLink = `${baseUrl}/update-travel-docs/${tokenData.token}`;
        const travelDocsButtonHtml = `<a href="${updateLink}" style="display: inline-block; background: #232628; color: #F5C518; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">SUBMIT TRAVEL DOCUMENTS</a>`;

        let finalSubject: string;
        let finalHtml: string;
        let fromEmail: string;

        if (template) {
          fromEmail = template.from_email || "Australian Racing Tours <info@australianracingtours.com.au>";

          const replacements: Record<string, string> = {
            '{{customer_first_name}}': passenger.preferred_name || passenger.first_name || '',
            '{{customer_last_name}}': passenger.last_name || '',
            '{{customer_email}}': passenger.email || '',
            '{{customer_preferred_name}}': passenger.preferred_name || passenger.first_name || '',
            '{{tour_name}}': tour.name || '',
            '{{tour_start_date}}': tour.start_date ? formatDate(tour.start_date) : '',
            '{{tour_end_date}}': tour.end_date ? formatDate(tour.end_date) : '',
            '{{passport_number}}': booking.passport_number || '',
            '{{passport_country}}': booking.passport_country || '',
            '{{passport_expiry_date}}': booking.passport_expiry_date ? formatDate(booking.passport_expiry_date) : '',
            '{{nationality}}': booking.nationality || '',
            '{{id_number}}': booking.id_number || '',
            '{{travel_docs_button}}': travelDocsButtonHtml,
            '{{travel_docs_link}}': updateLink,
          };

          let processedContent = template.content_template || '';
          let processedSubject = template.subject_template || `Travel Documents Required - ${tour.name}`;

          // Handle conditional sections
          const hasPassportDetails = !!(booking.passport_number || booking.passport_country || booking.passport_expiry_date || booking.nationality || booking.id_number);
          const hasDetailsRegex = /\{\{#has_passport_details\}\}([\s\S]*?)\{\{\/has_passport_details\}\}/g;
          const noDetailsRegex = /\{\{#no_passport_details\}\}([\s\S]*?)\{\{\/no_passport_details\}\}/g;
          const notHasDetailsRegex = /\{\{\^has_passport_details\}\}([\s\S]*?)\{\{\/has_passport_details\}\}/g;

          if (hasPassportDetails) {
            processedContent = processedContent.replace(hasDetailsRegex, '$1');
            processedContent = processedContent.replace(notHasDetailsRegex, '');
            processedContent = processedContent.replace(noDetailsRegex, '');
          } else {
            processedContent = processedContent.replace(notHasDetailsRegex, '$1');
            processedContent = processedContent.replace(noDetailsRegex, '$1');
            processedContent = processedContent.replace(hasDetailsRegex, '');
          }

          for (const [key, value] of Object.entries(replacements)) {
            const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
            processedContent = processedContent.replace(regex, value);
            processedSubject = processedSubject.replace(regex, value);
          }

          finalSubject = processedSubject;
          finalHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <img src="https://art-tour-manager.lovable.app/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" alt="Australian Racing Tours" style="height: 50px; max-width: 200px; width: auto; margin-bottom: 10px;" />
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Travel Documents Required</h1>
              </div>
              
              <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                ${processedContent}
              </div>
              
              <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
                <p style="margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="margin: 5px 0; word-break: break-all;">${updateLink}</p>
              </div>
            </body>
            </html>
          `;
        } else {
          fromEmail = "Australian Racing Tours <info@australianracingtours.com.au>";
          finalSubject = `Travel Documents Required - ${tour.name}`;

          finalHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <img src="https://art-tour-manager.lovable.app/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" alt="Australian Racing Tours" style="height: 50px; max-width: 200px; width: auto; margin-bottom: 10px;" />
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Travel Documents Required</h1>
              </div>
              
              <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="margin-top: 0;">Dear ${passenger.preferred_name || passenger.first_name},</p>
                
                <p>We require your passport details for your upcoming tour:</p>
                
                <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
                  <h3 style="margin: 0 0 10px 0; color: #2e7d32;">${tour.name}</h3>
                  <p style="margin: 0; font-size: 14px;">
                    <strong>Tour Dates:</strong> ${formatDate(tour.start_date)} - ${formatDate(tour.end_date)}
                  </p>
                </div>
                
                <p>Please click the button below to provide your travel document details:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  ${travelDocsButtonHtml}
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
          `;
        }

        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: [passenger.email],
          subject: finalSubject,
          html: finalHtml,
        });

        console.log(`Travel docs request sent to ${passenger.email}:`, emailResponse);

        if (emailResponse.data?.id) {
          await supabase.from("email_logs").insert({
            message_id: emailResponse.data.id,
            recipient_email: passenger.email,
            recipient_name: `${passenger.first_name} ${passenger.last_name}`,
            subject: finalSubject,
            template_name: "travel_documents_request",
            booking_id: bookingId,
            tour_id: tour.id,
            sent_by: user.id,
          });
          sentEmails.push(passenger.email);
        }
      } catch (err) {
        console.error(`Failed to send to ${passenger.email}:`, err);
        failedEmails.push(passenger.email);
      }
    }

    if (sentEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to send any emails" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Travel documents request sent to ${sentEmails.length} passenger(s)`,
        sentTo: sentEmails,
        failed: failedEmails.length > 0 ? failedEmails : undefined
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
