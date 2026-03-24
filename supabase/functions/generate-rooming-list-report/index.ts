import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateRoomingListData(supabase: any, tourId: string) {
  const { data: hotels } = await supabase
    .from('hotels')
    .select(`
      *,
      hotel_bookings!inner(
        *,
        bookings!inner(
          *,
          customers!lead_passenger_id(first_name, last_name)
        )
      )
    `)
    .eq('tour_id', tourId)
    .eq('hotel_bookings.allocated', true)
    .neq('hotel_bookings.bookings.status', 'cancelled')
    .order('default_check_in', { ascending: true, nullsFirst: false });

  if (!hotels || hotels.length === 0) {
    return { hotels: [], count: 0 };
  }

  return { hotels, count: hotels.reduce((sum, h) => sum + h.hotel_bookings.length, 0) };
}

function generateRoomingListHTML(hotels: any[], tourName: string): string {
  if (!hotels || hotels.length === 0) {
    return '<p>No hotel data available for this tour.</p>';
  }

  let html = '';
  
  for (const hotel of hotels) {
    html += `<h3>${hotel.name}</h3>`;
    html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<thead><tr><th>Guest Name</th><th>Bedding</th><th>Check In</th><th>Check Out</th><th>Nights</th><th>Room Type</th></tr></thead>';
    html += '<tbody>';

    const hotelBookings = hotel.hotel_bookings || [];
    for (const hb of hotelBookings) {
      const booking = hb.bookings;
      if (!booking || booking.status === 'cancelled') continue;
      
      const customer = booking.customers || {};
      const guestName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown';
      
      html += '<tr>';
      html += `<td>${guestName}</td>`;
      html += `<td>${hb.bedding || 'N/A'}</td>`;
      html += `<td>${hb.check_in_date || 'N/A'}</td>`;
      html += `<td>${hb.check_out_date || 'N/A'}</td>`;
      html += `<td>${hb.nights || 'N/A'}</td>`;
      html += `<td>${hb.room_type || 'Standard'}</td>`;
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

    if (!tour_id) {
      throw new Error('tour_id is required');
    }

    console.log('Generating Rooming List Report:', { tour_id, format });

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
    const reportData = await generateRoomingListData(supabase, tour_id);

    // Return based on requested format
    if (format === 'html') {
      const html = generateRoomingListHTML(reportData.hotels, tour.name);
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
    console.error('Error generating rooming list report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
