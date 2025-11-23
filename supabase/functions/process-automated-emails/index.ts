import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting automated email processing...');

    // Get all active automated email rules
    const { data: rules, error: rulesError } = await supabase
      .from('automated_email_rules')
      .select('*, email_templates(*)')
      .eq('is_active', true);

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      throw rulesError;
    }

    console.log(`Found ${rules?.length || 0} active rules`);

    let totalEmailsSent = 0;
    const errors: any[] = [];

    // Process each rule
    for (const rule of rules || []) {
      try {
        console.log(`Processing rule: ${rule.rule_name} (${rule.days_before_tour} days before)`);

        // Calculate target date (tour start date should be X days from today)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + rule.days_before_tour);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        console.log(`Looking for tours starting on: ${targetDateStr}`);

        // Find bookings for tours starting on the target date
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,
            lead_passenger:customers!bookings_lead_passenger_id_fkey(first_name, last_name, email),
            tour:tours(id, name, start_date, end_date, location)
          `)
          .eq('tour.start_date', targetDateStr)
          .neq('status', 'cancelled')
          .not('lead_passenger.email', 'is', null);

        if (bookingsError) {
          console.error('Error fetching bookings:', bookingsError);
          errors.push({ rule: rule.rule_name, error: bookingsError });
          continue;
        }

        console.log(`Found ${bookings?.length || 0} eligible bookings for this rule`);

        // Process each booking
        for (const booking of bookings || []) {
          try {
            // Check if email already sent for this booking/rule combination
            const { data: existingLog } = await supabase
              .from('automated_email_log')
              .select('id')
              .eq('booking_id', booking.id)
              .eq('rule_id', rule.id)
              .single();

            if (existingLog) {
              console.log(`Email already sent for booking ${booking.id}, rule ${rule.rule_name}`);
              continue;
            }

            // Send the email via send-booking-confirmation edge function
            const { data: emailResult, error: emailError } = await supabase.functions.invoke(
              'send-booking-confirmation',
              {
                body: {
                  bookingId: booking.id,
                  customSubject: rule.email_templates?.subject_template,
                  customContent: rule.email_templates?.content_template,
                  fromEmail: rule.email_templates?.from_email,
                  isAutomated: true
                }
              }
            );

            if (emailError) {
              console.error(`Error sending email for booking ${booking.id}:`, emailError);
              errors.push({ 
                booking: booking.id, 
                rule: rule.rule_name, 
                error: emailError 
              });
              continue;
            }

            console.log(`Email sent successfully for booking ${booking.id}`);

            // Log the sent email
            const { error: logError } = await supabase
              .from('automated_email_log')
              .insert({
                booking_id: booking.id,
                rule_id: rule.id,
                tour_start_date: booking.tour.start_date,
                days_before_send: rule.days_before_tour,
                email_log_id: emailResult?.emailLogId
              });

            if (logError) {
              console.error('Error logging sent email:', logError);
            }

            totalEmailsSent++;
          } catch (bookingError) {
            console.error(`Error processing booking ${booking.id}:`, bookingError);
            errors.push({ 
              booking: booking.id, 
              rule: rule.rule_name, 
              error: bookingError 
            });
          }
        }
      } catch (ruleError) {
        console.error(`Error processing rule ${rule.rule_name}:`, ruleError);
        errors.push({ rule: rule.rule_name, error: ruleError });
      }
    }

    const result = {
      success: true,
      totalEmailsSent,
      rulesProcessed: rules?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    console.log('Automated email processing complete:', result);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('Fatal error in automated email processing:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});