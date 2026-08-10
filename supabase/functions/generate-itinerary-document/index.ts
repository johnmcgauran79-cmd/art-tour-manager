import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { getBrandForTour } from "../_shared/brand.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== Cancellation policy helpers (kept in sync with src/lib/cancellationPolicy.ts) =====
const DEFAULT_CANCELLATION_POLICY = {
  title: 'Cancellation Policy',
  rows: [
    { notice: '180+ days prior to departure', refund: 'Full refund, less 10% administration fee' },
    { notice: '90\u2013179 days prior to departure', refund: '50% refund of all payments made' },
    { notice: 'Within 90 days of departure', refund: 'No refund available' },
  ],
};

function normaliseCancellationPolicy(value: any) {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CANCELLATION_POLICY };
  const title = typeof value.title === 'string' && value.title.trim() ? value.title : DEFAULT_CANCELLATION_POLICY.title;
  const rawRows = Array.isArray(value.rows) ? value.rows : [];
  const rows = rawRows
    .map((r: any) => ({
      notice: typeof r?.notice === 'string' ? r.notice : '',
      refund: typeof r?.refund === 'string' ? r.refund : '',
    }))
    .filter((r: any) => r.notice.trim() || r.refund.trim());
  return { title, rows: rows.length ? rows : DEFAULT_CANCELLATION_POLICY.rows };
}

function escapeCpHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCancellationPolicyTableHtml(policy: any, navy = '#232628', headerText = '#ffffff'): string {
  const rowsHtml = (policy.rows || []).map((row: any, i: number) => {
    const bg = i % 2 === 1 ? '#f3f4f6' : '#ffffff';
    return `<tr>
      <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#1a2332;border-bottom:1px solid #e5e7eb;width:42%;vertical-align:top;">${escapeCpHtml(row.notice)}</td>
      <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#55575d;border-bottom:1px solid #e5e7eb;vertical-align:top;">${escapeCpHtml(row.refund)}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">
    <tr><th colspan="2" style="padding:12px 14px;background-color:${navy};color:${headerText};text-align:left;font-size:15px;font-weight:600;">${escapeCpHtml(policy.title)}</th></tr>
    <tr>
      <th style="padding:8px 14px;background-color:${navy};color:${headerText};text-align:left;font-size:13px;font-weight:600;border-top:1px solid rgba(255,255,255,0.15);width:42%;">Notice Period</th>
      <th style="padding:8px 14px;background-color:${navy};color:${headerText};text-align:left;font-size:13px;font-weight:600;border-top:1px solid rgba(255,255,255,0.15);">Refund</th>
    </tr>
    ${rowsHtml}
  </table>`;
}

interface RequestBody {
  tourId: string;
  itineraryId: string;
  format: 'pdf' | 'html';
  options: {
    includeHotels: boolean;
    includeTourInfo: boolean;
    includeAdditionalInfo?: boolean;
    includeWelcomeMessage?: boolean;
    includeFillerImages?: boolean;
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
        .eq('include_in_guest_document', true)
        .order('sort_order', { ascending: true });

      if (sectionsError) throw sectionsError;
      additionalInfoSections = sectionsData || [];
    }

    // Resolve the tour's brand for document colours and footer identity.
    const brand = await getBrandForTour(supabase, tourId);
    let brandNavy = brand.colorPrimary || '#232628';
    const brandAccent = brand.colorAccent || '#c79a2e';
    const brandName = brand.name;
    let globalCancellationPolicy: any = null;
    try {
      const { data: settingsData } = await supabase
        .from('general_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['cancellation_policy']);
      const cpRow = (settingsData || []).find((s: any) => s.setting_key === 'cancellation_policy');
      globalCancellationPolicy = cpRow ? cpRow.setting_value : null;
    } catch (_e) {
      // fall back to default brand colour
    }

    // Resolve the cancellation policy for this tour (override falls back to global)
    const cancellationPolicy = (options.includeAdditionalInfo && (tour.cancellation_policy_enabled ?? true))
      ? normaliseCancellationPolicy(tour.cancellation_policy_override ?? globalCancellationPolicy)
      : null;

    // Resolve the welcome message (host welcome) for the cover page
    let welcomeMessage: any = null;
    // The Guest Document option is the source of truth for document inclusion.
    // Keep the tour-level enabled flag for the customer-facing preview, but do not
    // silently discard a configured welcome when staff explicitly include it here.
    const hasConfiguredWelcome = Boolean(
      tour.welcome_message_body ||
      tour.welcome_message_signoff ||
      tour.welcome_message_image_path
    );
    if ((options.includeWelcomeMessage ?? true) && hasConfiguredWelcome) {
      let imageUrl: string | null = null;
      if (tour.welcome_message_image_path) {
        try {
          const { data: signed } = await supabase.storage
            .from('attachments')
            .createSignedUrl(tour.welcome_message_image_path, 60 * 60 * 24 * 7, {
              transform: { width: 1200, quality: 78, resize: 'contain' },
            });
          imageUrl = signed?.signedUrl ?? null;
        } catch (_e) {
          imageUrl = null;
        }
      }
      welcomeMessage = {
        heading: tour.welcome_message_heading || 'Welcome',
        body: tour.welcome_message_body || '',
        signoff: tour.welcome_message_signoff || '',
        imageUrl,
      };
    }

    // Resolve filler/document images used to fill blank space in the document
    let documentImages: any[] = [];
    if (options.includeFillerImages ?? true) {
      const { data: imgRows } = await supabase
        .from('tour_document_images')
        .select('id, file_path, caption, width, height, sort_order')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true });
      for (const row of (imgRows || [])) {
        if (!row.file_path) continue;
        let imageUrl: string | null = null;
        try {
          const { data: signed } = await supabase.storage
            .from('attachments')
            .createSignedUrl(row.file_path, 60 * 60 * 24 * 7, {
              transform: { width: 1200, quality: 72, resize: 'contain' },
            });
          imageUrl = signed?.signedUrl ?? null;
        } catch (_e) {
          imageUrl = null;
        }
        if (!imageUrl) continue;
        const w = row.width || 0;
        const h = row.height || 0;
        const ratio = w && h ? w / h : 1.5;
        documentImages.push({
          imageUrl,
          caption: row.caption || '',
          width: w,
          height: h,
          orientation: ratio > 1.25 ? 'landscape' : ratio < 0.8 ? 'portrait' : 'square',
        });
      }
    }

    // Process data
    const daysWithEntries = days.map(day => ({
      ...day,
      entries: entries.filter(entry => entry.day_id === day.id)
    }));

    // Generate HTML
    const html = generateHTML(tour, itinerary, daysWithEntries, hotels, additionalInfoSections, options, brandNavy, cancellationPolicy, welcomeMessage, documentImages, brandAccent, brandName, brand.logoUrl || brand.headerImageUrl, brand.colorBorder);

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

function generateHTML(tour: any, itinerary: any, days: any[], hotels: any[], additionalInfoSections: any[], options: any, brandNavy?: string, cancellationPolicy?: any, welcomeMessage?: any, documentImages: any[] = [], brandAccent?: string, brandName?: string, brandLogoUrl?: string | null, brandBorder?: string): string {
  // Pool of filler images, consumed as blank spaces are filled
  const fillerPool: any[] = [...(documentImages || [])];
  const GOLD_FILLER = '#c79a2e';
  const takeFiller = (prefer?: 'landscape' | 'portrait' | 'square') => {
    if (fillerPool.length === 0) return null;
    let idx = prefer ? fillerPool.findIndex((i) => i.orientation === prefer) : 0;
    if (idx < 0) idx = 0;
    return fillerPool.splice(idx, 1)[0];
  };
  const renderFiller = (img: any, variant: 'block' | 'full' = 'block') => {
    if (!img) return '';
    const cls = variant === 'full' ? 'filler-img filler-full' : 'filler-img';
    return `
      <figure class="${cls}">
        <img src="${img.imageUrl}" alt="${(img.caption || 'Tour image').replace(/"/g, '&quot;')}" />
        ${img.caption ? `<figcaption>${img.caption}</figcaption>` : ''}
      </figure>`;
  };
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

  // Brand palette — matches the system colour scheme (navy primary + gold accent)
  const darken = (hex: string, amount = 0.25) => {
    const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
    const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
    const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };
  const NAVY = brandNavy && /^#?[0-9a-fA-F]{6}$/.test(brandNavy.trim()) ? (brandNavy.trim().startsWith('#') ? brandNavy.trim() : `#${brandNavy.trim()}`) : '#0a1929'; // system primary / email header
  const NAVY_DARK = darken(NAVY, 0.3); // deeper navy for gradient/banner
  const GOLD = brandAccent && /^#?[0-9a-fA-F]{6}$/.test(brandAccent.trim()) ? (brandAccent.trim().startsWith('#') ? brandAccent.trim() : `#${brandAccent.trim()}`) : '#c79a2e'; // brand accent
  // Brand border colour (used as the second stop of the header gradient so the
  // document header background matches the tour's email/theme header).
  const BORDER = brandBorder && /^#?[0-9a-fA-F]{6}$/.test(brandBorder.trim())
    ? (brandBorder.trim().startsWith('#') ? brandBorder.trim() : `#${brandBorder.trim()}`)
    : NAVY;
  const HEADER_BG = `linear-gradient(135deg, ${NAVY} 0%, ${darken(BORDER, 0.25)} 100%)`;
  const INK = '#2b2b2b';
  const MUTED = '#6b6b6b';

  const subtitle = tour.location ? tour.location : '';
  const runningTitle = `${(tour.name || '').toUpperCase()}${subtitle ? `&nbsp;&nbsp;|&nbsp;&nbsp;${subtitle}` : ''}`;

  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tour.name} - Itinerary</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap');
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
          background-color: ${NAVY};
          background-image: ${HEADER_BG};
          color: #fff;
          text-align: center;
          padding: 24px 40px 22px;
        }
        .cover-logo {
          display: block;
          max-width: 180px;
          max-height: 70px;
          object-fit: contain;
          margin: 0 auto 16px;
        }
        .cover-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 27pt;
          font-weight: 700;
          letter-spacing: 1px;
          margin: 0;
          line-height: 1.1;
          text-transform: uppercase;
        }
        .cover-dates {
          color: ${GOLD};
          font-size: 15pt;
          margin-top: 14px;
        }
        .cover-meta {
          color: rgba(255,255,255,0.78);
          font-size: 12pt;
          margin-top: 8px;
          letter-spacing: 0.5px;
        }
        .cover-rule {
          height: 10px;
          background: ${GOLD};
        }
        /* ---------- Welcome message ---------- */
        .welcome {
          text-align: center;
          padding: 24px 48px 12px;
        }
        .welcome-photo-full {
          display: block;
          width: auto;
          max-width: calc(100% - 96px);
          max-height: 250px;
          object-fit: contain;
          margin: 8px auto 0;
        }
        .welcome-heading {
          color: ${NAVY};
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 19pt;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 10px;
        }
        .welcome-rule {
          width: 70px;
          height: 2px;
          background: ${GOLD};
          border: none;
          margin: 0 auto 20px;
        }
        .welcome-body { color: ${INK}; font-size: 10.5pt; line-height: 1.5; }
        .welcome-body p { margin: 0 0 12px; }
        .welcome-signoff {
          font-family: 'Dancing Script', 'Snell Roundhand', 'Apple Chancery', 'Segoe Script', cursive;
          font-size: 30pt;
          font-weight: 600;
          color: ${NAVY};
          margin-top: 18px;
          line-height: 1.2;
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
        /* ---------- Filler images ---------- */
        .filler-img {
          margin: 22px 0 4px;
          padding: 0;
          page-break-inside: avoid;
          break-inside: avoid;
          text-align: center;
        }
        .filler-img img {
          width: 100%;
          max-height: 180px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid ${GOLD};
        }
        .filler-img figcaption {
          margin-top: 6px;
          color: ${MUTED};
          font-size: 9.5pt;
          font-style: italic;
        }
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
          ${brandLogoUrl ? `<img class="cover-logo" src="${brandLogoUrl}" alt="${brandName || 'Australian Racing Tours'} logo" />` : ''}
          <h1 class="cover-title">${tour.name}</h1>
          <div class="cover-dates">${formatDate(tour.start_date)} &ndash; ${formatDate(tour.end_date)}</div>
          <div class="cover-meta">${tour.days} Days &nbsp;&middot;&nbsp; ${tour.nights} Nights${subtitle ? ` &nbsp;&middot;&nbsp; ${subtitle}` : ''}</div>
        </div>
  `;

  html += `<div class="cover-rule"></div>`;

  if (welcomeMessage) {
    const rawBody = welcomeMessage.body || '';
    // New content is rich-text HTML; legacy content is plain text with newlines.
    const isHtmlBody = /<[a-z][\s\S]*>/i.test(rawBody);
    const bodyHtml = isHtmlBody
      ? rawBody
      : rawBody
          .split(/\n\s*\n/)
          .map((p: string) => p.trim())
          .filter(Boolean)
          .map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
    html += `<div class="welcome">`;
    html += `<h2 class="welcome-heading">${welcomeMessage.heading || 'Welcome'}</h2>`;
    html += `<hr class="welcome-rule">`;
    html += `<div class="welcome-body">${bodyHtml}</div>`;
    if (welcomeMessage.signoff) {
      html += `<div class="welcome-signoff">${welcomeMessage.signoff}</div>`;
    }
    html += `</div>`;
    if (welcomeMessage.imageUrl) {
      html += `<img class="welcome-photo-full" src="${welcomeMessage.imageUrl}" alt="Tour Host" />`;
    }
  }

  html += `</div>`; // end cover

  // ===== Accommodation + Itinerary (same page, no break between them) =====
  const hasHotels = options.includeHotels && hotels.length > 0;
  html += `
    <div class="page section">
      <div class="run-head"><strong>${runningTitle}</strong></div>
  `;
  if (hasHotels) {
    html += `
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
    html += `</tbody></table>`;
  }

  // Day-by-day itinerary flows directly under the accommodation table (no page break)
  html += `<h2 class="section-title"${hasHotels ? ' style="margin-top:26px;"' : ''}>Day-by-Day Itinerary</h2>`;

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
  if (options.includeAdditionalInfo && (cancellationPolicy || additionalInfoSections.length > 0)) {
    html += `
      <div class="page section">
        <div class="run-head"><strong>${runningTitle}</strong></div>
        <h2 class="section-title">Additional Information</h2>
    `;
    if (cancellationPolicy) {
      // Use the tour's brand primary colour so the table matches the rest of the branding
      html += `<div class="info-block">${buildCancellationPolicyTableHtml(cancellationPolicy, NAVY, GOLD)}</div>`;
    }
    additionalInfoSections.forEach((section: any) => {
      html += `
        <div class="info-block">
          <div class="info-name">${section.name}</div>
          ${section.content ? `<div class="info-content">${section.content}</div>` : `<p style="color:${MUTED};font-style:italic;">No content.</p>`}
        </div>
      `;
    });
    // Use at most one landscape image at the end of Additional Information.
    // Never append every uploaded image: that creates image-only pages and huge PDFs.
    html += renderFiller(takeFiller('landscape'));
    html += `</div>`;
  }

  html += `</body></html>`;

  return html;
}