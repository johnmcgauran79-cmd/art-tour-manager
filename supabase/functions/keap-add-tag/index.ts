import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KEAP_API_BASE = 'https://api.infusionsoft.com/crm/rest/v1';

async function keapRequest(path: string, options: RequestInit = {}) {
  const KEAP_API_KEY = Deno.env.get('KEAP_API_KEY');
  if (!KEAP_API_KEY) {
    throw new Error('KEAP_API_KEY is not configured');
  }

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
  if (!response.ok) {
    throw new Error(`Keap API error [${response.status}]: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function findOrCreateContact(
  supabase: any,
  customerId: string,
  email: string,
  firstName?: string,
  lastName?: string
): Promise<number> {
  // 1. Check if we already have a stored keap_contact_id for this customer
  const { data: customer } = await supabase
    .from('customers')
    .select('keap_contact_id')
    .eq('id', customerId)
    .maybeSingle();

  if (customer?.keap_contact_id) {
    console.log(`Using stored Keap contact ID: ${customer.keap_contact_id} for customer ${customerId}`);
    return parseInt(customer.keap_contact_id, 10);
  }

  // 2. Search Keap by email
  const searchResult = await keapRequest(`/contacts?email=${encodeURIComponent(email)}`);

  let contactId: number;

  if (searchResult.contacts && searchResult.contacts.length > 0) {
    contactId = searchResult.contacts[0].id;
    console.log(`Found existing Keap contact by email: ${contactId}`);
  } else {
    // 3. Create new contact in Keap
    const newContact = await keapRequest('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        email_addresses: [{ email, field: 'EMAIL1' }],
        given_name: firstName || '',
        family_name: lastName || '',
      }),
    });
    contactId = newContact.id;
    console.log(`Created new Keap contact: ${contactId}`);
  }

  // 4. Store the keap_contact_id back to the customer record for future lookups
  await supabase
    .from('customers')
    .update({ keap_contact_id: String(contactId) })
    .eq('id', customerId);
  console.log(`Saved keap_contact_id ${contactId} to customer ${customerId}`);

  return contactId;
}

async function findOrCreateTag(tagName: string): Promise<number> {
  // Search for existing tag
  const searchResult = await keapRequest(`/tags?name=${encodeURIComponent(tagName)}`);

  if (searchResult.tags && searchResult.tags.length > 0) {
    const exactMatch = searchResult.tags.find((t: any) => t.name === tagName);
    if (exactMatch) {
      console.log(`Found existing Keap tag: ${exactMatch.id} (${tagName})`);
      return exactMatch.id;
    }
  }

  // Create new tag
  const newTag = await keapRequest('/tags', {
    method: 'POST',
    body: JSON.stringify({
      name: tagName,
      description: `Auto-created tag for tour bookings`,
      category: { id: 0 },
    }),
  });

  console.log(`Created new Keap tag: ${newTag.id} (${tagName})`);
  return newTag.id;
}

async function applyTagToContact(contactId: number, tagId: number): Promise<void> {
  await keapRequest(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagIds: [tagId] }),
  });

  console.log(`Applied tag ${tagId} to contact ${contactId}`);
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
    const { contactEmail, bookingId, tourId } = await req.json();

    if (!contactEmail || !bookingId || !tourId) {
      return new Response(JSON.stringify({ error: 'contactEmail, bookingId, and tourId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Keap add-tag: contact=${contactEmail}, booking=${bookingId}, tour=${tourId}`);

    // Fetch tour name and customer details from Supabase
    const [tourResult, bookingResult] = await Promise.all([
      supabase.from('tours').select('name, keap_tag_id').eq('id', tourId).single(),
      supabase.from('bookings').select(`
        id,
        lead_passenger_id,
        passenger_2_id,
        passenger_3_id,
        status,
        whatsapp_group_comms,
        accommodation_required,
        customers:lead_passenger_id (id, first_name, last_name, email),
        passenger_2:customers!passenger_2_id (id, first_name, last_name, email),
        passenger_3:customers!passenger_3_id (id, first_name, last_name, email)
      `).eq('id', bookingId).single(),
    ]);

    if (tourResult.error || !tourResult.data) {
      return new Response(JSON.stringify({ error: 'Tour not found', details: tourResult.error?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tourName = tourResult.data.name;
    const existingKeapTagId = tourResult.data.keap_tag_id;

    // Server-side guard:
    // - Host: always allow Keap tag (they need tour updates)
    // - Non-full-tour (no whatsapp or no accommodation): skip
    const bookingStatus = bookingResult.data?.status;
    const isHost = bookingStatus === 'host';
    const isFullTourBooking = bookingResult.data?.whatsapp_group_comms !== false && bookingResult.data?.accommodation_required !== false;

    if (!isHost && !isFullTourBooking) {
      console.log(`Skipping Keap tag — booking ${bookingId} status: ${bookingStatus}, whatsapp_group_comms: ${bookingResult.data?.whatsapp_group_comms}, accommodation_required: ${bookingResult.data?.accommodation_required}`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Non-full-tour booking' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customer = bookingResult.data?.customers as any;
    const customerId = bookingResult.data?.lead_passenger_id;
    const tagName = `Booked: ${tourName}`;

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Booking has no lead passenger' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find or create contact in Keap (with stored ID check)
    const contactId = await findOrCreateContact(
      supabase,
      customerId,
      contactEmail,
      customer?.first_name,
      customer?.last_name
    );

    // Use existing tag ID from tour if available, otherwise find/create in Keap
    let tagId: number;
    if (existingKeapTagId) {
      tagId = parseInt(existingKeapTagId, 10);
      console.log(`Using existing Keap tag from tour: ${tagId}`);
    } else {
      tagId = await findOrCreateTag(tagName);
      // Save the tag ID back to the tour for future use
      await supabase.from('tours').update({ keap_tag_id: String(tagId) }).eq('id', tourId);
      console.log(`Saved auto-created Keap tag ${tagId} to tour ${tourId}`);
    }

    // Apply tag to lead passenger
    await applyTagToContact(contactId, tagId);

    // Log lead passenger tagging
    await supabase.from('audit_log').insert({
      user_id: customerId,
      operation_type: 'KEAP_ADD_TAG',
      table_name: 'bookings',
      record_id: bookingId,
      details: {
        keap_contact_id: contactId,
        keap_tag_id: tagId,
        tag_name: tagName,
        contact_email: contactEmail,
      },
    });

    // Tag additional passengers (pax 2 and pax 3) if they have linked profiles with emails
    const additionalPassengers = [
      { data: bookingResult.data?.passenger_2 as any, id: bookingResult.data?.passenger_2_id, label: 'passenger_2' },
      { data: bookingResult.data?.passenger_3 as any, id: bookingResult.data?.passenger_3_id, label: 'passenger_3' },
    ];

    const taggedPassengers: Array<{ label: string; contactId: number; email: string }> = [];

    for (const pax of additionalPassengers) {
      if (!pax.id || !pax.data?.email) {
        if (pax.id) console.log(`Skipping ${pax.label}: no email on linked contact`);
        continue;
      }

      try {
        const paxContactId = await findOrCreateContact(
          supabase,
          pax.id,
          pax.data.email,
          pax.data.first_name,
          pax.data.last_name
        );

        await applyTagToContact(paxContactId, tagId);
        taggedPassengers.push({ label: pax.label, contactId: paxContactId, email: pax.data.email });

        await supabase.from('audit_log').insert({
          user_id: pax.id,
          operation_type: 'KEAP_ADD_TAG',
          table_name: 'bookings',
          record_id: bookingId,
          details: {
            keap_contact_id: paxContactId,
            keap_tag_id: tagId,
            tag_name: tagName,
            contact_email: pax.data.email,
            passenger_role: pax.label,
          },
        });

        console.log(`Tagged ${pax.label} (${pax.data.email}) with tag ${tagId}`);
      } catch (paxError) {
        console.error(`Error tagging ${pax.label}:`, paxError);
        // Continue with other passengers even if one fails
      }
    }

    return new Response(JSON.stringify({
      success: true,
      contactId,
      tagId,
      tagName,
      additionalPassengersTagged: taggedPassengers,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in keap-add-tag:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
