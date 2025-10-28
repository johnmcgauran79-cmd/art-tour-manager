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
      hotels = hotelsData || [];
    }

    // Process data
    const daysWithEntries = days.map(day => ({
      ...day,
      entries: entries.filter(entry => entry.day_id === day.id)
    }));

    // Generate HTML
    const html = generateHTML(tour, itinerary, daysWithEntries, hotels, options);

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

  } catch (error) {
    console.error('Error generating document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateHTML(tour: any, itinerary: any, days: any[], hotels: any[], options: any): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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

  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tour.name} - Itinerary</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          color: #333;
          font-size: 11pt;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid hsl(220, 8%, 15%);
          padding-bottom: 20px;
        }
        .tour-title {
          color: hsl(220, 8%, 15%);
          font-size: 2.5em;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .tour-dates {
          font-size: 1.2em;
          color: #666;
          margin-bottom: 5px;
        }
        .tour-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          border-left: 4px solid hsl(45, 100%, 55%);
        }
        .hotels-section {
          margin-bottom: 30px;
        }
        .hotel-card {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          border-left: 4px solid hsl(42, 87%, 55%);
        }
        .hotel-name {
          font-size: 1.3em;
          color: hsl(220, 8%, 15%);
          margin-bottom: 10px;
          font-weight: 600;
        }
        .day-card {
          background: #fff;
          border: 1px solid #ddd;
          border-left: 4px solid hsl(220, 8%, 15%);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .day-header {
          background: hsl(220, 8%, 15%);
          color: white;
          padding: 10px 15px;
          margin: -20px -20px 15px -20px;
          border-radius: 4px 4px 0 0;
        }
        .day-number {
          font-weight: bold;
          font-size: 1.1em;
        }
        .activity {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 10px;
          border-left: 3px solid hsl(45, 100%, 55%);
        }
        .activity-time {
          background: hsl(220, 8%, 15%);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.9em;
          display: inline-block;
          margin-bottom: 8px;
        }
        .activity-title {
          font-weight: bold;
          color: hsl(220, 8%, 15%);
          margin-bottom: 8px;
        }
        .activity-content {
          color: #555;
          line-height: 1.8;
        }
        .activity-content p {
          margin: 0.5em 0;
        }
        .activity-content ul, .activity-content ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        .activity-content li {
          margin: 0.25em 0;
        }
        .activity-content strong {
          font-weight: 600;
        }
        .activity-content em {
          font-style: italic;
        }
        .activity-content a {
          color: hsl(220, 8%, 15%);
          text-decoration: underline;
        }
        .section-title {
          color: hsl(220, 8%, 15%);
          border-bottom: 2px solid hsl(45, 100%, 55%);
          padding-bottom: 5px;
          margin-bottom: 20px;
        }
        @media print {
          @page {
            margin: 20mm;
            size: A4;
          }
          body { 
            font-size: 10pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .day-card { 
            page-break-before: auto;
            page-break-after: auto;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            margin-bottom: 20px;
            min-height: 100px;
          }
          .day-header {
            page-break-after: avoid !important;
            break-after: avoid-page !important;
          }
          .activity {
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }
          h1, h2, h3 {
            page-break-after: avoid !important;
            break-after: avoid-page !important;
          }
          .tour-info, .hotels-section {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="tour-title">${tour.name}</h1>
        <div class="tour-dates">${formatDate(tour.start_date)} - ${formatDate(tour.end_date)}</div>
        <div>${tour.days} Days, ${tour.nights} Nights</div>
      </div>
  `;

  if (options.includeTourInfo) {
    // Process inclusions into bullet list
    const inclusionsList = tour.inclusions 
      ? tour.inclusions.split('\n').filter((line: string) => line.trim()).map((line: string) => `<li>${line.trim()}</li>`).join('')
      : '';
    
    // Process exclusions into bullet list
    const exclusionsList = tour.exclusions 
      ? tour.exclusions.split('\n').filter((line: string) => line.trim()).map((line: string) => `<li>${line.trim()}</li>`).join('')
      : '';
    
    html += `
      <div class="tour-info">
        <h2 class="section-title">Tour Information</h2>
        <p><strong>Location:</strong> ${tour.location || 'N/A'}</p>
        <p><strong>Pickup Point:</strong> ${tour.pickup_point || 'N/A'}</p>
        ${tour.notes ? `<p><strong>Notes:</strong> ${tour.notes}</p>` : ''}
        ${inclusionsList ? `<div><strong>Inclusions:</strong><ul style="margin-top: 8px;">${inclusionsList}</ul></div>` : ''}
        ${exclusionsList ? `<div><strong>Exclusions:</strong><ul style="margin-top: 8px;">${exclusionsList}</ul></div>` : ''}
      </div>
    `;
  }

  if (options.includeHotels && hotels.length > 0) {
    html += `
      <div class="hotels-section">
        <h2 class="section-title">Accommodation</h2>
    `;

    hotels.forEach(hotel => {
      html += `
        <div class="hotel-card">
          <div class="hotel-name">${hotel.name}</div>
          ${hotel.address ? `<p><strong>Address:</strong> ${hotel.address}</p>` : ''}
          ${hotel.default_room_type ? `<p><strong>Room Type:</strong> ${hotel.default_room_type}</p>` : ''}
          ${hotel.default_check_in && hotel.default_check_out ? 
            `<p><strong>Check-in:</strong> ${formatDate(hotel.default_check_in)} | 
             <strong>Check-out:</strong> ${formatDate(hotel.default_check_out)}</p>` : ''}
          ${hotel.contact_phone ? `<p><strong>Phone:</strong> ${hotel.contact_phone}</p>` : ''}
        </div>
      `;
    });

    html += '</div>';
  }

  html += `
    <div class="itinerary-section">
      <h2 class="section-title">Daily Itinerary</h2>
  `;

  days.forEach(day => {
    html += `
      <div class="day-card">
        <div class="day-header">
          <span class="day-number">Day ${day.day_number}</span> - ${formatDate(day.activity_date)}
        </div>
    `;

    if (day.entries.length === 0) {
      html += '<p style="color: #666; font-style: italic;">No activities planned for this day.</p>';
    } else {
      day.entries.forEach((entry: any) => {
        html += `
          <div class="activity">
            ${entry.time_slot ? `<div class="activity-time">${formatTime(entry.time_slot)}</div>` : ''}
            <div class="activity-title">${entry.subject}</div>
            ${entry.content ? `<div class="activity-content">${entry.content}</div>` : ''}
          </div>
        `;
      });
    }

    html += '</div>';
  });

  html += `
      </div>
    </body>
    </html>
  `;

  return html;
}