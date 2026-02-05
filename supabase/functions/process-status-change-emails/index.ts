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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

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
            id,
            first_name,
            last_name,
            email,
            preferred_name
          ),
          passenger_2:customers!bookings_passenger_2_id_fkey(
            id,
            first_name,
            last_name,
            email,
            preferred_name
          ),
          passenger_3:customers!bookings_passenger_3_id_fkey(
            id,
            first_name,
            last_name,
            email,
            preferred_name
          )
        ),
        tour:tours(
          id,
          name,
          start_date,
          end_date,
          location,
          tour_type
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

    let successCount = 0;
    let errorCount = 0;

    for (const item of queueItems) {
      try {
        const template = item.rule?.email_templates;
        const booking = item.booking;
        const tour = item.tour;

        if (!template || !booking || !tour) {
          console.error(`Missing template, booking, or tour for queue item ${item.id}`);
          continue;
        }

        // Collect all passengers with email addresses
        const passengers = [];
        
        // Lead passenger
        if (booking.customers?.email) {
          passengers.push({
            email: booking.customers.email,
            firstName: booking.customers.preferred_name || booking.customers.first_name,
            lastName: booking.customers.last_name,
          });
        }

        // Passenger 2
        if (booking.passenger_2?.email) {
          passengers.push({
            email: booking.passenger_2.email,
            firstName: booking.passenger_2.preferred_name || booking.passenger_2.first_name,
            lastName: booking.passenger_2.last_name,
          });
        }

        // Passenger 3
        if (booking.passenger_3?.email) {
          passengers.push({
            email: booking.passenger_3.email,
            firstName: booking.passenger_3.preferred_name || booking.passenger_3.first_name,
            lastName: booking.passenger_3.last_name,
          });
        }

        if (passengers.length === 0) {
          console.log(`No passengers with email for booking ${booking.id}`);
          await supabase
            .from('status_change_email_queue')
            .update({ 
              processed_at: new Date().toISOString(),
              approval_status: 'sent'
            })
            .eq('id', item.id);
          continue;
        }

        // Send email to each passenger
        for (const passenger of passengers) {
          // Replace template variables
          let subject = template.subject_template;
          let content = template.content_template;

          const replacements: Record<string, string> = {
            '{{customer_first_name}}': passenger.firstName,
            '{{customer_last_name}}': passenger.lastName,
            '{{customer_name}}': `${passenger.firstName} ${passenger.lastName}`,
            '{{tour_name}}': tour.name,
            '{{tour_start_date}}': new Date(tour.start_date).toLocaleDateString('en-AU', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            }),
            '{{tour_end_date}}': new Date(tour.end_date).toLocaleDateString('en-AU', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            }),
            '{{tour_location}}': tour.location || '',
            '{{booking_status}}': item.new_status,
            '{{previous_status}}': item.previous_status || 'new',
            '{{passenger_count}}': String(booking.passenger_count),
          };

          for (const [key, value] of Object.entries(replacements)) {
            subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
            content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
          }

          // Send email via Resend
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: template.from_email,
              to: passenger.email,
              subject: subject,
              html: content,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error(`Failed to send email to ${passenger.email}:`, errorText);
            errorCount++;
            continue;
          }

          const emailResult = await emailResponse.json();
          console.log(`Email sent to ${passenger.email}, message_id: ${emailResult.id}`);

          // Log the email
          const { data: emailLog } = await supabase
            .from('email_logs')
            .insert({
              booking_id: booking.id,
              tour_id: tour.id,
              recipient_email: passenger.email,
              recipient_name: `${passenger.firstName} ${passenger.lastName}`,
              subject: subject,
              message_id: emailResult.id,
              template_name: template.name,
            })
            .select()
            .single();

          // Update queue item with email log reference
          await supabase
            .from('status_change_email_queue')
            .update({ 
              email_log_id: emailLog?.id 
            })
            .eq('id', item.id);

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
