import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('[Scheduled Emails] Processing scheduled emails...');

    // Find emails that are approved (or scheduled with auto-approve) and due to send
    const { data: dueEmails, error: fetchError } = await supabase
      .from('scheduled_emails')
      .select('*')
      .in('status', ['approved', 'scheduled'])
      .lte('scheduled_send_at', new Date().toISOString())
      .order('scheduled_send_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[Scheduled Emails] Error fetching due emails:', fetchError);
      throw fetchError;
    }

    if (!dueEmails || dueEmails.length === 0) {
      console.log('[Scheduled Emails] No emails due to send.');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Scheduled Emails] Found ${dueEmails.length} emails due to send.`);

    let successCount = 0;
    let failCount = 0;

    for (const email of dueEmails) {
      try {
        const payload = email.email_payload || {};
        
        // Call the send-booking-confirmation function
        const { data, error } = await supabase.functions.invoke('send-booking-confirmation', {
          body: {
            bookingId: email.booking_id,
            customSubject: payload.customSubject,
            customContent: payload.customContent,
            fromEmail: payload.fromEmail,
            ccEmails: payload.ccEmails,
            bccEmails: payload.bccEmails,
            includeAdditionalPassengers: payload.includeAdditionalPassengers ?? true,
            emailTemplateId: payload.emailTemplateId,
          },
        });

        if (error) {
          console.error(`[Scheduled Emails] Error sending email ${email.id}:`, error);
          await supabase
            .from('scheduled_emails')
            .update({ 
              status: 'failed', 
              error_message: error.message || 'Unknown error',
              sent_at: new Date().toISOString(),
            })
            .eq('id', email.id);
          failCount++;
          continue;
        }

        // Mark as sent
        await supabase
          .from('scheduled_emails')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
          })
          .eq('id', email.id);
        
        successCount++;
        console.log(`[Scheduled Emails] ✓ Sent email ${email.id} for booking ${email.booking_id}`);

        // Rate limit delay (600ms between sends)
        if (dueEmails.indexOf(email) < dueEmails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      } catch (err: any) {
        console.error(`[Scheduled Emails] Failed to process email ${email.id}:`, err);
        await supabase
          .from('scheduled_emails')
          .update({ 
            status: 'failed', 
            error_message: err.message || 'Unknown error',
            sent_at: new Date().toISOString(),
          })
          .eq('id', email.id);
        failCount++;
      }
    }

    console.log(`[Scheduled Emails] Complete: ${successCount} sent, ${failCount} failed.`);

    return new Response(JSON.stringify({ 
      processed: dueEmails.length,
      sent: successCount,
      failed: failCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Scheduled Emails] Critical error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
