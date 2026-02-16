import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function getValidAccessToken(supabase: any): Promise<{ token: string; tenantId: string; settingsId: string } | null> {
  const { data: settings } = await supabase
    .from('xero_integration_settings')
    .select('*')
    .eq('is_connected', true)
    .maybeSingle();

  if (!settings) return null;

  const expiresAt = new Date(settings.token_expires_at).getTime();
  const now = Date.now();
  
  if (now >= expiresAt - 300000) {
    const XERO_CLIENT_ID = Deno.env.get('XERO_CLIENT_ID');
    const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET');
    
    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: settings.refresh_token,
      }),
    });

    if (!tokenResponse.ok) return null;

    const tokens = await tokenResponse.json();
    
    await supabase
      .from('xero_integration_settings')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);

    return { token: tokens.access_token, tenantId: settings.tenant_id, settingsId: settings.id };
  }

  return { token: settings.access_token, tenantId: settings.tenant_id, settingsId: settings.id };
}

function extractPhone(xeroContact: any): string | null {
  if (!xeroContact.Phones?.length) return null;
  const mobilePhone = xeroContact.Phones.find((p: any) => p.PhoneType === 'MOBILE');
  const defaultPhone = xeroContact.Phones.find((p: any) => p.PhoneType === 'DEFAULT');
  const ddiPhone = xeroContact.Phones.find((p: any) => p.PhoneType === 'DDI');
  const phoneObj = mobilePhone || defaultPhone || ddiPhone;
  if (!phoneObj || (!phoneObj.PhoneNumber && !phoneObj.PhoneAreaCode)) return null;
  const parts = [
    phoneObj.PhoneCountryCode ? `+${phoneObj.PhoneCountryCode}` : '',
    phoneObj.PhoneAreaCode || '',
    phoneObj.PhoneNumber || '',
  ].filter(Boolean).join('');
  return parts || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { action, updates } = await req.json();

    const auth = await getValidAccessToken(supabase);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Xero not connected or token expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // APPLY action: bulk update phone numbers
    if (action === 'apply') {
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No updates provided' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let updated = 0;
      let errors = 0;
      for (const u of updates) {
        const { error } = await supabase
          .from('customers')
          .update({ phone: u.xero_phone })
          .eq('id', u.customer_id);
        if (error) {
          console.error('Update error:', u.customer_id, error);
          errors++;
        } else {
          updated++;
        }
      }

      return new Response(JSON.stringify({ success: true, updated, errors }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PREVIEW action: fetch all Xero contacts and compare phones
    // Load all customers
    const allCustomers: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, phone')
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allCustomers.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    // Build lookup maps
    const emailMap = new Map<string, any>();
    const nameMap = new Map<string, any>();
    for (const c of allCustomers) {
      if (c.email) emailMap.set(c.email.toLowerCase(), c);
      if (c.first_name && c.last_name) {
        nameMap.set(`${c.first_name.toLowerCase()}|${c.last_name.toLowerCase()}`, c);
      }
    }

    const proposals: any[] = [];
    let page = 1;
    let hasMore = true;
    let totalXeroContacts = 0;

    while (hasMore) {
      const contactsResponse = await fetch(
        `https://api.xero.com/api.xro/2.0/Contacts?page=${page}&where=ContactStatus=="ACTIVE"`,
        {
          headers: {
            'Authorization': `Bearer ${auth.token}`,
            'Xero-Tenant-Id': auth.tenantId,
            'Accept': 'application/json',
          },
        }
      );

      if (!contactsResponse.ok) {
        const errorText = await contactsResponse.text();
        throw new Error(`Failed to fetch Xero contacts: ${contactsResponse.status} - ${errorText}`);
      }

      const contactsData = await contactsResponse.json();
      const xeroContacts = contactsData.Contacts || [];

      if (xeroContacts.length === 0) { hasMore = false; break; }
      totalXeroContacts += xeroContacts.length;

      for (const xc of xeroContacts) {
        const email = xc.EmailAddress?.trim() || null;
        const firstName = xc.FirstName || xc.Name?.split(' ')[0] || '';
        const lastName = xc.LastName || xc.Name?.split(' ').slice(1).join(' ') || '';

        // Match to existing customer
        let customer = null;
        if (email) customer = emailMap.get(email.toLowerCase());
        if (!customer && firstName && lastName) {
          customer = nameMap.get(`${firstName.toLowerCase()}|${lastName.toLowerCase()}`);
        }
        if (!customer) continue;

        const xeroPhone = extractPhone(xc);
        if (!xeroPhone) continue;

        const currentPhone = customer.phone?.trim() || null;
        // Only propose if Xero has a phone and it differs from current
        if (currentPhone === xeroPhone) continue;

        proposals.push({
          customer_id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          current_phone: currentPhone,
          xero_phone: xeroPhone,
          xero_name: xc.Name,
        });
      }

      if (xeroContacts.length < 100) { hasMore = false; } else { page++; }
    }

    console.log(`Phone sync preview: ${totalXeroContacts} Xero contacts checked, ${proposals.length} phone updates proposed`);

    return new Response(JSON.stringify({
      success: true,
      total_checked: totalXeroContacts,
      proposals,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Phone sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
