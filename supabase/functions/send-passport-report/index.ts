import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PassportReportRequest {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  message: string;
  htmlContent: string;
  csvContent: string;
  tourName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      from,
      to,
      cc,
      bcc,
      subject,
      message,
      htmlContent,
      csvContent,
      tourName
    }: PassportReportRequest = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build the email HTML with the message and report content
    const htmlBody = message.replace(/\n/g, '<br>');
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px;">
        <div style="margin: 20px 0;">
          ${htmlBody}
        </div>
        
        ${htmlContent}
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>If you have any questions or need clarification, please don't hesitate to contact us.</p>
          <p style="margin-top: 10px;"><em>Note: A CSV version of this report is attached for your convenience.</em></p>
        </div>
      </div>
    `;

    // Create filename-safe tour name
    const safeFileName = tourName.replace(/[^a-zA-Z0-9]/g, '_');
    
    const emailData: any = {
      from: `Tour Operations <${from}>`,
      to: [to],
      subject: subject,
      html: emailHtml,
      attachments: [
        {
          filename: `${safeFileName}_Passport_Details.csv`,
          content: Buffer.from(csvContent).toString('base64'),
        }
      ]
    };

    // Add CC if provided
    if (cc) {
      const ccEmails = cc.split(',').map(e => e.trim()).filter(Boolean);
      if (ccEmails.length > 0) {
        emailData.cc = ccEmails;
      }
    }

    // Add BCC if provided
    if (bcc) {
      const bccEmails = bcc.split(',').map(e => e.trim()).filter(Boolean);
      if (bccEmails.length > 0) {
        emailData.bcc = bccEmails;
      }
    }

    const emailResponse = await resend.emails.send(emailData);

    console.log("Passport report email sent successfully:", emailResponse);

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          error: `Email sending failed: ${emailResponse.error.message || emailResponse.error}` 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      sentTo: to
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-passport-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
