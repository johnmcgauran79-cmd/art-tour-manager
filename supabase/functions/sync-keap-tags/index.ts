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

async function findOrCreateContact(
  supabase: any, customerId: string, email: string, firstName?: string, lastName?: string
): Promise<number> {
  const { data: customer } = await supabase
    .from('customers').select('keap_contact_id').eq('id', customerId).maybeSingle();

  if (customer?.keap_contact_id) return parseInt(customer.keap_contact_id, 10);

  const searchResult = await keapRequest(`/contacts?email=${encodeURIComponent(email)}`);
  let contactId: number;

  if (searchResult.contacts && searchResult.contacts.length > 0) {
    contactId = searchResult.contacts[0].id;
  } else {
    const newContact = await keapRequest('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        email_addresses: [{ email, field: 'EMAIL1' }],
        given_name: firstName || '',
        family_name: lastName || '',
      }),
    });
    contactId = newContact.id;
  }

  await supabase.from('customers').update({ keap_contact_id: String(contactId) }).eq('id', customerId);
  return contactId;
}

async function findOrCreateTag(tagName: string): Promise<number> {
  const searchResult = await keapRequest(`/tags?name=${encodeURIComponent(tagName)}`);
  if (searchResult.tags?.length > 0) {
    const exactMatch = searchResult.tags.find((t: any) => t.name === tagName);
    if (exactMatch) return exactMatch.id;
  }
  const newTag = await keapRequest('/tags', {
    method: 'POST',
    body: JSON.stringify({ name: tagName, description: 'Auto-created tag for tour bookings', category: { id: 0 } }),
  });
  return newTag.id;
}

async function applyTagToContact(contactId: number, tagId: number): Promise<void> {
  await keapRequest(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagIds: [tagId] }),
  });
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
    console.log('Starting nightly Keap tag sync...');

    // Get all non-archived tours
    const { data: tours, error: toursError } = await supabase
      .from('tours')
      .select('id, name, keap_tag_id, status')
      .neq('status', 'archived');

    if (toursError) throw new Error(`Failed to fetch tours: ${toursError.message}`);
    if (!tours || tours.length === 0) {
      console.log('No non-archived tours found');
      return new Response(JSON.stringify({ success: true, message: 'No tours to process', tagged: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${tours.length} non-archived tours`);

    let totalTagged = 0;
    const results: Array<{ tour: string; passenger: string; email: string }> = [];

    for (const tour of tours) {
      // Skip tours without an existing Keap tag — tags are only created via keap-add-tag on first booking
      if (!tour.keap_tag_id) {
        console.log(`Skipping tour "${tour.name}" — no keap_tag_id set`);
        continue;
      }

      // Get all bookings for this tour with passenger details
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          lead_passenger_id,
          passenger_2_id,
          passenger_3_id,
          whatsapp_group_comms,
          accommodation_required,
          customers:lead_passenger_id (id, first_name, last_name, email, keap_contact_id),
          passenger_2:customers!passenger_2_id (id, first_name, last_name, email, keap_contact_id),
          passenger_3:customers!passenger_3_id (id, first_name, last_name, email, keap_contact_id)
        `)
        .eq('tour_id', tour.id)
        .not('status', 'eq', 'cancelled');

      if (bookingsError || !bookings) {
        console.error(`Error fetching bookings for tour ${tour.name}: ${bookingsError?.message}`);
        continue;
      }

      const tagId = parseInt(tour.keap_tag_id, 10);

    for (const booking of bookings) {
        // Skip non-full-tour bookings (hosts, partial attendees, etc.)
        if (booking.whatsapp_group_comms === false || booking.accommodation_required === false) {
          console.log(`Skipping booking ${booking.id} — whatsapp_group_comms: ${booking.whatsapp_group_comms}, accommodation_required: ${booking.accommodation_required}`);
          continue;
        }

        const passengers = [
          { data: booking.customers as any, id: booking.lead_passenger_id, role: 'lead' },
          { data: booking.passenger_2 as any, id: booking.passenger_2_id, role: 'passenger_2' },
          { data: booking.passenger_3 as any, id: booking.passenger_3_id, role: 'passenger_3' },
        ];

        for (const pax of passengers) {
          if (!pax.id || !pax.data?.email || pax.data?.keap_contact_id) continue;

          try {
            const contactId = await findOrCreateContact(
              supabase, pax.id, pax.data.email, pax.data.first_name, pax.data.last_name
            );

            await applyTagToContact(contactId, tagId);

            await supabase.from('audit_log').insert({
              user_id: pax.id,
              operation_type: 'KEAP_SYNC_TAG',
              table_name: 'bookings',
              record_id: booking.id,
              details: {
                keap_contact_id: contactId,
                keap_tag_id: tagId,
                tag_name: `Booked: ${tour.name}`,
                contact_email: pax.data.email,
                passenger_role: pax.role,
                sync_type: 'nightly',
              },
            });

            totalTagged++;
            results.push({ tour: tour.name, passenger: `${pax.data.first_name} ${pax.data.last_name}`, email: pax.data.email });
            console.log(`Tagged ${pax.role} ${pax.data.email} for tour ${tour.name}`);
          } catch (paxError) {
            console.error(`Error tagging ${pax.role} ${pax.data?.email} for tour ${tour.name}:`, paxError);
          }
        }
      }
    }

    console.log(`Keap tag sync complete. Tagged ${totalTagged} contacts.`);

    return new Response(JSON.stringify({ success: true, tagged: totalTagged, details: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sync-keap-tags:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
