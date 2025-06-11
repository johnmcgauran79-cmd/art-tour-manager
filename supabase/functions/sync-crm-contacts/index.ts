
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SYNC CRM CONTACTS FUNCTION CALLED ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Log the raw request body for debugging
    const requestText = await req.text();
    console.log('Raw request body:', requestText);
    
    let requestData;
    try {
      requestData = JSON.parse(requestText);
      console.log('Parsed request data:', requestData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', details: parseError.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check for API key in header (optional - for external integrations like Zapier)
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('CRM_SYNC_API_KEY');
    
    console.log('API Key from request:', apiKey ? 'Present' : 'Missing');
    console.log('Expected API Key:', expectedApiKey ? 'Set in environment' : 'Not set in environment');
    
    // If an API key is set, require it for external requests
    if (expectedApiKey && apiKey !== expectedApiKey) {
      console.log('API key validation failed');
      return new Response(
        JSON.stringify({ error: 'Invalid or missing API key' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { contacts } = requestData;
    console.log('Extracted contacts:', contacts);

    if (!contacts || !Array.isArray(contacts)) {
      console.error('Invalid contacts data:', { contacts, type: typeof contacts });
      throw new Error('Invalid contacts data provided - expected an array of contacts');
    }

    console.log(`Processing ${contacts.length} contacts`);

    const results = []

    for (const contact of contacts) {
      console.log('Processing contact:', contact);
      try {
        // Check if contact already exists by CRM ID or email
        const { data: existingContact } = await supabase
          .from('customers')
          .select('id, crm_id')
          .or(`crm_id.eq.${contact.crm_id},email.eq.${contact.email}`)
          .single()

        if (existingContact) {
          console.log('Updating existing contact:', existingContact.id);
          // Update existing contact
          const { data: updatedContact, error: updateError } = await supabase
            .from('customers')
            .update({
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
              phone: contact.phone,
              state: contact.state,
              dietary_requirements: contact.dietary_requirements,
              crm_id: contact.crm_id,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingContact.id)
            .select()
            .single()

          if (updateError) throw updateError

          // Log sync action
          await supabase.from('crm_sync_log').insert({
            contact_id: existingContact.id,
            crm_contact_id: contact.crm_id,
            sync_action: 'updated',
            sync_status: 'success',
          })

          results.push({ action: 'updated', contact: updatedContact })
        } else {
          console.log('Creating new contact');
          // Create new contact
          const { data: newContact, error: insertError } = await supabase
            .from('customers')
            .insert({
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
              phone: contact.phone,
              state: contact.state,
              dietary_requirements: contact.dietary_requirements,
              crm_id: contact.crm_id,
              last_synced_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (insertError) throw insertError

          // Log sync action
          await supabase.from('crm_sync_log').insert({
            contact_id: newContact.id,
            crm_contact_id: contact.crm_id,
            sync_action: 'created',
            sync_status: 'success',
          })

          results.push({ action: 'created', contact: newContact })
        }
      } catch (contactError) {
        console.error('Error processing contact:', contactError)
        
        // Log sync error
        await supabase.from('crm_sync_log').insert({
          crm_contact_id: contact.crm_id,
          sync_action: 'created',
          sync_status: 'failed',
          error_message: contactError.message,
        })

        results.push({ action: 'failed', contact, error: contactError.message })
      }
    }

    const response = {
      success: true, 
      message: `Processed ${contacts.length} contacts`,
      results 
    };
    
    console.log('Final response:', response);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in sync-crm-contacts function:', error)
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
