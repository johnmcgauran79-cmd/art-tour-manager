import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
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

    // Fetch tour data
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("*")
      .eq("id", tourId)
      .single();

    if (tourError || !tour) {
      throw new Error(`Failed to fetch tour: ${tourError?.message}`);
    }

    // Fetch itinerary data
    const { data: itinerary, error: itineraryError } = await supabase
      .from("tour_itineraries")
      .select("*")
      .eq("id", itineraryId)
      .single();

    if (itineraryError || !itinerary) {
      throw new Error(`Failed to fetch itinerary: ${itineraryError?.message}`);
    }

    // Fetch itinerary days
    const { data: days, error: daysError } = await supabase
      .from("tour_itinerary_days")
      .select("*")
      .eq("itinerary_id", itineraryId)
      .order("day_number");

    if (daysError) {
      throw new Error(`Failed to fetch itinerary days: ${daysError.message}`);
    }

    // Fetch itinerary entries for each day
    const { data: entries, error: entriesError } = await supabase
      .from("tour_itinerary_entries")
      .select("*")
      .in("day_id", days?.map(d => d.id) || [])
      .order("sort_order");

    if (entriesError) {
      throw new Error(`Failed to fetch itinerary entries: ${entriesError.message}`);
    }

    // Fetch hotels if requested
    let hotels: any[] = [];
    if (includeHotels) {
      const { data: hotelData, error: hotelError } = await supabase
        .from("hotels")
        .select("*")
        .eq("tour_id", tourId)
        .order("default_check_in");

      if (!hotelError && hotelData) {
        hotels = hotelData;
      }
    }

    // Process days with their entries
    const processedDays = days?.map(day => ({
      ...day,
      entries: entries?.filter(e => e.day_id === day.id) || []
    })) || [];

    // Generate HTML content
    const htmlContent = generateHTML(tour, itinerary, processedDays, hotels, {
      includeHotels,
      includeTourInfo,
    });

    // Prepare email options
    const emailSubject = subject || `${tour.name} - Tour Itinerary`;
    const fromAddress = fromEmail || "bookings@australianracingtours.com.au";

    let emailBody = "";
    if (message) {
      emailBody = `<p style="margin-bottom: 20px;">${message.replace(/\n/g, '<br>')}</p>`;
    }
    emailBody += htmlContent;

    const emailOptions: any = {
      from: fromAddress,
      to: recipientEmail,
      subject: emailSubject,
      html: emailBody,
    };

    // Add CC and BCC if provided
    if (ccEmails && ccEmails.length > 0) {
      emailOptions.cc = ccEmails;
    }
    if (bccEmails && bccEmails.length > 0) {
      emailOptions.bcc = bccEmails;
    }

    // Send email via Resend
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

function generateHTML(tour: any, itinerary: any, days: any[], hotels: any[], options: any): string {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    return timeStr;
  };

  let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #1e40af;
          }
          .header h1 {
            color: #1e40af;
            margin: 0 0 10px 0;
            font-size: 32px;
          }
          .tour-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .tour-info h2 {
            color: #1e40af;
            margin-top: 0;
            font-size: 20px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-weight: 600;
            color: #64748b;
            font-size: 14px;
            margin-bottom: 4px;
          }
          .info-value {
            color: #334155;
            font-size: 16px;
          }
          .accommodation-section {
            background: #fef3c7;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .accommodation-section h2 {
            color: #92400e;
            margin-top: 0;
            font-size: 20px;
          }
          .hotel-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            border-left: 4px solid #f59e0b;
          }
          .hotel-name {
            font-weight: 600;
            color: #92400e;
            font-size: 18px;
            margin-bottom: 8px;
          }
          .hotel-details {
            color: #78716c;
            font-size: 14px;
          }
          .day-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .day-header {
            background: #1e40af;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 15px;
          }
          .day-title {
            margin: 0;
            font-size: 22px;
            font-weight: 600;
          }
          .day-date {
            margin: 5px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .entry {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 15px;
          }
          .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 12px;
          }
          .entry-subject {
            font-weight: 600;
            color: #1e293b;
            font-size: 18px;
          }
          .entry-time {
            color: #64748b;
            font-size: 14px;
            font-weight: 500;
          }
          .entry-content {
            color: #475569;
            line-height: 1.7;
          }
          @media print {
            body {
              padding: 10px;
            }
            .day-section {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${tour.name}</h1>
          <p style="color: #64748b; margin: 10px 0 0 0; font-size: 18px;">Tour Itinerary</p>
        </div>
  `;

  // Add tour information if requested
  if (options.includeTourInfo) {
    html += `
      <div class="tour-info">
        <h2>Tour Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Location</span>
            <span class="info-value">${tour.location || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Tour Host</span>
            <span class="info-value">${tour.tour_host || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Start Date</span>
            <span class="info-value">${formatDate(tour.start_date)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">End Date</span>
            <span class="info-value">${formatDate(tour.end_date)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Duration</span>
            <span class="info-value">${tour.days} days, ${tour.nights} nights</span>
          </div>
    `;

    if (tour.pickup_point) {
      html += `
          <div class="info-item">
            <span class="info-label">Pickup Point</span>
            <span class="info-value">${tour.pickup_point}</span>
          </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  // Add accommodation section if requested and hotels exist
  if (options.includeHotels && hotels.length > 0) {
    html += `
      <div class="accommodation-section">
        <h2>Accommodation</h2>
    `;

    hotels.forEach(hotel => {
      html += `
        <div class="hotel-item">
          <div class="hotel-name">${hotel.name}</div>
          <div class="hotel-details">
      `;

      if (hotel.address) {
        html += `<div>${hotel.address}</div>`;
      }
      if (hotel.contact_phone) {
        html += `<div>Phone: ${hotel.contact_phone}</div>`;
      }
      if (hotel.default_check_in && hotel.default_check_out) {
        html += `<div>Check-in: ${formatDate(hotel.default_check_in)} | Check-out: ${formatDate(hotel.default_check_out)}</div>`;
      }

      html += `
          </div>
        </div>
      `;
    });

    html += `</div>`;
  }

  // Add daily itinerary
  days.forEach((day, index) => {
    html += `
      <div class="day-section">
        <div class="day-header">
          <h2 class="day-title">Day ${day.day_number}</h2>
          <p class="day-date">${formatDate(day.activity_date)}</p>
        </div>
    `;

    if (day.entries && day.entries.length > 0) {
      day.entries.forEach((entry: any) => {
        html += `
        <div class="entry">
          <div class="entry-header">
            <span class="entry-subject">${entry.subject}</span>
            ${entry.time_slot ? `<span class="entry-time">${formatTime(entry.time_slot)}</span>` : ''}
          </div>
          ${entry.content ? `<div class="entry-content">${entry.content}</div>` : ''}
        </div>
        `;
      });
    } else {
      html += `<p style="color: #94a3b8; font-style: italic; padding: 20px;">No activities scheduled for this day</p>`;
    }

    html += `</div>`;
  });

  html += `
      </body>
    </html>
  `;

  return html;
}
