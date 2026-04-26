import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generatePassengerListData(supabase: any, tourId: string) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, customers!bookings_lead_passenger_id_fkey(*)')
    .eq('tour_id', tourId)
    .neq('status', 'cancelled')
    .order('created_at');

  if (!bookings || bookings.length === 0) {
    return { passengers: [], count: 0 };
  }

  const passengers = bookings.map(booking => {
    const customer = booking.customers || {};
    return {
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown',
      email: customer.email || 'N/A',
      phone: customer.phone || 'N/A',
      passengerCount: booking.passenger_count || 1,
      dietaryRequirements: customer.dietary_requirements || 'None',
      status: booking.status || 'N/A',
      bookingReference: booking.id
    };
  });

  return { passengers, count: passengers.length };
}

function generatePassengerListHTML(passengers: any[], tourName: string): string {
  if (!passengers || passengers.length === 0) {
    return '<p>No passenger data available for this tour.</p>';
  }

  let html = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
  html += '<thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Passengers</th><th>Dietary Requirements</th><th>Status</th></tr></thead>';
  html += '<tbody>';

  for (const passenger of passengers) {
    html += '<tr>';
    html += `<td>${passenger.name}</td>`;
    html += `<td>${passenger.email}</td>`;
    html += `<td>${passenger.phone}</td>`;
    html += `<td>${passenger.passengerCount}</td>`;
    html += `<td>${passenger.dietaryRequirements}</td>`;
    html += `<td>${passenger.status}</td>`;
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

    console.log('Generating Passenger List Report:', { tour_id, format });

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
    const reportData = await generatePassengerListData(supabase, tour_id);

    // Return based on requested format
    if (format === 'html') {
      const html = generatePassengerListHTML(reportData.passengers, tour.name);
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
  } catch (error: any) {
    console.error('Error generating passenger list report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
