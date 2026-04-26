import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  tourId: string;
  itineraryId: string;
  recipientEmail: string;
  recipientName?: string;
  subject?: string;
  message?: string;
  fromEmail?: string;
  includeHotels?: boolean;
  includeTourInfo?: boolean;
  ccEmails?: string[];
  bccEmails?: string[];
  pdfBase64?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      tourId,
      itineraryId,
      recipientEmail,
      recipientName,
      subject,
      message,
      fromEmail,
      includeHotels = true,
      includeTourInfo = true,
      ccEmails,
      bccEmails,
      pdfBase64,
    }: RequestBody = await req.json();

    console.log("Sending itinerary email:", {
      tourId,
      itineraryId,
      recipientEmail,
      recipientName,
      subject,
      fromEmail,
      includeHotels,
      includeTourInfo,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate HTML using the same function as download/preview
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
          itineraryId,
          format: "html",
          options: {
            includeHotels,
            includeTourInfo,
          },
        }),
      }
    );

    if (!generateResponse.ok) {
      throw new Error(`Failed to generate itinerary: ${await generateResponse.text()}`);
    }

    const { html: htmlContent } = await generateResponse.json();

    // Fetch tour name for email subject
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("name")
      .eq("id", tourId)
      .single();

    if (tourError || !tour) {
      throw new Error(`Failed to fetch tour: ${tourError?.message}`);
    }

    // Prepare email options
    const emailSubject = subject || `${tour.name} - Tour Itinerary`;
    const fromAddress = fromEmail || "bookings@australianracingtours.com.au";

    let emailBody = "";
    if (message) {
      emailBody = `<p style="margin-bottom: 20px;">${message.replace(/\n/g, '<br>')}</p>`;
    }
    emailBody += htmlContent;

    // Prepare email with HTML body and optional PDF attachment
    const emailOptions: any = {
      from: fromAddress,
      to: recipientEmail,
      subject: emailSubject,
      html: emailBody,
    };

    // Add PDF attachment if provided
    if (pdfBase64) {
      const attachmentFilename = `${tour.name.replace(/[^a-z0-9]/gi, '_')}_Itinerary.pdf`;
      emailOptions.attachments = [
        {
          filename: attachmentFilename,
          content: pdfBase64,
        },
      ];
    }

    // Add CC and BCC if provided
    if (ccEmails && ccEmails.length > 0) {
      emailOptions.cc = ccEmails;
    }
    if (bccEmails && bccEmails.length > 0) {
      emailOptions.bcc = bccEmails;
    }

    // Send email via Resend
    console.log("Sending itinerary email with PDF attachment...");
    const emailResponse = await resend.emails.send(emailOptions);

    console.log("Email sent successfully:", emailResponse);

    // Log the email send
    await supabase.from("email_logs").insert({
      tour_id: tourId,
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      subject: emailSubject,
      message_id: emailResponse.id || "unknown",
      sent_at: new Date().toISOString(),
      template_name: "tour_itinerary",
    });

    return new Response(
      JSON.stringify({
        success: true,
        sentTo: recipientEmail,
        messageId: emailResponse.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-itinerary-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
