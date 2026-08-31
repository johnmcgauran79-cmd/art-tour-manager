// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBrandForTour } from "../_shared/brand.ts";
import { emailAttachmentUrl } from "../_shared/emailFileUrl.ts";
import { buildBrandTypography, type BrandTypography } from "../_shared/brandFonts.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_WEBSITE_URL = "https://admin.australianracingtours.com.au";
const ADMIN_CC = "admin@australianracingtours.com.au";
const DEFAULT_HEADER_IMAGE_URL =
  "https://art-tour-manager.lovable.app/images/email-header-default.png";

// Branded ART email wrapper — same chrome as booking confirmation emails
const wrapBrandedEmail = (content: string, headerImageUrl?: string, typo?: BrandTypography | null): string => {
  const logoUrl = headerImageUrl || DEFAULT_HEADER_IMAGE_URL;
  const t = typo || buildBrandTypography(null);
  return `<!DOCTYPE html>
<html>
<head>
${t.headHtml}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    .email-body p, .email-body li, .email-body div {
      font-family: ${t.bodyFont};
      font-size: ${t.bodySize}px;
      line-height: ${t.lineHeight};
      color: #55575d;
    }
    .email-body h1, .email-body h2, .email-body h3, .email-body h4 {
      font-family: ${t.headingFont};
      line-height: 1.3;
      color: #1a2332;
      text-transform: ${t.headingUppercase ? 'uppercase' : 'none'};
    }
    .email-body h1 { font-size: ${t.headingSize + 6}px; }
    .email-body h2 { font-size: ${t.headingSize + 2}px; }
    .email-body h3, .email-body h4, .email-body .art-section-heading { font-size: ${t.headingSize}px; font-weight: ${t.headingWeight}; }
    .email-body strong, .email-body b { color: #1a2332; }
    .email-body p { margin: 0 0 12px 0; }
    .email-body ul, .email-body ol { margin: 0 0 16px 0; padding-left: 24px; }
    .email-body li { margin-bottom: 4px; }
    .email-body a { color: #1a6fb5; }
    .email-body hr { border: none; border-top: 2px solid #e5e7eb; margin: 24px 0; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: ${t.bodyFont};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 800px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color: #232628; padding: 32px 40px; text-align: center;">
              <img src="${logoUrl}" alt="Australian Racing Tours" style="height: 80px; max-width: 400px; width: auto;" />
            </td>
          </tr>
          <tr>
            <td class="email-body" style="padding: 40px; ${t.bodyStyle} color: #55575d;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; ${t.smallStyle} text-align: center; margin: 0;">Australian Racing Tours</p>
              <p style="color: #9ca3af; ${t.smallStyle} text-align: center; margin: 5px 0 0;">Host pre-tour briefing.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Australian dd/mm/yyyy date formatter
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "";
  // d expected as YYYY-MM-DD or ISO; parse safely without TZ shift
  const part = String(d).slice(0, 10).split("-");
  if (part.length === 3) return `${part[2]}/${part[1]}/${part[0]}`;
  return String(d);
};

const render = (tpl: string, data: Record<string, any>) =>
  tpl.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_m, k) => {
    const v = data[k];
    return v === undefined || v === null ? "" : String(v);
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tourId, hostUserId, ruleId, batchId } = await req.json();
    if (!tourId || !hostUserId) {
      return new Response(
        JSON.stringify({ error: "tourId and hostUserId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch tour
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("id, name, start_date, end_date, location, pickup_point")
      .eq("id", tourId)
      .single();
    if (tourError || !tour) throw new Error(`Tour not found: ${tourError?.message}`);

    // Fetch host profile + email
    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", hostUserId)
      .maybeSingle();

    let hostEmail = hostProfile?.email;
    let hostFirstName = hostProfile?.first_name || "";

    // Fallback to auth.users via admin API if missing
    if (!hostEmail) {
      const { data: au } = await supabase.auth.admin.getUserById(hostUserId);
      hostEmail = au?.user?.email || "";
      if (!hostFirstName) {
        const md = (au?.user?.user_metadata || {}) as any;
        hostFirstName = md.first_name || (hostEmail ? hostEmail.split("@")[0] : "");
      }
    }
    if (!hostEmail) throw new Error("Host has no email address on file");

    // First hotel (by check-in date)
    const { data: hotels } = await supabase
      .from("hotels")
      .select("name, address, contact_phone, default_check_in")
      .eq("tour_id", tourId)
      .order("default_check_in", { ascending: true, nullsFirst: false })
      .limit(1);
    const firstHotel = hotels?.[0];

    // Booking & passenger summary
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, passenger_count, status")
      .eq("tour_id", tourId)
      .neq("status", "cancelled")
      .neq("status", "waitlisted");
    const bookingCount = bookings?.length || 0;
    const passengerCount =
      bookings?.reduce((s: number, b: any) => s + (b.passenger_count || 0), 0) || 0;

    // Generate secure 7-day token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenError } = await supabase
      .from("host_briefing_tokens")
      .insert({
        tour_id: tourId,
        host_user_id: hostUserId,
        token,
        expires_at: expiresAt,
      });
    if (tokenError) throw new Error(`Failed to create token: ${tokenError.message}`);

    const combinedReportLink = `${ADMIN_WEBSITE_URL}/host-report/${token}`;

    // Load template (default for host_pre_tour_briefing)
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("type", "host_pre_tour_briefing")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) throw new Error("No active host_pre_tour_briefing email template");

    // Resolve the tour's brand for header, colours, and sender identity.
    const brand = await getBrandForTour(supabase, tourId);
    const headerImageUrl = (template as any).header_image_url || brand.headerImageUrl;

    const mergeData = {
      host_first_name: hostFirstName || "there",
      host_username: hostEmail,
      tour_name: tour.name,
      tour_start_date: fmtDate(tour.start_date),
      tour_end_date: fmtDate(tour.end_date),
      tour_location: tour.location || "",
      meeting_location: tour.pickup_point || tour.location || "",
      first_hotel_name: firstHotel?.name || "TBC",
      first_hotel_address: firstHotel?.address || "",
      first_hotel_phone: firstHotel?.contact_phone || "",
      first_hotel_checkin: fmtDate(firstHotel?.default_check_in),
      passenger_count: String(passengerCount),
      booking_count: String(bookingCount),
      admin_website_url: ADMIN_WEBSITE_URL,
      forgot_password_url: `${ADMIN_WEBSITE_URL}/login`,
      combined_report_link: combinedReportLink,
    };

    const subject = render(template.subject_template, mergeData);
    // Resolve {{attachment:slug}} tokens to public URLs from email_attachments
    let contentWithAttachments = template.content_template as string;
    const attachmentSlugs = Array.from(
      contentWithAttachments.matchAll(/\{\{\s*attachment:([a-zA-Z0-9_-]+)\s*\}\}/g),
    ).map((m) => m[1]);
    if (attachmentSlugs.length > 0) {
      const uniqueSlugs = Array.from(new Set(attachmentSlugs));
      const { data: atts } = await supabase
        .from("email_attachments")
        .select("id, slug")
        .in("slug", uniqueSlugs);
      // Always resolve through the permanent email-file route (rather than the
      // stored file_url) so links keep working for rows created before the
      // email-attachments bucket was made private.
      const urlBySlug = new Map(
        (atts || []).map((a: any) => [a.slug, emailAttachmentUrl(a.id)]),
      );
      contentWithAttachments = contentWithAttachments.replace(
        /\{\{\s*attachment:([a-zA-Z0-9_-]+)\s*\}\}/g,
        (_m, slug) => urlBySlug.get(slug) || "",
      );
    }
    const rawHtml = render(contentWithAttachments, mergeData);
    const html = wrapBrandedEmail(rawHtml, headerImageUrl);
    const senderName = brand.senderName;
    const fromEmail = template.from_email || brand.fromEmailClient;
    // Strip any existing "Name <email>" formatting from from_email before re-wrapping
    const bareEmail = fromEmail.match(/<([^>]+)>/)?.[1] || fromEmail;
    const fromAddress = `${senderName} <${bareEmail}>`;

    const emailResponse: any = await resend.emails.send({
      from: fromAddress,
      to: hostEmail,
      cc: [ADMIN_CC],
      subject,
      html,
    });

    if (emailResponse?.error) {
      throw new Error(`Resend error: ${emailResponse.error.message || JSON.stringify(emailResponse.error)}`);
    }

    const messageId = emailResponse?.data?.id || emailResponse?.id || "unknown";

    // Log to email_logs for reporting
    await supabase.from("email_logs").insert({
      tour_id: tourId,
      recipient_email: hostEmail,
      recipient_name: `${hostFirstName} (host)`.trim(),
      subject,
      message_id: messageId,
      sent_at: new Date().toISOString(),
      template_name: "host_pre_tour_briefing",
      rendered_html: html,
      from_email: fromAddress,
    });

    return new Response(
      JSON.stringify({ success: true, sentTo: hostEmail, messageId, combinedReportLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("send-host-briefing-email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});