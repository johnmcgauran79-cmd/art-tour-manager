import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// Format phone numbers for WhatsApp compatibility
function formatPhoneForWhatsApp(phone: string | null): string | null {
  if (!phone || phone === '') return null;
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^0-9+]/g, '');
  
  // If already starts with +, validate and return
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.substring(1);
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      return cleaned;
    }
    return null;
  }
  
  // Get digits only
  const digitsOnly = cleaned.replace(/[^0-9]/g, '');
  
  // Return null if too short or too long
  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return null;
  }
  
  // Check if it already includes a country code
  if (digitsOnly.startsWith('61') && digitsOnly.length >= 11) {
    return '+' + digitsOnly;
  }
  
  // Handle Australian numbers (default for this business)
  let withoutLeadingZero = digitsOnly.startsWith('0') ? digitsOnly.substring(1) : digitsOnly;
  
  // Australian mobile numbers start with 4 and are 9 digits
  if (withoutLeadingZero.startsWith('4') && withoutLeadingZero.length === 9) {
    return '+61' + withoutLeadingZero;
  }
  
  // Australian landline numbers
  if (/^[2378]/.test(withoutLeadingZero) && withoutLeadingZero.length === 9) {
    return '+61' + withoutLeadingZero;
  }
  
  // If it's 10 digits and starts with 0, it's likely Australian
  if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
    return '+61' + digitsOnly.substring(1);
  }
  
  // Default: assume Australian and remove leading 0
  return '+61' + withoutLeadingZero;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('=== SYNC CRM CONTACTS FUNCTION CALLED ===');
    console.log('Request method:', req.method);
    
    // Check if CRM integration is enabled
    const { data: integrationSettings } = await supabase
      .from('crm_integration_settings')
      .select('*')
      .eq('provider_name', 'keap')
      .single();

    if (!integrationSettings?.is_enabled) {
      console.log('CRM integration is disabled');
      return new Response(
        JSON.stringify({ error: 'CRM integration is disabled' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get and validate request data
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

    // Check for API key if configured
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('CRM_SYNC_API_KEY');
    
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

    const { contacts } = requestData;
    console.log('Extracted contacts:', contacts);

    if (!contacts || !Array.isArray(contacts)) {
      console.error('Invalid contacts data:', { contacts, type: typeof contacts });
      throw new Error('Invalid contacts data provided - expected an array of contacts');
    }

    console.log(`Processing ${contacts.length} contacts`);

    const results = []
    let successCount = 0;
    let errorCount = 0;

    for (const contact of contacts) {
      console.log('Processing contact:', contact);
      try {
        // Format phone number
        const formattedPhone = formatPhoneForWhatsApp(contact.phone);
        
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
              phone: formattedPhone,
              city: contact.city,
              state: contact.state,
              country: contact.country,
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
          successCount++;
        } else {
          console.log('Creating new contact');
          // Create new contact
          const { data: newContact, error: insertError } = await supabase
            .from('customers')
            .insert({
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
              phone: formattedPhone,
              city: contact.city,
              state: contact.state,
              country: contact.country,
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
          successCount++;
        }
      } catch (contactError) {
        console.error('Error processing contact:', contactError)
        errorCount++;
        
        // Log sync error
        await supabase.from('crm_sync_log').insert({
          crm_contact_id: contact.crm_id,
          sync_action: 'failed',
          sync_status: 'failed',
          error_message: contactError.message,
        })

        results.push({ action: 'failed', contact, error: contactError.message })
      }
    }

    // Update integration settings with sync status
    await supabase
      .from('crm_integration_settings')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: errorCount > 0 ? 'partial_success' : 'success',
        error_message: errorCount > 0 ? `${errorCount} contacts failed to sync` : null
      })
      .eq('provider_name', 'keap');

    const response = {
      success: true, 
      message: `Processed ${contacts.length} contacts - ${successCount} successful, ${errorCount} failed`,
      results,
      summary: {
        total: contacts.length,
        successful: successCount,
        failed: errorCount
      }
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
    
    // Update integration settings with error status
    await supabase
      .from('crm_integration_settings')
      .update({
        sync_status: 'error',
        error_message: error.message
      })
      .eq('provider_name', 'keap');

    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})