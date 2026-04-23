import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const {
      bookingId,
      formId,
      customSubject,
      customContent,
      fromEmail: overrideFromEmail,
      ccEmails,
      bccEmails,
      emailTemplateId,
      attachments: requestedAttachments,
    } = await req.json();

    if (!bookingId) {
      return new Response(JSON.stringify({ error: "Booking ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch email template — prefer the explicitly chosen one, otherwise fall back
    // to the default custom_form_request template.
    let templateQuery = supabase.from('email_templates').select('*').eq('is_active', true);
    if (emailTemplateId) {
      templateQuery = templateQuery.eq('id', emailTemplateId);
    } else {
      templateQuery = templateQuery.eq('type', 'custom_form_request').eq('is_default', true);
    }
    const { data: template } = await templateQuery.maybeSingle();

    // Get booking with passengers and tour
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        customers!lead_passenger_id (id, first_name, last_name, email, preferred_name),
        passenger_2:customers!passenger_2_id (id, first_name, last_name, email, preferred_name),
        passenger_3:customers!passenger_3_id (id, first_name, last_name, email, preferred_name),
        tours (id, name, start_date, end_date)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tour = booking.tours;

    // Get the specific form, or fall back to the single published form
    let form: any;
    if (formId) {
      const { data, error } = await supabase
        .from("tour_custom_forms")
        .select("*")
        .eq("id", formId)
        .eq("is_published", true)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Form not found or not published" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      form = data;
    } else {
      const { data, error } = await supabase
        .from("tour_custom_forms")
        .select("*")
        .eq("tour_id", tour.id)
        .eq("is_published", true)
        .limit(1)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "No published custom form found for this tour" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      form = data;
    }

    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "https://art-tour-manager.lovable.app";

    interface PassengerInfo {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      preferred_name: string | null;
      slot: number;
    }
    const passengers: PassengerInfo[] = [];

    if (booking.customers?.email) {
      passengers.push({ id: booking.customers.id, first_name: booking.customers.first_name, last_name: booking.customers.last_name, email: booking.customers.email, preferred_name: booking.customers.preferred_name, slot: 1 });
    }

    // Recipients are controlled by email_recipients (independent of how the form is filled).
    // Default to all_passengers if the column is missing/legacy.
    const recipientMode = (form.email_recipients as string) || 'all_passengers';
    if (recipientMode === 'all_passengers') {
      if (booking.passenger_2?.email) {
        passengers.push({ id: booking.passenger_2.id, first_name: booking.passenger_2.first_name, last_name: booking.passenger_2.last_name, email: booking.passenger_2.email, preferred_name: booking.passenger_2.preferred_name, slot: 2 });
      }
      if (booking.passenger_3?.email) {
        passengers.push({ id: booking.passenger_3.id, first_name: booking.passenger_3.first_name, last_name: booking.passenger_3.last_name, email: booking.passenger_3.email, preferred_name: booking.passenger_3.preferred_name, slot: 3 });
      }
    }

    if (passengers.length === 0) {
      return new Response(JSON.stringify({ error: "No passengers with email addresses found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    };

    const sentEmails: string[] = [];
    const failedEmails: string[] = [];
    const headerImg = template?.header_image_url || emailHeaderImageUrl;

    // Prepare email attachments once and reuse for every passenger send.
    // Hard caps: max 3 files, max 10MB total — UI enforces this, defense-in-depth here.
    const MAX_ATTACHMENTS = 3;
    const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
    type ResendAttachment = { filename: string; content: string };
    const resendAttachments: ResendAttachment[] = [];
    if (Array.isArray(requestedAttachments) && requestedAttachments.length > 0) {
      const limited = requestedAttachments.slice(0, MAX_ATTACHMENTS);
      let totalBytes = 0;
      for (const att of limited) {
        if (!att?.path) continue;
        try {
          const { data: fileData, error: dlErr } = await supabase.storage
            .from('attachments')
            .download(att.path);
          if (dlErr || !fileData) {
            console.error(`[custom-form Attachments] Download failed for ${att.path}:`, dlErr);
            continue;
          }
          const buffer = new Uint8Array(await fileData.arrayBuffer());
          totalBytes += buffer.byteLength;
          if (totalBytes > MAX_ATTACHMENT_BYTES) {
            console.warn('[custom-form Attachments] Total size exceeds 10MB cap, dropping further attachments.');
            break;
          }
          let binary = '';
          for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
          const base64 = btoa(binary);
          resendAttachments.push({
            filename: att.name || att.path.split('/').pop() || 'attachment',
            content: base64,
          });
          console.log(`[custom-form Attachments] Prepared ${att.name} (${buffer.byteLength} bytes)`);
        } catch (e) {
          console.error(`[custom-form Attachments] Error processing ${att.path}:`, e);
        }
      }
    }

    for (const passenger of passengers) {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + tokenExpiryHours);

        const { data: tokenData, error: tokenError } = await supabase
          .from("customer_access_tokens")
          .insert({
            customer_id: passenger.id,
            booking_id: bookingId,
            purpose: "custom_form",
            created_by: user.id,
            expires_at: expiresAt.toISOString(),
            form_id: form.id,
          })
          .select()
          .single();

        if (tokenError) {
          console.error(`Token creation error for ${passenger.email}:`, tokenError);
          failedEmails.push(passenger.email);
          continue;
        }

        const formLink = `${baseUrl}/custom-form/${tokenData.token}`;
        const displayName = passenger.preferred_name || passenger.first_name;
        const customFormButtonHtml = `<div style="text-align: center; margin: 30px 0;"><a href="${formLink}" style="display: inline-block; background: ${btnBg}; color: ${btnText}; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">COMPLETE FORM</a></div>`;

        const replacements: Record<string, string> = {
          '{{customer_first_name}}': passenger.first_name || '',
          '{{customer_last_name}}': passenger.last_name || '',
          '{{customer_preferred_name}}': displayName || '',
          '{{customer_email}}': passenger.email || '',
          '{{tour_name}}': tour.name || '',
          '{{tour_start_date}}': tour.start_date ? formatDate(tour.start_date) : '',
          '{{tour_end_date}}': tour.end_date ? formatDate(tour.end_date) : '',
          '{{form_title}}': form.form_title || 'Custom Form',
          '{{form_description}}': form.form_description || '',
          '{{is_per_passenger}}': form.response_mode === 'per_passenger' ? 'true' : '',
          '{{custom_form_button}}': customFormButtonHtml,
          '{{custom_form_link}}': formLink,
        };

        // Helper to replace named custom form button placeholders {{custom_form_button:Form Title}}
        // with the same styled CTA button. This supports the multi-form system where each form
        // is referenced by its title in the email template.
        const replaceNamedCustomFormButtons = (html: string) =>
          html.replace(/\{\{custom_form_button:([^}]+)\}\}/g, () => customFormButtonHtml);

        let finalSubject: string;
        let finalHtml: string;
        let fromEmail: string;

        // Override sources take precedence over the stored template so one-off
        // sends from the bulk Send Email flow can edit subject/content per send.
        const subjectSource =
          (customSubject && customSubject.trim().length > 0)
            ? customSubject
            : (template?.subject_template || `${form.form_title} - ${tour.name}`);
        const contentSource =
          (customContent && customContent.trim().length > 0)
            ? customContent
            : (template?.content_template || '');

        if (template || customContent) {
          const fromAddr = overrideFromEmail || template?.from_email || fromEmailAddr;
          fromEmail = `${senderName} <${fromAddr}>`;
          let processedContent = processTemplate(normalizeConditionalTemplateHtml(contentSource), replacements);
          processedContent = replaceNamedCustomFormButtons(processedContent);
          finalSubject = processTemplate(subjectSource, replacements);
          finalHtml = wrapInEmailShell(processedContent, headerImg, senderName, formLink);
          console.log(`[custom-form] template path used. form_title="${form.form_title}" override-content=${!!customContent} override-subject=${!!customSubject} button-html-present=${processedContent.includes('COMPLETE FORM')}`);
        } else {
          fromEmail = `${senderName} <${fromEmailAddr}>`;
          finalSubject = `${form.form_title} - ${tour.name}`;
          const perPassengerNote = form.response_mode === "per_passenger"
            ? `<p style="color: #666; font-size: 14px;">If other passengers on your booking don't have an email address, you'll be able to fill in their details as well.</p>`
            : "";
          const fallbackContent = `<p>Dear ${displayName},</p>
            <p>As part of your booking for <strong>${tour.name}</strong> (${formatDate(tour.start_date)} - ${formatDate(tour.end_date)}), we need you to complete a short form.</p>
            ${form.form_description ? `<p>${form.form_description}</p>` : ""}
            <p>Please click the button below to fill in the required information:</p>
            ${customFormButtonHtml}
            ${perPassengerNote}
            <p style="color: #666; font-size: 14px;">This link will expire in ${Math.round(tokenExpiryHours / 24)} days. If you have any questions, please don't hesitate to contact us.</p>`;
          finalHtml = wrapInEmailShell(fallbackContent, headerImg, senderName, formLink);
        }

        const { data: emailResult, error: emailError } = await resend.emails.send({
          from: fromEmail,
          to: [passenger.email],
          cc: ccEmails && ccEmails.length > 0 ? ccEmails : undefined,
          bcc: bccEmails && bccEmails.length > 0 ? bccEmails : undefined,
          subject: finalSubject,
          html: finalHtml,
          attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
        });

        if (emailError) {
          console.error(`Email send error for ${passenger.email}:`, emailError);
          failedEmails.push(passenger.email);
          continue;
        }

        if (emailResult?.id) {
          await supabase.from("email_logs").insert({
            booking_id: bookingId,
            tour_id: tour.id,
            recipient_email: passenger.email,
            recipient_name: `${passenger.first_name} ${passenger.last_name}`,
            subject: finalSubject,
            message_id: emailResult.id,
            template_name: "custom_form_request",
            sent_by: user.id,
          });
        }

        sentEmails.push(passenger.email);
      } catch (err: any) {
        console.error(`Error processing ${passenger.email}:`, err);
        failedEmails.push(passenger.email);
      }
    }

    return new Response(JSON.stringify({
      success: true, sentTo: sentEmails, failed: failedEmails,
      message: `${form.form_title} request sent to ${sentEmails.length} passenger(s)`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error in send-custom-form-request:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);