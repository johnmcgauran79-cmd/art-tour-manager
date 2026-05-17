// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_WEBSITE_URL = "https://admin.australianracingtours.com.au";
const ADMIN_CC = "admin@australianracingtours.com.au";

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
    const html = render(template.content_template, mergeData);
    const fromAddress = template.from_email || "bookings@australianracingtours.com.au";

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