import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: get valid access token, refreshing if needed
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

    console.log('Fetching contacts from Xero...');

    // Fetch contacts from Xero (paginated, up to 100 at a time)
    let page = 1;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let hasMore = true;

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
        console.error('Failed to fetch Xero contacts:', errorText);
        throw new Error(`Failed to fetch Xero contacts: ${contactsResponse.status}`);
      }

      const contactsData = await contactsResponse.json();
      const xeroContacts = contactsData.Contacts || [];
      
      if (xeroContacts.length === 0) {
        hasMore = false;
        break;
      }

      for (const xeroContact of xeroContacts) {
        try {
          const email = xeroContact.EmailAddress?.trim() || null;
          const firstName = xeroContact.FirstName || xeroContact.Name?.split(' ')[0] || '';
          const lastName = xeroContact.LastName || xeroContact.Name?.split(' ').slice(1).join(' ') || '';
          
          // Skip contacts without a name
          if (!firstName && !lastName) {
            totalSkipped++;
            continue;
          }

          // Extract phone number
          let phone = null;
          if (xeroContact.Phones?.length > 0) {
            const mobilePhone = xeroContact.Phones.find((p: any) => p.PhoneType === 'MOBILE');
            const defaultPhone = xeroContact.Phones.find((p: any) => p.PhoneType === 'DEFAULT');
            const phoneObj = mobilePhone || defaultPhone;
            if (phoneObj?.PhoneNumber) {
              phone = phoneObj.PhoneCountryCode 
                ? `+${phoneObj.PhoneCountryCode}${phoneObj.PhoneAreaCode || ''}${phoneObj.PhoneNumber}`
                : phoneObj.PhoneNumber;
            }
          }

          // Extract address
          let city = null, state = null, country = null;
          if (xeroContact.Addresses?.length > 0) {
            const addr = xeroContact.Addresses.find((a: any) => a.AddressType === 'STREET') || xeroContact.Addresses[0];
            city = addr.City || null;
            state = addr.Region || null;
            country = addr.Country || null;
          }

          // Check if contact exists - first by email, then by name
          let existingContact = null;
          if (email) {
            const { data } = await supabase
              .from('customers')
              .select('id')
              .eq('email', email)
              .maybeSingle();
            existingContact = data;
          }
          
          // Fallback: match by first + last name if no email match
          if (!existingContact && firstName && lastName) {
            const { data } = await supabase
              .from('customers')
              .select('id')
              .ilike('first_name', firstName)
              .ilike('last_name', lastName)
              .maybeSingle();
            existingContact = data;
          }

          if (existingContact) {
            // Update existing contact - only set non-null values
            const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
            if (firstName) updateData.first_name = firstName;
            if (lastName) updateData.last_name = lastName;
            if (email) updateData.email = email;
            if (phone) updateData.phone = phone;
            if (city) updateData.city = city;
            if (state) updateData.state = state;
            if (country) updateData.country = country;

            await supabase
              .from('customers')
              .update(updateData)
              .eq('id', existingContact.id);

            await supabase.from('xero_sync_log').insert({
              sync_type: 'contact_sync',
              entity_type: 'contact',
              entity_id: xeroContact.ContactID,
              customer_id: existingContact.id,
              action: 'contact_updated',
              details: { xero_name: xeroContact.Name, email },
              status: 'success',
            });

            totalUpdated++;
          } else if (firstName && lastName) {
            // Create new contact - use null for empty email to avoid unique constraint
            const { data: newContact, error: insertError } = await supabase
              .from('customers')
              .insert({
                first_name: firstName,
                last_name: lastName,
                email: email || null,
                phone,
                city,
                state,
                country,
              })
              .select('id')
              .single();

            if (insertError) throw insertError;

            await supabase.from('xero_sync_log').insert({
              sync_type: 'contact_sync',
              entity_type: 'contact',
              entity_id: xeroContact.ContactID,
              customer_id: newContact.id,
              action: 'contact_created',
              details: { xero_name: xeroContact.Name, email },
              status: 'success',
            });

            totalCreated++;
          } else {
            totalSkipped++;
          }
        } catch (contactError) {
          console.error('Error processing Xero contact:', xeroContact.Name, contactError);
          totalErrors++;
          
          await supabase.from('xero_sync_log').insert({
            sync_type: 'contact_sync',
            entity_type: 'contact',
            entity_id: xeroContact.ContactID,
            action: 'contact_sync_failed',
            status: 'failed',
            error_message: contactError.message,
          });
        }
      }

      // Xero returns 100 contacts per page
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
      message: `Contact sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`,
      created: totalCreated,
      updated: totalUpdated,
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
