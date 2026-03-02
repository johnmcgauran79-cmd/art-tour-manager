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

async function findOrCreateContact(email: string, firstName?: string, lastName?: string): Promise<number> {
  // Search for existing contact by email
  const searchResult = await keapRequest(`/contacts?email=${encodeURIComponent(email)}`);

  if (searchResult.contacts && searchResult.contacts.length > 0) {
    console.log(`Found existing Keap contact: ${searchResult.contacts[0].id}`);
    return searchResult.contacts[0].id;
  }

  // Create new contact
  const newContact = await keapRequest('/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email_addresses: [{ email, field: 'EMAIL1' }],
      given_name: firstName || '',
      family_name: lastName || '',
    }),
  });

  console.log(`Created new Keap contact: ${newContact.id}`);
  return newContact.id;
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
        customers:lead_passenger_id (first_name, last_name)
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
    const customer = bookingResult.data?.customers as any;
    const tagName = `Booked: ${tourName}`;

    // Find or create contact in Keap
    const contactId = await findOrCreateContact(
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

    // Apply tag to contact
    await applyTagToContact(contactId, tagId);

    // Log to audit_log
    await supabase.from('audit_log').insert({
      user_id: customer?.id || bookingId,
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

    return new Response(JSON.stringify({
      success: true,
      contactId,
      tagId,
      tagName,
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
