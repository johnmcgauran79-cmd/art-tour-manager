import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { waitForXeroLock, releaseXeroLock } from '../_shared/xeroLock.ts';
import { normaliseStateCode } from '../_shared/auStates.ts';

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
  if (Date.now() >= expiresAt - 300000) {
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

/** Pull the best address block from a Xero contact. */
function extractAddress(xc: any): { city: string | null; region: string | null; country: string | null } {
  const addresses = (xc.Addresses || []).filter(
    (a: any) => a.City?.trim() || a.Region?.trim() || a.Country?.trim()
  );
  if (addresses.length === 0) return { city: null, region: null, country: null };
  const addr = addresses.find((a: any) => a.AddressType === 'STREET') || addresses[0];
  return {
    city: addr.City?.trim() || null,
    region: addr.Region?.trim() || null,
    country: addr.Country?.trim() || null,
  };
}

/** Derive a canonical state code from Xero address data (Region → City → Country). */
function deriveState(addr: { city: string | null; region: string | null; country: string | null }): string {
  return (
    normaliseStateCode(addr.region) ||
    normaliseStateCode(addr.city) ||
    normaliseStateCode(addr.country) ||
    ''
  );
}

/** All possible name keys for a Xero contact (mirrors phone sync matching). */
function getXeroNameKeys(xc: any): string[] {
  const keys: string[] = [];
  const firstName = xc.FirstName?.trim() || '';
  const lastName = xc.LastName?.trim() || '';
  const fullName = xc.Name?.trim() || '';

  if (firstName && lastName) keys.push(`${firstName.toLowerCase()}|${lastName.toLowerCase()}`);

  if (fullName) {
    const parts = fullName.split(/\s+/);
    if (parts.length >= 2) {
      keys.push(`${parts[0].toLowerCase()}|${parts.slice(1).join(' ').toLowerCase()}`);
      if (parts.length > 2) {
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

  const lockHolder = `sync-xero-states:${crypto.randomUUID()}`;
  const gotLock = await waitForXeroLock(supabase, lockHolder, {
    ttlSeconds: 120,
    maxWaitMs: 5000,
    pollMs: 500,
  });
  if (!gotLock) {
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: 'xero_api lock held' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, updates } = body as { action?: string; updates?: any[] };

    const auth = await getValidAccessToken(supabase);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Xero not connected or token expired' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // APPLY: write the accepted state (plus city/country when the system has none)
    if (action === 'apply') {
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No updates provided' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let updated = 0;
      let errors = 0;
      for (const u of updates) {
        const patch: Record<string, string> = {};
        if (u.xero_state) patch.state = u.xero_state;
        if (u.fill_city && u.xero_city) patch.city = u.xero_city;
        if (u.fill_country && u.xero_country) patch.country = u.xero_country;
        if (Object.keys(patch).length === 0) continue;

        const { error } = await supabase.from('customers').update(patch).eq('id', u.customer_id);
        if (error) {
          console.error('State update error:', u.customer_id, error.message);
          errors++;
        } else {
          updated++;
        }
      }

      return new Response(JSON.stringify({ success: true, updated, errors }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PREVIEW: load system contacts, then compare against every active Xero contact
    const allCustomers: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, city, state, country')
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allCustomers.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const emailMap = new Map<string, any>();
    const nameMap = new Map<string, any>();
    for (const c of allCustomers) {
      if (c.email) emailMap.set(c.email.toLowerCase().trim(), c);
      if (c.first_name && c.last_name) {
        nameMap.set(`${c.first_name.toLowerCase().trim()}|${c.last_name.toLowerCase().trim()}`, c);
      }
    }

    const proposals: any[] = [];
    const seen = new Set<string>();
    let page = 1;
    let hasMore = true;
    let totalXeroContacts = 0;
    let matchedCount = 0;
    let unmatchedWithState = 0;

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
        const addr = extractAddress(xc);
        const derivedState = deriveState(addr);
        const email = xc.EmailAddress?.trim() || null;

        let customer = email ? emailMap.get(email.toLowerCase()) : null;
        if (!customer) {
          for (const key of getXeroNameKeys(xc)) {
            customer = nameMap.get(key);
            if (customer) break;
          }
        }

        if (!customer) {
          if (derivedState) unmatchedWithState++;
          continue;
        }

        matchedCount++;

        // Only propose where the system is missing the state — never overwrite existing data.
        const currentState = customer.state?.trim() || '';
        if (currentState) continue;
        if (!derivedState) continue;
        if (seen.has(customer.id)) continue;
        seen.add(customer.id);

        proposals.push({
          customer_id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          current_state: currentState || null,
          current_city: customer.city || null,
          xero_state: derivedState,
          xero_region: addr.region,
          xero_city: addr.city,
          xero_country: addr.country,
          fill_city: !customer.city?.trim() && !!addr.city,
          fill_country: !customer.country?.trim() && !!addr.country,
          xero_name: xc.Name,
        });
      }

      if (xeroContacts.length < 100) { hasMore = false; } else { page++; }
    }

    console.log(`State sync preview: ${totalXeroContacts} Xero contacts, ${matchedCount} matched, ${proposals.length} state fills proposed, ${unmatchedWithState} unmatched with state`);

    return new Response(JSON.stringify({
      success: true,
      total_checked: totalXeroContacts,
      matched: matchedCount,
      unmatched_with_state: unmatchedWithState,
      proposals,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('State sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } finally {
    await releaseXeroLock(supabase, lockHolder);
  }
});
