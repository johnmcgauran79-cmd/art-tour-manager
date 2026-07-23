import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KEAP_API_BASE = 'https://api.infusionsoft.com/crm/rest/v1';

async function keapRequest(path: string) {
  const KEAP_API_KEY = Deno.env.get('KEAP_API_KEY');
  if (!KEAP_API_KEY) throw new Error('KEAP_API_KEY is not configured');
  const response = await fetch(`${KEAP_API_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${KEAP_API_KEY}`,
      'Accept': 'application/json',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Keap API error [${response.status}]: ${text}`);
  return text ? JSON.parse(text) : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Lookup unlinked customers in Keap by email and store keap_contact_id when found.
// Never creates new Keap contacts.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json().catch(() => ({}));
    const customerIds: string[] | undefined = Array.isArray(body?.customerIds) ? body.customerIds : undefined;
    const limit = Math.min(Math.max(Number(body?.limit) || 500, 1), 1000);

    let query = supabase
      .from('customers')
      .select('id, email')
      .is('keap_contact_id', null)
      .not('email', 'is', null)
      .neq('email', '')
      .limit(limit);
    if (customerIds && customerIds.length > 0) query = query.in('id', customerIds);

    const { data: customers, error } = await query;
    if (error) throw error;

    let matched = 0;
    let notFound = 0;
    let failed = 0;
    const errors: Array<{ customerId: string; error: string }> = [];

    for (const c of customers || []) {
      const email = (c.email || '').trim();
      if (!email) { notFound++; continue; }
      try {
        const result = await keapRequest(`/contacts?email=${encodeURIComponent(email)}`);
        const contact = result?.contacts?.[0];
        if (contact?.id) {
          await supabase.from('customers').update({ keap_contact_id: String(contact.id) }).eq('id', c.id);
          await supabase.from('audit_log').insert({
            user_id: c.id,
            operation_type: 'KEAP_MATCH_BY_EMAIL',
            table_name: 'customers',
            record_id: c.id,
            details: { email, keap_contact_id: contact.id },
          });
          matched++;
        } else {
          notFound++;
        }
        await sleep(120);
      } catch (err: any) {
        failed++;
        errors.push({ customerId: c.id, error: err?.message || String(err) });
        if (typeof err?.message === 'string' && err.message.includes('429')) {
          await sleep(2000);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: customers?.length || 0,
      matched,
      notFound,
      failed,
      errors,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('keap-match-contacts-by-email error:', err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});