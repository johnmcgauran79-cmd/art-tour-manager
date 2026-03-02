import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KEAP_API_BASE = 'https://api.infusionsoft.com/crm/rest/v1';

async function keapRequest(path: string, options: RequestInit = {}) {
  const KEAP_API_KEY = Deno.env.get('KEAP_API_KEY');
  if (!KEAP_API_KEY) throw new Error('KEAP_API_KEY is not configured');

  const response = await fetch(`${KEAP_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${KEAP_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Keap API error [${response.status}]: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function removeTagFromContact(contactId: number, tagId: number): Promise<void> {
  await keapRequest(`/contacts/${contactId}/tags/${tagId}`, {
    method: 'DELETE',
  });
  console.log(`Removed tag ${tagId} from contact ${contactId}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'bookingId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Keap remove-tag: booking=${bookingId}`);

    // Fetch booking with passenger details and tour info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, tour_id,
        lead_passenger_id,
        passenger_2_id,
        passenger_3_id,
        customers:lead_passenger_id (id, email, first_name, last_name, keap_contact_id),
        passenger_2:customers!passenger_2_id (id, email, first_name, last_name, keap_contact_id),
        passenger_3:customers!passenger_3_id (id, email, first_name, last_name, keap_contact_id)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found', details: bookingError?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the tour's keap_tag_id
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('id, name, keap_tag_id')
      .eq('id', booking.tour_id)
      .single();

    if (tourError || !tour?.keap_tag_id) {
      console.log('Tour has no keap_tag_id, nothing to remove');
      return new Response(JSON.stringify({ success: true, message: 'No Keap tag configured for this tour', removed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tagId = parseInt(tour.keap_tag_id, 10);
    const removedContacts: Array<{ label: string; contactId: number; email: string }> = [];

    const passengers = [
      { data: booking.customers as any, id: booking.lead_passenger_id, label: 'lead' },
      { data: booking.passenger_2 as any, id: booking.passenger_2_id, label: 'passenger_2' },
      { data: booking.passenger_3 as any, id: booking.passenger_3_id, label: 'passenger_3' },
    ];

    for (const pax of passengers) {
      if (!pax.id || !pax.data?.keap_contact_id) {
        if (pax.id) console.log(`Skipping ${pax.label}: no keap_contact_id`);
        continue;
      }

      const keapContactId = parseInt(pax.data.keap_contact_id, 10);

      try {
        await removeTagFromContact(keapContactId, tagId);
        removedContacts.push({ label: pax.label, contactId: keapContactId, email: pax.data.email });

        await supabase.from('audit_log').insert({
          user_id: pax.id,
          operation_type: 'KEAP_REMOVE_TAG',
          table_name: 'bookings',
          record_id: bookingId,
          details: {
            keap_contact_id: keapContactId,
            keap_tag_id: tagId,
            tag_name: `Booked: ${tour.name}`,
            contact_email: pax.data.email,
            passenger_role: pax.label,
            reason: 'booking_cancelled',
          },
        });

        console.log(`Removed tag from ${pax.label} (${pax.data.email})`);
      } catch (paxError) {
        console.error(`Error removing tag from ${pax.label}:`, paxError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      tagId,
      removed: removedContacts.length,
      details: removedContacts,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in keap-remove-tag:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
