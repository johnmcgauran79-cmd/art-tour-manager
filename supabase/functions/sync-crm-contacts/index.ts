
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
    // Check for API key in header (optional - for external integrations like Zapier)
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('CRM_SYNC_API_KEY');
    
    // If an API key is set, require it for external requests
    if (expectedApiKey && apiKey !== expectedApiKey) {
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

    const { contacts } = await req.json()
    console.log('Received contacts for sync:', contacts)

    if (!contacts || !Array.isArray(contacts)) {
      throw new Error('Invalid contacts data provided')
    }

    const results = []

    for (const contact of contacts) {
      try {
        // Check if contact already exists by CRM ID or email
        const { data: existingContact } = await supabase
          .from('customers')
          .select('id, crm_id')
          .or(`crm_id.eq.${contact.crm_id},email.eq.${contact.email}`)
          .single()

        if (existingContact) {
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${contacts.length} contacts`,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in sync-crm-contacts function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
