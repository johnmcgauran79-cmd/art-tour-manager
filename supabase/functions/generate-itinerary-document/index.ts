import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  tourId: string;
  itineraryId: string;
  format: 'pdf' | 'html';
  options: {
    includeHotels: boolean;
    includeTourInfo: boolean;
    includeAdditionalInfo?: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { tourId, itineraryId, format, options } = body;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch tour data
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('*')
      .eq('id', tourId)
      .single();

    if (tourError) throw tourError;

    // Fetch itinerary with days and entries
    const { data: itinerary, error: itineraryError } = await supabase
      .from('tour_itineraries')
      .select('*')
      .eq('id', itineraryId)
      .single();

    if (itineraryError) throw itineraryError;

    const { data: days, error: daysError } = await supabase
      .from('tour_itinerary_days')
      .select('*')
      .eq('itinerary_id', itineraryId)
      .order('day_number');

    if (daysError) throw daysError;

    const { data: entries, error: entriesError } = await supabase
      .from('tour_itinerary_entries')
      .select('*')
      .in('day_id', days.map(day => day.id))
      .order('sort_order');

    if (entriesError) throw entriesError;

    // Fetch hotels if included
    let hotels = [];
    if (options.includeHotels) {
      const { data: hotelsData, error: hotelsError } = await supabase
        .from('hotels')
        .select('*')
        .eq('tour_id', tourId);

      if (hotelsError) throw hotelsError;
      hotels = (hotelsData || []).sort((a: any, b: any) => {
        if (!a.default_check_in && !b.default_check_in) return 0;
        if (!a.default_check_in) return 1;
        if (!b.default_check_in) return -1;
        return new Date(a.default_check_in).getTime() - new Date(b.default_check_in).getTime();
      });
    }

    // Fetch additional info sections if included
    let additionalInfoSections = [];
    if (options.includeAdditionalInfo) {
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('tour_additional_info_sections')
        .select('*')
        .eq('tour_id', tourId)
        .eq('is_visible', true)
        .order('sort_order', { ascending: true });

      if (sectionsError) throw sectionsError;
      additionalInfoSections = sectionsData || [];
    }

    // Process data
    const daysWithEntries = days.map(day => ({
      ...day,
      entries: entries.filter(entry => entry.day_id === day.id)
    }));

    // Generate HTML
    const html = generateHTML(tour, itinerary, daysWithEntries, hotels, additionalInfoSections, options);

    if (format === 'html') {
      return new Response(JSON.stringify({ html }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate PDF using puppeteer
    try {
      const pdfResponse = await fetch('https://api.htmlcsstoimage.com/v1/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('your-user-id:your-api-key'), // You would need to add these as secrets
        },
        body: JSON.stringify({
          html: html,
          css: '',
          google_fonts: 'Arial',
          format: 'pdf',
          width: 800,
          height: 1200,
          quality: 100
        })
      });

      if (!pdfResponse.ok) {
        console.error('PDF generation failed, falling back to browser print API');
        // Fallback to simpler approach using browser's print functionality
        return new Response(JSON.stringify({ 
          html,
          isPrintReady: true,
          format: 'pdf'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pdfBuffer = await pdfResponse.arrayBuffer();
      
      return new Response(JSON.stringify({ 
        pdfBuffer: Array.from(new Uint8Array(pdfBuffer))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      // Fallback to HTML with print-ready styling
      return new Response(JSON.stringify({ 
        html,
        isPrintReady: true,
        format: 'pdf'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('Error generating document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateHTML(tour: any, itinerary: any, days: any[], hotels: any[], additionalInfoSections: any[], options: any): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Brand palette (matches branded itinerary design)
  const NAVY = '#1d3155';
  const NAVY_DARK = '#16263f';
  const GOLD = '#b8860b';
  const INK = '#2b2b2b';
  const MUTED = '#6b6b6b';

  const subtitle = tour.location ? tour.location : '';
  const runningTitle = `${(tour.name || '').toUpperCase()}${subtitle ? `&nbsp;&nbsp;|&nbsp;&nbsp;${subtitle}` : ''}`;

  // Build inclusions / exclusions
  const inclusions = tour.inclusions
    ? tour.inclusions.split('\n').map((l: string) => l.trim()).filter(Boolean)
    : [];
  const exclusions = tour.exclusions
    ? tour.exclusions.split('\n').map((l: string) => l.trim()).filter(Boolean)
    : [];

  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tour.name} - Itinerary</title>
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: Helvetica, Arial, sans-serif;
          line-height: 1.55;
          color: ${INK};
          font-size: 10.5pt;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .page {
          max-width: 760px;
          margin: 0 auto;
          padding: 0 8px;
        }
        /* ---------- Cover ---------- */
        .cover {
          page-break-after: always;
          break-after: page;
        }
        .cover-banner {
          background: ${NAVY};
          color: #fff;
          text-align: center;
          padding: 70px 40px 56px;
        }
        .cover-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 40pt;
          font-weight: 700;
          letter-spacing: 1px;
          margin: 0;
          line-height: 1.1;
          text-transform: uppercase;
        }
        .cover-dates {
          color: ${GOLD};
          font-size: 15pt;
          margin-top: 26px;
        }
        .cover-meta {
          color: #c9d2df;
          font-size: 12pt;
          margin-top: 14px;
          letter-spacing: 0.5px;
        }
        .cover-rule {
          height: 10px;
          background: ${GOLD};
        }
        .glance {
          text-align: center;
          padding: 48px 30px 10px;
        }
        .glance h2 {
          color: ${NAVY};
          font-size: 13pt;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin: 0 0 26px;
        }
        .glance-item {
          color: ${INK};
          font-size: 11.5pt;
          margin: 9px 0;
        }
        .glance-item .tick { color: ${GOLD}; font-weight: 700; margin-right: 6px; }
        .glance-divider {
          width: 80%;
          margin: 34px auto 22px;
          border: none;
          border-top: 1px solid ${GOLD};
        }
        .glance-excl {
          color: ${MUTED};
          font-style: italic;
          font-size: 10.5pt;
          text-align: center;
          padding: 0 30px;
        }
        /* ---------- Running header ---------- */
        .run-head {
          border-bottom: 2px solid ${GOLD};
          padding: 26px 0 8px;
          margin-bottom: 22px;
          font-size: 10pt;
          color: ${MUTED};
        }
        .run-head strong { color: ${NAVY}; letter-spacing: 0.5px; }
        /* ---------- Section headings ---------- */
        .section { page-break-before: always; break-before: page; }
        .section-first { page-break-before: avoid; break-before: avoid; }
        .section-title {
          color: ${NAVY};
          font-size: 17pt;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin: 0 0 4px;
          padding-bottom: 8px;
          border-bottom: 2px solid ${GOLD};
        }
        /* ---------- Accommodation table ---------- */
        .acc-table {
          width: 100%;
          border-collapse: collapse;
          margin: 18px 0 8px;
          font-size: 10pt;
        }
        .acc-table th {
          background: ${NAVY};
          color: #fff;
          text-align: left;
          padding: 9px 12px;
          font-weight: 700;
        }
        .acc-table td {
          background: #f1f1ee;
          padding: 10px 12px;
          vertical-align: top;
          border-bottom: 4px solid #fff;
        }
        /* ---------- Day by day ---------- */
        .day {
          padding: 14px 0 16px;
          border-bottom: 1px solid ${GOLD};
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .day-head { margin: 0 0 8px; }
        .day-num { color: ${NAVY}; font-weight: 700; font-size: 12.5pt; }
        .day-date { color: ${MUTED}; font-size: 11pt; margin: 0 8px; }
        .day-name { color: ${GOLD}; font-weight: 700; font-size: 11.5pt; letter-spacing: 0.5px; text-transform: uppercase; }
        .activity { margin: 8px 0; }
        .activity-time {
          color: ${NAVY}; font-weight: 700; font-size: 10pt; margin-right: 6px;
        }
        .activity-title { font-weight: 700; color: ${NAVY}; }
        .activity-content { color: ${INK}; margin-top: 2px; }
        .activity-content p { margin: 0.4em 0; }
        .activity-content ul, .activity-content ol { margin: 0.4em 0; padding-left: 1.2em; }
        .activity-content a { color: ${NAVY}; }
        /* ---------- Additional info ---------- */
        .info-block { margin: 16px 0; page-break-inside: avoid; break-inside: avoid; }
        .info-name {
          color: ${NAVY}; font-weight: 700; font-size: 11.5pt; text-transform: uppercase;
          letter-spacing: 0.5px; margin: 0 0 4px;
        }
        .info-content { color: ${INK}; }
        .info-content p { margin: 0.4em 0; }
        .info-content ul, .info-content ol { margin: 0.4em 0; padding-left: 1.2em; }
        .info-content a { color: ${NAVY}; }
        @media print {
          @page { margin: 14mm; size: A4; }
          @page :first { margin: 0; }
          .cover { margin: 0; }
          .page { max-width: none; padding: 0; }
        }
      </style>
    </head>
    <body>
      <!-- ===== Cover ===== -->
      <div class="cover">
        <div class="cover-banner">
          <h1 class="cover-title">${tour.name}</h1>
          <div class="cover-dates">${formatDate(tour.start_date)} &ndash; ${formatDate(tour.end_date)}</div>
          <div class="cover-meta">${tour.days} Days &nbsp;&middot;&nbsp; ${tour.nights} Nights${subtitle ? ` &nbsp;&middot;&nbsp; ${subtitle}` : ''}</div>
        </div>
        <div class="cover-rule"></div>
  `;

  if (options.includeTourInfo && (inclusions.length > 0 || exclusions.length > 0)) {
    html += `<div class="glance">`;
    if (inclusions.length > 0) {
      html += `<h2>Tour Inclusions at a Glance</h2>`;
      inclusions.forEach((item: string) => {
        html += `<div class="glance-item"><span class="tick">&#10003;</span>${item}</div>`;
      });
    }
    if (exclusions.length > 0) {
      html += `<hr class="glance-divider"><div class="glance-excl">${exclusions.join(' &middot; ')} not included</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`; // end cover

  // ===== Accommodation =====
  if (options.includeHotels && hotels.length > 0) {
    html += `
      <div class="page section section-first">
        <div class="run-head"><strong>${runningTitle}</strong></div>
        <h2 class="section-title">Accommodation</h2>
        <table class="acc-table">
          <thead>
            <tr><th>Hotel</th><th>Address</th><th>Room Type</th><th>Check-in</th><th>Check-out</th></tr>
          </thead>
          <tbody>
    `;
    hotels.forEach((hotel: any) => {
      html += `
        <tr>
          <td>${hotel.name || ''}</td>
          <td>${hotel.address || '&mdash;'}</td>
          <td>${hotel.default_room_type || '&mdash;'}</td>
          <td>${hotel.default_check_in ? formatDateShort(hotel.default_check_in) : '&mdash;'}</td>
          <td>${hotel.default_check_out ? formatDateShort(hotel.default_check_out) : '&mdash;'}</td>
        </tr>
      `;
    });
    html += `</tbody></table></div>`;
  }

  // ===== Day by day =====
  const itinFirstClass = (options.includeHotels && hotels.length > 0) ? '' : ' section-first';
  html += `
    <div class="page section${itinFirstClass}">
      <div class="run-head"><strong>${runningTitle}</strong></div>
      <h2 class="section-title">Day-by-Day Itinerary</h2>
  `;

  days.forEach((day: any) => {
    const firstEntry = day.entries[0];
    const dayName = firstEntry ? firstEntry.subject : '';
    html += `
      <div class="day">
        <div class="day-head">
          <span class="day-num">Day ${day.day_number}</span>
          <span class="day-date">${formatDate(day.activity_date)}</span>
          ${dayName ? `<span class="day-name">${dayName}</span>` : ''}
        </div>
    `;

    if (day.entries.length === 0) {
      html += `<p style="color:${MUTED};font-style:italic;">No activities planned for this day.</p>`;
    } else {
      day.entries.forEach((entry: any, idx: number) => {
        const showTitle = idx > 0; // first entry's subject already shown in the day header
        html += `<div class="activity">`;
        if (entry.time_slot) html += `<span class="activity-time">${formatTime(entry.time_slot)}</span>`;
        if (showTitle && entry.subject) html += `<span class="activity-title">${entry.subject}</span>`;
        if (entry.content) html += `<div class="activity-content">${entry.content}</div>`;
        html += `</div>`;
      });
    }
    html += `</div>`;
  });
  html += `</div>`;

  // ===== Additional information =====
  if (options.includeAdditionalInfo && additionalInfoSections.length > 0) {
    html += `
      <div class="page section">
        <div class="run-head"><strong>${runningTitle}</strong></div>
        <h2 class="section-title">Additional Information</h2>
    `;
    additionalInfoSections.forEach((section: any) => {
      html += `
        <div class="info-block">
          <div class="info-name">${section.name}</div>
          ${section.content ? `<div class="info-content">${section.content}</div>` : `<p style="color:${MUTED};font-style:italic;">No content.</p>`}
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `</body></html>`;

  return html;
}