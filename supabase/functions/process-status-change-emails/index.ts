import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get approved emails from the queue
    const { data: queueItems, error: queueError } = await supabase
      .from('status_change_email_queue')
      .select(`
        *,
        rule:automated_email_rules(
          id,
          rule_name,
          email_template_id,
          trigger_conditions,
          recipient_filter,
          email_templates:email_templates(
            id,
            name,
            type,
            subject_template,
            content_template,
            from_email
          )
        ),
        booking:bookings(
          id,
          passenger_count,
          lead_passenger_id,
          passenger_2_id,
          passenger_3_id,
          status,
          customers:customers!bookings_lead_passenger_id_fkey(
            id, first_name, last_name, email, preferred_name
          ),
          passenger_2:customers!bookings_passenger_2_id_fkey(
            id, first_name, last_name, email, preferred_name
          ),
          passenger_3:customers!bookings_passenger_3_id_fkey(
            id, first_name, last_name, email, preferred_name
          )
        ),
        tour:tours(
          id, name, start_date, end_date, location, tour_type, travel_documents_required
        )
      `)
      .eq('approval_status', 'approved')
      .is('processed_at', null);

    if (queueError) {
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No approved emails to process',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${queueItems.length} approved status change emails`);

    // Helper function for rate limiting delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let successCount = 0;
    let errorCount = 0;

    for (const item of queueItems) {
      try {
        let template = item.rule?.email_templates;
        const booking = item.booking;
        const tour = item.tour;

        if (!booking || !tour) {
          console.error(`Missing booking or tour for queue item ${item.id}`);
          continue;
        }

        // Priority 1: Queue-item-level template override
        if (item.email_template_id) {
          console.log(`Using queue-item template override for queue item ${item.id}`);
          const { data: queueTemplate } = await supabase
            .from('email_templates')
            .select('*')
            .eq('id', item.email_template_id)
            .single();
          if (queueTemplate) {
            template = queueTemplate;
          }
        }
        // Priority 2: Tour-specific template override
        else if (item.tour_id && item.rule?.id) {
          const { data: override } = await supabase
            .from('tour_email_rule_overrides')
            .select('email_template_id')
            .eq('tour_id', item.tour_id)
            .eq('rule_id', item.rule.id)
            .maybeSingle();

          if (override?.email_template_id) {
            console.log(`Using tour-specific template override for queue item ${item.id}`);
            const { data: overrideTemplate } = await supabase
              .from('email_templates')
              .select('*')
              .eq('id', override.email_template_id)
              .single();
            if (overrideTemplate) {
              template = overrideTemplate;
            }
          }
        }

        if (!template) {
          console.error(`No template available for queue item ${item.id}`);
          continue;
        }

        // Delegate to send-booking-confirmation for full merge field processing
        // This ensures all merge fields (tour_days, hotel_bookings, profile_update_button, etc.)
        // are properly resolved, just like manual and automated emails.
        console.log(`Delegating booking ${booking.id} to send-booking-confirmation for full template processing`);

        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-booking-confirmation',
          {
            body: {
              bookingId: booking.id,
              customSubject: template.subject_template,
              customContent: template.content_template,
              fromEmail: template.from_email,
              isAutomated: true,
              includeAdditionalPassengers: true,
              ruleId: item.rule_id || item.rule?.id
            }
          }
        );

        if (emailError) {
          console.error(`Error sending email for booking ${booking.id}:`, emailError);
          errorCount++;
        } else {
          console.log(`✓ Email sent for booking ${booking.id} to ${emailResult?.sentTo}`);
          
          // Log the email reference if available
          if (emailResult?.emailId) {
            await supabase
              .from('email_logs')
              .select('id')
              .eq('message_id', emailResult.emailId)
              .single()
              .then(({ data: emailLog }) => {
                if (emailLog) {
                  supabase
                    .from('status_change_email_queue')
                    .update({ email_log_id: emailLog.id })
                    .eq('id', item.id);
                }
              });
          }

          successCount++;
        }

        // Mark as processed
        await supabase
          .from('status_change_email_queue')
          .update({ 
            processed_at: new Date().toISOString(),
            approval_status: 'sent'
          })
          .eq('id', item.id);

        // Rate limiting: wait 600ms between emails
        await delay(600);

      } catch (itemError) {
        console.error(`Error processing queue item ${item.id}:`, itemError);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({ 
      message: `Processed ${successCount} emails successfully, ${errorCount} errors`,
      processed: successCount,
      errors: errorCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-status-change-emails:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});