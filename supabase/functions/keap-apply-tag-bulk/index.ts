import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json();
    const tagId = Number(body?.tagId);
    const customerIds: string[] = Array.isArray(body?.customerIds) ? body.customerIds : [];
    const reason: string = typeof body?.reason === 'string' ? body.reason : 'audience_tagging';

    if (!tagId || Number.isNaN(tagId)) {
      return new Response(JSON.stringify({ error: 'tagId is required (numeric Keap tag ID)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (customerIds.length === 0) {
      return new Response(JSON.stringify({ error: 'customerIds array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, keap_contact_id')
      .in('id', customerIds);
    if (error) throw error;

    let applied = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ customerId: string; error: string }> = [];

    for (const c of customers || []) {
      if (!c.keap_contact_id) {
        skipped++;
        continue;
      }
      try {
        await keapRequest(`/contacts/${c.keap_contact_id}/tags`, {
          method: 'POST',
          body: JSON.stringify({ tagIds: [tagId] }),
        });
        applied++;
        await supabase.from('audit_log').insert({
          user_id: c.id,
          operation_type: 'KEAP_APPLY_AUDIENCE_TAG',
          table_name: 'customers',
          record_id: c.id,
          details: {
            keap_contact_id: c.keap_contact_id,
            keap_tag_id: tagId,
            reason,
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email,
          },
        });
        // Keap allows ~25 req/sec; be conservative with 120ms delay.
        await sleep(120);
      } catch (err: any) {
        failed++;
        errors.push({ customerId: c.id, error: err?.message || String(err) });
        console.error(`Failed to tag customer ${c.id}:`, err?.message || err);
        // If rate-limited, back off harder.
        if (typeof err?.message === 'string' && err.message.includes('429')) {
          await sleep(2000);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, applied, skipped, failed, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('keap-apply-tag-bulk error:', err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});