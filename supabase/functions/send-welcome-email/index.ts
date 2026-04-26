import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tempPassword: string;
  loginUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, role, tempPassword, loginUrl } =
      (await req.json()) as WelcomeEmailRequest;

    if (!email || !firstName || !tempPassword) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appLoginUrl = loginUrl || "https://art-tour-manager.lovable.app/login";

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: headerSetting } = await supabaseClient.from('general_settings').select('setting_value').eq('setting_key', 'email_header_image_url').single();
    const emailHeaderImageUrl = (headerSetting?.setting_value as string) || 'https://art-tour-manager.lovable.app/images/email-header-default.png';
    const appName = "Australian Racing Tours";

    const roleLabel = {
      admin: "Admin",
      manager: "Manager",
      booking_agent: "Booking Agent",
      agent: "Agent (View-Only)",
      host: "Host (Tour View-Only)",
    }[role] || role;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="width:100%;max-width:800px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#232628;padding:32px 40px;text-align:center;">
              <img src="${emailHeaderImageUrl}" alt="Australian Racing Tours" style="height:80px;max-width:400px;width:auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1a2332;margin:0 0 16px;font-size:20px;">
                Welcome, ${firstName}!
              </h2>
              <p style="color:#55575d;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Your account has been created on the ${appName} management system. Below are your login details.
              </p>
              
              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fefce8;border:1px solid #fde68a;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="color:#92400e;font-size:13px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">
                      Your Login Credentials
                    </p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#55575d;font-size:14px;padding:4px 16px 4px 0;font-weight:600;">Email:</td>
                        <td style="color:#1a2332;font-size:14px;padding:4px 0;">${email}</td>
                      </tr>
                      <tr>
                        <td style="color:#55575d;font-size:14px;padding:4px 16px 4px 0;font-weight:600;">Password:</td>
                        <td style="color:#1a2332;font-size:14px;padding:4px 0;font-family:monospace;background-color:#fef3c7;padding:4px 8px;border-radius:4px;">${tempPassword}</td>
                      </tr>
                      <tr>
                        <td style="color:#55575d;font-size:14px;padding:4px 16px 4px 0;font-weight:600;">Role:</td>
                        <td style="color:#1a2332;font-size:14px;padding:4px 0;">${roleLabel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${appLoginUrl}" style="display:inline-block;background-color:#1a2332;color:#f5c518;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                      LOG IN TO YOUR ACCOUNT
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#92400e;font-size:13px;line-height:1.5;margin:0 0 16px;background-color:#fef3c7;padding:12px 16px;border-radius:6px;">
                ⚠️ For security, please change your password after your first login.
              </p>

              <p style="color:#55575d;font-size:14px;line-height:1.6;margin:0;">
                If you have any questions, please contact your administrator.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
                This is an automated message from ${appName}. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: `${appName} <info@australianracingtours.com.au>`,
      to: [email],
      subject: `Welcome to ${appName} - Your Account Details`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
