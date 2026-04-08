import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfileUpdateRequestPayload {
  customerId?: string;
  bookingId?: string;
}

interface PassengerInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  preferred_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  dietary_requirements: string | null;
  medical_conditions: string | null;
  accessibility_needs: string | null;
}

function processTemplate(content: string, replacements: Record<string, string>): string {
  let result = content;
  const processConditionals = (text: string): string => {
    text = text.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
      return replacements[`{{${key}}}`] ? processConditionals(inner) : '';
    });
    text = text.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
      return !replacements[`{{${key}}}`] ? processConditionals(inner) : '';
    });
    return text;
  };
  result = processConditionals(result);
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
    result = result.replace(regex, value);
  }
  return result;
}

const stripZeroWidth = (v: string) => v.replace(/[\u200B-\u200D\uFEFF]/g, "");

function normalizeConditionalTemplateHtml(html: string): string {
  let n = stripZeroWidth(html);
  n = n.replace(/<h([1-6])>(\s*(?:\{\{[#^][^}]+\}\}\s*)+)([\s\S]*?)<\/h\1>/gi, (_m, l, o, i) => `${o}<h${l}>${i}</h${l}>`);
  n = n.replace(/<h([1-6])>(\s*<strong\b[^>]*>)\s*((?:\{\{[#^][^}]+\}\}\s*)+)([\s\S]*?)<\/strong>\s*<\/h\1>/gi, (_m, l, s, o, i) => `${o}<h${l}>${s}${i}</strong></h${l}>`);
  n = n.replace(/<span[^>]*>\s*(\{\{\/[^}]+\}\})\s*<\/span>/gi, "$1");
  n = n.replace(/<h([1-6])>\s*((?:\{\{[^}]+_button\}\}|\{\{\/[^}]+\}\}|&nbsp;|\s)+)\s*<\/h\1>/gi, (_m, _l, i) => `<p>${i.trim()}</p>`);
  n = n.replace(/<(p|div)([^>]*)>([\s\S]*?)((?:\s*\{\{\/[^}]+\}\}\s*)+)\s*<\/\1>/gi, (_m, t, a, i, c) => `<${t}${a}>${i}</${t}>${c}`);
  return n.replace(/<span[^>]*>\s*<\/span>/gi, "");
}

function sanitizeQuillHtml(html: string): string {
  const blockTags = /<(?:p|h[1-6]|table|ul|ol|div)[\s>]/i;
  let cleaned = html;
  let changed = false;
  cleaned = cleaned.replace(/<(p|div)[^>]*>\s*(<table\b[\s\S]*?<\/table>|<hr\b[^>]*\/?>)\s*<\/\1>/gi, '$2');
  cleaned = cleaned.replace(
    /<h([1-6])>\s*<strong>([\s\S]*?)<\/strong>\s*<\/h\1>/gi,
    (_match, _level, inner) => {
      if (blockTags.test(inner)) { changed = true; return inner; }
      return _match;
    }
  );
  if (changed) {
    cleaned = cleaned.replace(/<\/strong>\s*<\/h([1-6])>\s*(?=<\/td>|<\/tr>)/gi, '');
  }
  return cleaned;
}

function wrapInEmailShell(content: string, headerImageUrl: string, senderName: string, link: string): string {
  const sanitizedContent = sanitizeQuillHtml(content);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <img src="${headerImageUrl}" alt="${senderName}" style="height: 80px; max-width: 400px; width: auto;" />
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    ${sanitizedContent}
  </div>
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p style="margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin: 5px 0; word-break: break-all;">${link}</p>
  </div>
</body>
</html>`;
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

    // Fetch configurable settings
    const { data: gSettings } = await supabase
      .from('general_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['email_header_image_url', 'default_sender_name', 'default_from_email_client', 'token_expiry_hours', 'theme_email_button_color', 'theme_email_button_text']);
    
    const getS = (key: string, fb: string) => {
      const row = (gSettings || []).find((r: any) => r.setting_key === key);
      if (!row) return fb;
      const val = row.setting_value;
      return typeof val === 'string' ? val : String(val);
    };
    
    const emailHeaderImageUrl = getS('email_header_image_url', 'https://art-tour-manager.lovable.app/images/email-header-default.png');
    const senderName = getS('default_sender_name', 'Australian Racing Tours');
    const fromEmailAddr = getS('default_from_email_client', 'bookings@australianracingtours.com.au');
    const tokenExpiryHours = Number(getS('token_expiry_hours', '168')) || 168;
    const btnBg = getS('theme_email_button_color', '#232628');
    const btnText = getS('theme_email_button_text', '#F5C518');

    // Fetch email template
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('type', 'profile_update_request')
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

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

    if (!customerId && !bookingId) {
      return new Response(
        JSON.stringify({ error: "Either Customer ID or Booking ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect all passengers to email
    const passengers: PassengerInfo[] = [];

    if (bookingId) {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          id,
          customers!lead_passenger_id (
            id, first_name, last_name, email, preferred_name, phone, city, state, country,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            dietary_requirements, medical_conditions, accessibility_needs
          ),
          passenger_2:customers!passenger_2_id (
            id, first_name, last_name, email, preferred_name, phone, city, state, country,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            dietary_requirements, medical_conditions, accessibility_needs
          ),
          passenger_3:customers!passenger_3_id (
            id, first_name, last_name, email, preferred_name, phone, city, state, country,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            dietary_requirements, medical_conditions, accessibility_needs
          )
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

      if (booking.customers?.email) passengers.push(booking.customers as PassengerInfo);
      if (booking.passenger_2?.email) passengers.push(booking.passenger_2 as PassengerInfo);
      if (booking.passenger_3?.email) passengers.push(booking.passenger_3 as PassengerInfo);
    } else if (customerId) {
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

      if (customer.email) passengers.push(customer as PassengerInfo);
    }

    if (passengers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No passengers with email addresses found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://art-tour-manager.lovable.app";
    const sentEmails: string[] = [];
    const failedEmails: string[] = [];
    const headerImg = template?.header_image_url || emailHeaderImageUrl;

    const formatField = (value: string | null, placeholder = 'Not provided') => {
      return value && value.trim() ? value : `<span style="color: #999; font-style: italic;">${placeholder}</span>`;
    };

    for (const passenger of passengers) {
      try {
        // Create access token for this specific passenger
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setHours(tokenExpiresAt.getHours() + tokenExpiryHours);
        
        const { data: tokenData, error: tokenError } = await supabase
          .from("customer_access_tokens")
          .insert({
            customer_id: passenger.id,
            booking_id: bookingId || null,
            created_by: user.id,
            expires_at: tokenExpiresAt.toISOString(),
          })
          .select()
          .single();

        if (tokenError) {
          console.error(`Token creation error for ${passenger.email}:`, tokenError);
          failedEmails.push(passenger.email);
          continue;
        }

        const updateLink = `${baseUrl}/update-profile/${tokenData.token}`;
        const displayName = passenger.preferred_name || passenger.first_name;
        const profileUpdateButtonHtml = `<div style="text-align: center; margin: 30px 0;"><a href="${updateLink}" style="display: inline-block; background: ${btnBg}; color: ${btnText}; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">UPDATE MY PROFILE</a></div>`;

        // Build current details HTML
        const currentDetailsHtml = `
          <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0; margin-bottom: 15px; color: #333; font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Your Current Details</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 10px 6px 0; color: #666; width: 40%;"><strong>Name:</strong></td><td style="padding: 6px 0;">${passenger.first_name} ${passenger.last_name}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>Preferred Name:</strong></td><td style="padding: 6px 0;">${formatField(passenger.preferred_name)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>Email:</strong></td><td style="padding: 6px 0;">${formatField(passenger.email)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>Phone:</strong></td><td style="padding: 6px 0;">${formatField(passenger.phone)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>City:</strong></td><td style="padding: 6px 0;">${formatField(passenger.city)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>State:</strong></td><td style="padding: 6px 0;">${formatField(passenger.state)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>Country:</strong></td><td style="padding: 6px 0;">${formatField(passenger.country)}</td></tr>
            </table>
            <h4 style="margin-top: 15px; margin-bottom: 10px; color: #333; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">Emergency Contact</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 10px 6px 0; color: #666; width: 40%;"><strong>Name:</strong></td><td style="padding: 6px 0;">${formatField(passenger.emergency_contact_name)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>Phone:</strong></td><td style="padding: 6px 0;">${formatField(passenger.emergency_contact_phone)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>Relationship:</strong></td><td style="padding: 6px 0;">${formatField(passenger.emergency_contact_relationship)}</td></tr>
            </table>
            <h4 style="margin-top: 15px; margin-bottom: 10px; color: #333; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">Health & Dietary</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 10px 6px 0; color: #666; width: 40%;"><strong>Dietary Requirements:</strong></td><td style="padding: 6px 0;">${formatField(passenger.dietary_requirements)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>Medical Conditions:</strong></td><td style="padding: 6px 0;">${formatField(passenger.medical_conditions)}</td></tr>
              <tr><td style="padding: 6px 10px 6px 0; color: #666;"><strong>Accessibility Needs:</strong></td><td style="padding: 6px 0;">${formatField(passenger.accessibility_needs)}</td></tr>
            </table>
          </div>
        `;

        const replacements: Record<string, string> = {
          '{{customer_first_name}}': passenger.first_name || '',
          '{{customer_last_name}}': passenger.last_name || '',
          '{{customer_preferred_name}}': displayName || '',
          '{{customer_email}}': passenger.email || '',
          '{{current_details}}': currentDetailsHtml,
          '{{profile_update_button}}': profileUpdateButtonHtml,
          '{{profile_update_link}}': updateLink,
        };

        let finalSubject: string;
        let finalHtml: string;
        let fromEmail: string;

        if (template) {
          fromEmail = template.from_email ? `${senderName} <${template.from_email}>` : `${senderName} <${fromEmailAddr}>`;
          const processedContent = processTemplate(normalizeConditionalTemplateHtml(template.content_template || ''), replacements);
          finalSubject = processTemplate(template.subject_template || 'Update Your Profile Details', replacements);
          finalHtml = wrapInEmailShell(processedContent, headerImg, senderName, updateLink);
        } else {
          fromEmail = `${senderName} <${fromEmailAddr}>`;
          finalSubject = 'Update Your Profile Details';
          const fallbackContent = `<p style="margin-top: 0;">Dear ${displayName},</p>
            <p>We'd like to ensure we have your most up-to-date information on file. Please review your current details below and click the button to make any corrections.</p>
            ${currentDetailsHtml}
            <p style="text-align: center; color: #666; font-size: 14px; margin: 20px 0;">If any of the above details are incorrect or missing, please click below to update them.</p>
            ${profileUpdateButtonHtml}
            <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #2e7d32;">
                <strong>Note:</strong> This link will expire in ${Math.round(tokenExpiryHours / 24)} days. You can make multiple updates within this timeframe.
              </p>
            </div>
            <p>If you didn't request this email or have any questions, please contact us.</p>
            <p style="margin-bottom: 0;">Kind regards,<br><strong>${senderName}</strong></p>`;
          finalHtml = wrapInEmailShell(fallbackContent, headerImg, senderName, updateLink);
        }

        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: [passenger.email],
          subject: finalSubject,
          html: finalHtml,
        });

        console.log(`Profile update email sent to ${passenger.email}:`, emailResponse);

        if (emailResponse.data?.id) {
          await supabase.from("email_logs").insert({
            message_id: emailResponse.data.id,
            recipient_email: passenger.email,
            recipient_name: `${passenger.first_name} ${passenger.last_name}`,
            subject: finalSubject,
            template_name: "profile_update_request",
            booking_id: bookingId || null,
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
        message: `Profile update request sent to ${sentEmails.length} contact(s)`,
        sentTo: sentEmails,
        failed: failedEmails.length > 0 ? failedEmails : undefined,
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