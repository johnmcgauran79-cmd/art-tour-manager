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

/** Normalize a phone number to digits only (strip +, spaces, dashes, parens) */
function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '');
}

/** Check if two phone numbers are effectively the same */
function phonesMatch(a: string | null, b: string | null): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  // Check if one ends with the other (handles country code differences)
  // e.g. "61417866194" ends with "417866194", or "0417866194" vs "417866194"
  if (na === nb) return true;
  if (na.endsWith(nb) || nb.endsWith(na)) return true;
  // Strip leading 0 and compare
  const sa = na.replace(/^0+/, '');
  const sb = nb.replace(/^0+/, '');
  if (sa === sb) return true;
  // Strip country code 61 and compare
  const stripAu = (n: string) => n.startsWith('61') ? n.substring(2) : n;
  if (stripAu(sa) === stripAu(sb)) return true;
  return false;
}

function extractPhone(xeroContact: any): string | null {
  if (!xeroContact.Phones?.length) return null;
  
  // Filter to phones that actually have data, then prioritize
  const phonesWithData = xeroContact.Phones.filter((p: any) => 
    p.PhoneNumber?.trim() || p.PhoneAreaCode?.trim()
  );
  
  if (phonesWithData.length === 0) return null;
  
  const mobilePhone = phonesWithData.find((p: any) => p.PhoneType === 'MOBILE');
  const defaultPhone = phonesWithData.find((p: any) => p.PhoneType === 'DEFAULT');
  const ddiPhone = phonesWithData.find((p: any) => p.PhoneType === 'DDI');
  const phoneObj = mobilePhone || defaultPhone || ddiPhone || phonesWithData[0];
  
  const countryCode = phoneObj.PhoneCountryCode?.trim() || '';
  const areaCode = phoneObj.PhoneAreaCode?.trim() || '';
  const number = phoneObj.PhoneNumber?.trim() || '';
  
  const parts = [
    countryCode ? `+${countryCode}` : '',
    areaCode,
    number,
  ].filter(Boolean).join('');
  
  return parts || null;
}

/** Extract all possible name variations from a Xero contact for matching */
function getXeroNameKeys(xc: any): string[] {
  const keys: string[] = [];
  const firstName = xc.FirstName?.trim() || '';
  const lastName = xc.LastName?.trim() || '';
  const fullName = xc.Name?.trim() || '';
  
  // Direct FirstName + LastName
  if (firstName && lastName) {
    keys.push(`${firstName.toLowerCase()}|${lastName.toLowerCase()}`);
  }
  
  // Split full Name field
  if (fullName) {
    const parts = fullName.split(/\s+/);
    if (parts.length >= 2) {
      // "Michael Ware" -> michael|ware
      keys.push(`${parts[0].toLowerCase()}|${parts.slice(1).join(' ').toLowerCase()}`);
      // Also try last word as surname: "Ian & Tanya Gillespie" -> tanya|gillespie won't work but
      // for "Michael Ware" it gives same result
      if (parts.length > 2) {
        // Try second word as first name, rest as last: "Mr Michael Ware" -> michael|ware
        keys.push(`${parts[1].toLowerCase()}|${parts.slice(2).join(' ').toLowerCase()}`);
      }
    }
  }
  
  return [...new Set(keys)];
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
      if (c.email) emailMap.set(c.email.toLowerCase().trim(), c);
      if (c.first_name && c.last_name) {
        nameMap.set(`${c.first_name.toLowerCase().trim()}|${c.last_name.toLowerCase().trim()}`, c);
      }
    }

    const proposals: any[] = [];
    let page = 1;
    let hasMore = true;
    let totalXeroContacts = 0;
    let matchedCount = 0;
    let unmatchedWithPhone = 0;

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

        // Match to existing customer - try email first, then name variations
        let customer = null;
        if (email) customer = emailMap.get(email.toLowerCase());
        
        if (!customer) {
          const nameKeys = getXeroNameKeys(xc);
          for (const key of nameKeys) {
            customer = nameMap.get(key);
            if (customer) break;
          }
        }
        
        if (!customer) {
          const xeroPhone = extractPhone(xc);
          if (xeroPhone) unmatchedWithPhone++;
          continue;
        }

        matchedCount++;
        const xeroPhone = extractPhone(xc);

        if (!xeroPhone) continue;

        const currentPhone = customer.phone?.trim() || null;
        
        // Use smart comparison - skip if phones are effectively the same
        if (phonesMatch(currentPhone, xeroPhone)) continue;

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

    console.log(`Phone sync preview: ${totalXeroContacts} Xero contacts, ${matchedCount} matched, ${proposals.length} phone updates proposed, ${unmatchedWithPhone} unmatched with phone`);

    return new Response(JSON.stringify({
      success: true,
      total_checked: totalXeroContacts,
      matched: matchedCount,
      unmatched_with_phone: unmatchedWithPhone,
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
