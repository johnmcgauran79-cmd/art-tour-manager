import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateActivityMatrixData(supabase: any, tourId: string) {
  const { data: discrepancies } = await supabase
    .rpc('get_activity_allocation_discrepancies')
    .eq('tour_id', tourId);

  if (!discrepancies || discrepancies.length === 0) {
    return { discrepancies: [], count: 0 };
  }

  return { discrepancies, count: discrepancies.length };
}

function generateActivityMatrixHTML(discrepancies: any[], tourName: string): string {
  if (!discrepancies || discrepancies.length === 0) {
    return '<p>No activity allocation discrepancies found for this tour.</p>';
  }

  let html = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
  html += '<thead><tr><th>Guest Name</th><th>Activity</th><th>Passenger Count</th><th>Allocated</th><th>Issue Type</th></tr></thead>';
  html += '<tbody>';

  for (const item of discrepancies) {
    const guestName = `${item.lead_passenger_first_name || ''} ${item.lead_passenger_last_name || ''}`.trim();
    
    html += '<tr>';
    html += `<td>${guestName}</td>`;
    html += `<td>${item.activity_name}</td>`;
    html += `<td>${item.passenger_count}</td>`;
    html += `<td>${item.allocated_count}</td>`;
    html += `<td style="color: ${item.discrepancy_type === 'missing' ? '#d32f2f' : '#f57c00'};">${item.discrepancy_type}</td>`;
    html += '</tr>';
  }

  html += '</tbody></table>';
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

    if (!tour_id) {
      throw new Error('tour_id is required');
    }

    console.log('Generating Activity Matrix Report:', { tour_id, format });

    // Get tour details
    const { data: tour } = await supabase
      .from('tours')
      .select('name')
      .eq('id', tour_id)
      .single();

    if (!tour) {
      throw new Error('Tour not found');
    }

    // Generate the report data
    const reportData = await generateActivityMatrixData(supabase, tour_id);

    // Return based on requested format
    if (format === 'html') {
      const html = generateActivityMatrixHTML(reportData.discrepancies, tour.name);
      return new Response(
        JSON.stringify({ html, count: reportData.count }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Return JSON data for frontend
      return new Response(
        JSON.stringify(reportData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
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
