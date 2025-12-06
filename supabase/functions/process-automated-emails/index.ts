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
      .eq('is_active', true)
      .order('days_before_tour', { ascending: false });

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      throw rulesError;
    }

    console.log(`Found ${rules?.length || 0} active rules`);

    let totalPendingCreated = 0;
    let totalEmailsSent = 0;
    const errors: any[] = [];

    // Get all upcoming tours (not archived/completed)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const { data: upcomingTours, error: toursError } = await supabase
      .from('tours')
      .select('id, name, start_date')
      .gte('start_date', todayStr)
      .neq('status', 'archived');

    if (toursError) {
      console.error('Error fetching tours:', toursError);
      throw toursError;
    }

    console.log(`Found ${upcomingTours?.length || 0} upcoming tours`);

    // Process each rule
    for (const rule of rules || []) {
      try {
        console.log(`Processing rule: ${rule.rule_name} (${rule.days_before_tour} days before)`);

        // Find tours that are within the rule's days_before_tour threshold
        for (const tour of upcomingTours || []) {
          const tourStartDate = new Date(tour.start_date);
          const daysUntilTour = Math.floor((tourStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Check if tour is within this rule's threshold (at or past the trigger point)
          if (daysUntilTour <= rule.days_before_tour && daysUntilTour >= 0) {
            console.log(`Tour "${tour.name}" is ${daysUntilTour} days away - eligible for ${rule.days_before_tour}-day rule`);

            // Get all non-cancelled bookings for this tour with valid email
            const { data: bookings, error: bookingsError } = await supabase
              .from('bookings')
              .select(`
                id,
                status,
                lead_passenger:customers!bookings_lead_passenger_id_fkey(first_name, last_name, email)
              `)
              .eq('tour_id', tour.id)
              .neq('status', 'cancelled')
              .neq('status', 'waitlisted');

            if (bookingsError) {
              console.error(`Error fetching bookings for tour ${tour.id}:`, bookingsError);
              errors.push({ tour: tour.name, rule: rule.rule_name, error: bookingsError });
              continue;
            }

            // Filter bookings with valid email
            const eligibleBookings = bookings?.filter(b => b.lead_passenger?.email) || [];
            console.log(`Found ${eligibleBookings.length} eligible bookings for tour "${tour.name}"`);

            // Process each booking
            for (const booking of eligibleBookings) {
              try {
                // Check if email already logged for this booking/rule combination
                const { data: existingLog } = await supabase
                  .from('automated_email_log')
                  .select('id, approval_status')
                  .eq('booking_id', booking.id)
                  .eq('rule_id', rule.id)
                  .maybeSingle();

                if (existingLog) {
                  console.log(`Email already logged for booking ${booking.id}, status: ${existingLog.approval_status}`);
                  
                  // If approved, send the email
                  if (existingLog.approval_status === 'approved') {
                    console.log(`Sending approved email for booking ${booking.id}`);
                    
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
                      console.error(`Error sending approved email for booking ${booking.id}:`, emailError);
                      errors.push({ 
                        booking: booking.id, 
                        rule: rule.rule_name, 
                        error: emailError 
                      });
                      continue;
                    }

                    // Update status to sent
                    await supabase
                      .from('automated_email_log')
                      .update({ 
                        approval_status: 'sent',
                        sent_at: new Date().toISOString(),
                        email_log_id: emailResult?.emailLogId 
                      })
                      .eq('id', existingLog.id);

                    console.log(`Email sent successfully for booking ${booking.id}`);
                    totalEmailsSent++;
                  }
                  
                  continue;
                }

                // Create pending approval record
                const { error: logError } = await supabase
                  .from('automated_email_log')
                  .insert({
                    booking_id: booking.id,
                    rule_id: rule.id,
                    tour_start_date: tour.start_date,
                    days_before_send: rule.days_before_tour,
                    approval_status: 'pending_approval'
                  });

                if (logError) {
                  console.error('Error creating approval record:', logError);
                  errors.push({ 
                    booking: booking.id, 
                    rule: rule.rule_name, 
                    error: logError 
                  });
                } else {
                  console.log(`Created pending approval for booking ${booking.id}, rule: ${rule.rule_name}`);
                  totalPendingCreated++;
                }

              } catch (bookingError) {
                console.error(`Error processing booking ${booking.id}:`, bookingError);
                errors.push({ 
                  booking: booking.id, 
                  rule: rule.rule_name, 
                  error: bookingError 
                });
              }
            }
          }
        }
      } catch (ruleError) {
        console.error(`Error processing rule ${rule.rule_name}:`, ruleError);
        errors.push({ rule: rule.rule_name, error: ruleError });
      }
    }

    const result = {
      success: true,
      totalPendingCreated,
      totalEmailsSent,
      rulesProcessed: rules?.length || 0,
      toursChecked: upcomingTours?.length || 0,
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
