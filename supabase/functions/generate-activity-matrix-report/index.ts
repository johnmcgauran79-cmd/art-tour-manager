import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateActivityMatrixData(supabase: any, tourId?: string) {
  // Fetch all discrepancies, optionally filtered by tour
  let discQuery = supabase.rpc('get_activity_allocation_discrepancies');
  if (tourId) {
    discQuery = discQuery.eq('tour_id', tourId);
  }

  let ackQuery = supabase.from('activity_discrepancy_acknowledgments')
    .select('booking_id, activity_id, tour_id, snapshot_passenger_count, snapshot_allocated_count, discrepancy_type');
  if (tourId) {
    ackQuery = ackQuery.eq('tour_id', tourId);
  }

  const [discResult, ackResult] = await Promise.all([discQuery, ackQuery]);

  const allDiscrepancies = discResult.data || [];
  const acknowledgments = ackResult.data || [];

  // Filter out acknowledged items where snapshot still matches current state
  const unacknowledged = allDiscrepancies.filter((disc: any) => {
    const ack = acknowledgments.find(
      (a: any) => a.booking_id === disc.booking_id && a.activity_id === disc.activity_id
    );
    if (!ack) return true;
    return ack.snapshot_passenger_count !== disc.passenger_count ||
           ack.snapshot_allocated_count !== disc.allocated_count;
  });

  return { 
    discrepancies: unacknowledged, 
    count: unacknowledged.length,
    totalDiscrepancies: allDiscrepancies.length,
    acknowledgedCount: allDiscrepancies.length - unacknowledged.length,
  };
}

function generateActivityMatrixHTML(data: { discrepancies: any[]; count: number; totalDiscrepancies: number; acknowledgedCount: number }, label: string): string {
  if (data.totalDiscrepancies === 0) {
    return `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 24px; margin-bottom: 8px;">✅</div>
        <p style="font-weight: 600; color: #166534; margin: 0 0 4px 0;">All Activity Allocations Correct</p>
        <p style="color: #15803d; font-size: 13px; margin: 0;">No discrepancies found for ${label}</p>
      </div>
    `;
  }

  if (data.count === 0 && data.acknowledgedCount > 0) {
    return `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 24px; margin-bottom: 8px;">✅</div>
        <p style="font-weight: 600; color: #166534; margin: 0 0 4px 0;">All Discrepancies Reviewed</p>
        <p style="color: #15803d; font-size: 13px; margin: 0;">${data.acknowledgedCount} discrepanc${data.acknowledgedCount === 1 ? 'y has' : 'ies have'} been acknowledged for ${label}. No action required.</p>
      </div>
    `;
  }

  // Group discrepancies by tour for multi-tour view
  const tourGroups: Record<string, { tourName: string; tourStartDate: string; items: any[] }> = {};
  for (const item of data.discrepancies) {
    const key = item.tour_id;
    if (!tourGroups[key]) {
      tourGroups[key] = { tourName: item.tour_name, tourStartDate: item.tour_start_date, items: [] };
    }
    tourGroups[key].items.push(item);
  }

  let html = `<p style="color: #991b1b; font-weight: 600; margin-bottom: 12px;">⚠️ ${data.count} unacknowledged discrepanc${data.count === 1 ? 'y' : 'ies'} found`;
  if (data.acknowledgedCount > 0) {
    html += ` <span style="color: #666; font-weight: normal;">(${data.acknowledgedCount} acknowledged)</span>`;
  }
  html += '</p>';

  for (const [, group] of Object.entries(tourGroups)) {
    html += `<h3 style="color: #1e3a5f; margin: 16px 0 8px 0; border-bottom: 1px solid #ddd; padding-bottom: 4px;">${group.tourName}</h3>`;
    html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<thead><tr style="background-color: #f3f4f6;"><th style="text-align: left;">Guest Name</th><th style="text-align: left;">Activity</th><th style="text-align: center;">Passenger Count</th><th style="text-align: center;">Allocated</th><th style="text-align: center;">Issue Type</th></tr></thead>';
    html += '<tbody>';

    for (const item of group.items) {
      const guestName = `${item.lead_passenger_first_name || ''} ${item.lead_passenger_last_name || ''}`.trim();
      const bgColor = item.discrepancy_type === 'missing' ? '#fef2f2' : '#fffbeb';
      const textColor = item.discrepancy_type === 'missing' ? '#d32f2f' : '#f57c00';
      
      html += `<tr style="background-color: ${bgColor};">`;
      html += `<td>${guestName}</td>`;
      html += `<td>${item.activity_name}</td>`;
      html += `<td style="text-align: center;">${item.passenger_count}</td>`;
      html += `<td style="text-align: center;">${item.allocated_count}</td>`;
      html += `<td style="text-align: center; color: ${textColor}; font-weight: 600;">${item.discrepancy_type}</td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
  }

  return html;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tour_id, format = 'json' } = await req.json();

    console.log('Generating Activity Matrix Report:', { tour_id: tour_id || 'ALL TOURS', format });

    let label = 'all tours';
    if (tour_id) {
      const { data: tour } = await supabase
        .from('tours')
        .select('name')
        .eq('id', tour_id)
        .single();
      if (tour) label = tour.name;
    }

    // Generate the report data (respects acknowledgments, supports all-tours)
    const reportData = await generateActivityMatrixData(supabase, tour_id || undefined);

    if (format === 'html') {
      const html = generateActivityMatrixHTML(reportData, label);
      return new Response(
        JSON.stringify({ html, count: reportData.count }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify(reportData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error: any) {
    console.error('Error generating activity matrix report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
