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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const auth = await getValidAccessToken(supabase);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Xero not connected or token expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch settings to get last sync time
    const { data: settings } = await supabase
      .from('xero_integration_settings')
      .select('last_contact_sync_at')
      .eq('id', auth.settingsId)
      .maybeSingle();

    // Note: Xero doesn't support filtering contacts by CreatedDateUTC.
    // We fetch all active contacts and rely on in-memory dedup to skip existing ones.
    const dateFilter = '';
    console.log('Fetching all active Xero contacts (dedup handled in-memory)...');

    // Load already-synced Xero ContactIDs to avoid re-importing deleted/merged contacts
    const syncedXeroIds = new Set<string>();
    let syncFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from('xero_sync_log')
        .select('entity_id')
        .eq('entity_type', 'contact')
        .range(syncFrom, syncFrom + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      data.forEach((row: any) => syncedXeroIds.add(row.entity_id));
      if (data.length < batchSize) break;
      syncFrom += batchSize;
    }
    console.log(`Loaded ${syncedXeroIds.size} already-synced Xero ContactIDs`);

    // Load existing customers for duplicate matching
    const allCustomers: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name')
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allCustomers.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    console.log(`Loaded ${allCustomers.length} existing customers for matching`);

    // Build lookup maps
    const emailMap = new Map<string, any>();
    const nameMap = new Map<string, any>();
    for (const c of allCustomers) {
      if (c.email) emailMap.set(c.email.toLowerCase(), c);
      if (c.first_name && c.last_name) {
        nameMap.set(`${c.first_name.toLowerCase()}|${c.last_name.toLowerCase()}`, c);
      }
    }

    let page = 1;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let hasMore = true;

    while (hasMore) {
      const contactsResponse = await fetch(
        `https://api.xero.com/api.xro/2.0/Contacts?page=${page}&where=ContactStatus=="ACTIVE"${dateFilter}`,
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
        console.error('Failed to fetch Xero contacts:', errorText);
        throw new Error(`Failed to fetch Xero contacts: ${contactsResponse.status}`);
      }

      const contactsData = await contactsResponse.json();
      const xeroContacts = contactsData.Contacts || [];
      
      if (xeroContacts.length === 0) {
        hasMore = false;
        break;
      }

      // Process contacts in this page - collect new ones for batch insert
      const toInsert: any[] = [];
      const insertMeta: any[] = []; // parallel array for sync log

      for (const xeroContact of xeroContacts) {
        try {
          const email = xeroContact.EmailAddress?.trim() || null;
          const firstName = xeroContact.FirstName || xeroContact.Name?.split(' ')[0] || '';
          const lastName = xeroContact.LastName || xeroContact.Name?.split(' ').slice(1).join(' ') || '';
          
          if (!firstName && !lastName) {
            totalSkipped++;
            continue;
          }

          // Skip if this Xero ContactID was already synced (prevents re-importing merged/deleted contacts)
          if (syncedXeroIds.has(xeroContact.ContactID)) {
            totalSkipped++;
            continue;
          }

          // Check existing via in-memory maps
          let exists = false;
          if (email && emailMap.has(email.toLowerCase())) {
            exists = true;
          } else if (firstName && lastName && nameMap.has(`${firstName.toLowerCase()}|${lastName.toLowerCase()}`)) {
            exists = true;
          }

          if (exists) {
            totalSkipped++;
          } else if (firstName && lastName) {
            let phone = null;
            if (xeroContact.Phones?.length > 0) {
              // Filter to phones that actually have data, then prioritize
              const phonesWithData = xeroContact.Phones.filter((p: any) =>
                p.PhoneNumber?.trim() || p.PhoneAreaCode?.trim()
              );
              if (phonesWithData.length > 0) {
                const mobilePhone = phonesWithData.find((p: any) => p.PhoneType === 'MOBILE');
                const defaultPhone = phonesWithData.find((p: any) => p.PhoneType === 'DEFAULT');
                const ddiPhone = phonesWithData.find((p: any) => p.PhoneType === 'DDI');
                const phoneObj = mobilePhone || defaultPhone || ddiPhone || phonesWithData[0];
                const parts = [
                  phoneObj.PhoneCountryCode?.trim() ? `+${phoneObj.PhoneCountryCode.trim()}` : '',
                  phoneObj.PhoneAreaCode?.trim() || '',
                  phoneObj.PhoneNumber?.trim() || '',
                ].filter(Boolean).join('');
                if (parts) phone = parts;
              }
            }

            let city = null, state = null, country = null;
            if (xeroContact.Addresses?.length > 0) {
              const addr = xeroContact.Addresses.find((a: any) => a.AddressType === 'STREET') || xeroContact.Addresses[0];
              city = addr.City || null;
              state = addr.Region || null;
              country = addr.Country || null;
            }

            toInsert.push({
              first_name: firstName,
              last_name: lastName,
              email: email || null,
              phone,
              city,
              state,
              country,
            });
            insertMeta.push({ contactId: xeroContact.ContactID, name: xeroContact.Name, email });

            // Add to maps so duplicates within same sync are caught
            if (email) emailMap.set(email.toLowerCase(), { id: 'pending' });
            nameMap.set(`${firstName.toLowerCase()}|${lastName.toLowerCase()}`, { id: 'pending' });
          } else {
            totalSkipped++;
          }
        } catch (contactError) {
          console.error('Error processing Xero contact:', xeroContact.Name, contactError);
          totalErrors++;
        }
      }

      // Batch insert new contacts
      if (toInsert.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('customers')
          .insert(toInsert)
          .select('id');

        if (insertError) {
          console.error('Batch insert error:', insertError);
          totalErrors += toInsert.length;
        } else if (inserted) {
          totalCreated += inserted.length;

          // Batch insert sync logs
          const syncLogs = inserted.map((row: any, idx: number) => ({
            sync_type: 'contact_sync',
            entity_type: 'contact',
            entity_id: insertMeta[idx].contactId,
            customer_id: row.id,
            action: 'contact_created',
            details: { xero_name: insertMeta[idx].name, email: insertMeta[idx].email },
            status: 'success',
          }));
          await supabase.from('xero_sync_log').insert(syncLogs);
        }
      }

      if (xeroContacts.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Update last sync timestamp
    await supabase
      .from('xero_integration_settings')
      .update({ last_contact_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', auth.settingsId);

    const response = {
      success: true,
      message: `Contact sync complete: ${totalCreated} created, ${totalSkipped} skipped, ${totalErrors} errors`,
      created: totalCreated,
      skipped: totalSkipped,
      errors: totalErrors,
    };

    console.log('Sync result:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Contact sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
