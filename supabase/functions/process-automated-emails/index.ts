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

    // Get all active automated email rules, ordered by days_before_tour ascending
    // so we can easily find the most recent applicable rule
    const { data: rules, error: rulesError } = await supabase
      .from('automated_email_rules')
      .select('*, email_templates(*)')
      .eq('is_active', true)
      .eq('trigger_type', 'days_before_tour') // Only process scheduled rules, not on_status_change
      .order('days_before_tour', { ascending: true });

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      throw rulesError;
    }

    console.log(`Found ${rules?.length || 0} active rules`);

    let totalBatchesCreated = 0;
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

    // Process each tour - find the MOST RECENT applicable rule only
    for (const tour of upcomingTours || []) {
      try {
        const tourStartDate = new Date(tour.start_date);
        const daysUntilTour = Math.floor((tourStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`Tour "${tour.name}" is ${daysUntilTour} days away`);

        // Find the most recent applicable rule (smallest days_before_tour that we've passed)
        // Rules are sorted ascending by days_before_tour
        let applicableRule = null;
        for (const rule of rules || []) {
          if (daysUntilTour <= rule.days_before_tour) {
            applicableRule = rule;
            break; // Take the first (smallest) applicable rule
          }
        }

        if (!applicableRule) {
          console.log(`No applicable rule for tour "${tour.name}" (${daysUntilTour} days away)`);
          continue;
        }

        console.log(`Most recent applicable rule for "${tour.name}": ${applicableRule.rule_name} (${applicableRule.days_before_tour} days)`);

        // Check if we already have a batch approval for this tour/rule
        const { data: existingBatch } = await supabase
          .from('automated_email_log')
          .select('id, approval_status, sent_at')
          .eq('tour_id', tour.id)
          .eq('rule_id', applicableRule.id)
          .is('booking_id', null) // Batch records have null booking_id
          .maybeSingle();

        if (existingBatch) {
          console.log(`Batch already exists for tour "${tour.name}", rule "${applicableRule.rule_name}", status: ${existingBatch.approval_status}`);
          
          // If already sent, never regenerate - this is final
          if (existingBatch.approval_status === 'sent') {
            console.log(`Emails already sent for tour "${tour.name}", rule "${applicableRule.rule_name}" on ${existingBatch.sent_at} - skipping`);
            continue;
          }
          
          // If currently being processed (approved but not yet sent), skip to avoid duplicates
          if (existingBatch.approval_status === 'processing') {
            console.log(`Emails currently being processed for tour "${tour.name}" - skipping to avoid duplicates`);
            continue;
          }
          
          // If approved, process the batch and send emails
          if (existingBatch.approval_status === 'approved') {
            console.log(`Processing approved batch for tour "${tour.name}"`);
            
            // Mark as processing to prevent race conditions
            await supabase
              .from('automated_email_log')
              .update({ approval_status: 'processing' })
              .eq('id', existingBatch.id);
            
            const sentCount = await processBatchEmails(supabase, tour, applicableRule, existingBatch.id, errors);
            totalEmailsSent += sentCount;
            continue;
          }
          
          // If pending approval, skip - wait for user action
          if (existingBatch.approval_status === 'pending_approval') {
            console.log(`Batch pending approval for tour "${tour.name}" - skipping`);
            continue;
          }
          
          // If rejected, respect the rejection - do not regenerate
          if (existingBatch.approval_status === 'rejected') {
            console.log(`Batch was rejected for tour "${tour.name}", rule "${applicableRule.rule_name}" - skipping (rejection is permanent)`);
            continue;
          }
        }

        // Get count of eligible bookings for this tour with recipient filter
        let bookingsQuery = supabase
          .from('bookings')
          .select(`
            id,
            accommodation_required,
            lead_passenger:customers!bookings_lead_passenger_id_fkey(email)
          `)
          .eq('tour_id', tour.id)
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted');

        // Apply recipient filter
        if (applicableRule.recipient_filter === 'with_accommodation') {
          bookingsQuery = bookingsQuery.eq('accommodation_required', true);
        } else if (applicableRule.recipient_filter === 'without_accommodation') {
          bookingsQuery = bookingsQuery.eq('accommodation_required', false);
        }

        const { data: bookings, error: bookingsError } = await bookingsQuery;

        if (bookingsError) {
          console.error(`Error fetching bookings for tour ${tour.id}:`, bookingsError);
          errors.push({ tour: tour.name, error: bookingsError });
          continue;
        }

        // Filter bookings with valid email
        const eligibleBookings = bookings?.filter(b => b.lead_passenger?.email) || [];
        const bookingCount = eligibleBookings.length;

        if (bookingCount === 0) {
          console.log(`No eligible bookings for tour "${tour.name}"`);
          continue;
        }

        console.log(`Creating batch approval for tour "${tour.name}" with ${bookingCount} bookings`);

        // Create a single batch approval record
        const { error: logError } = await supabase
          .from('automated_email_log')
          .insert({
            tour_id: tour.id,
            booking_id: null, // Null indicates this is a batch record
            rule_id: applicableRule.id,
            tour_start_date: tour.start_date,
            days_before_send: applicableRule.days_before_tour,
            booking_count: bookingCount,
            approval_status: 'pending_approval'
          });

        if (logError) {
          console.error('Error creating batch approval record:', logError);
          errors.push({ tour: tour.name, rule: applicableRule.rule_name, error: logError });
        } else {
          console.log(`Created batch pending approval for tour "${tour.name}", rule: ${applicableRule.rule_name}, ${bookingCount} bookings`);
          totalBatchesCreated++;
        }

      } catch (tourError) {
        console.error(`Error processing tour ${tour.name}:`, tourError);
        errors.push({ tour: tour.name, error: tourError });
      }
    }

    // Also process passport details request rules
    let travelDocsBatches = 0;
    let travelDocsEmails = 0;
    try {
      console.log('--- Processing passport details request rules ---');
      const travelDocsResult = await processTravelDocsRules(supabase, errors);
      travelDocsBatches = travelDocsResult.batchesCreated;
      travelDocsEmails = travelDocsResult.emailsSent;
    } catch (travelDocsError) {
      console.error('Error processing travel docs rules:', travelDocsError);
      errors.push({ type: 'travel_docs', error: travelDocsError });
    }

    const result = {
      success: true,
      totalBatchesCreated: totalBatchesCreated + travelDocsBatches,
      totalEmailsSent: totalEmailsSent + travelDocsEmails,
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

// Process passport details request rules
async function processTravelDocsRules(supabase: any, errors: any[]): Promise<{ batchesCreated: number; emailsSent: number }> {
  let batchesCreated = 0;
  let emailsSent = 0;

  // Get travel docs rules
  const { data: rules, error: rulesError } = await supabase
    .from('automated_email_rules')
    .select('*')
    .eq('is_active', true)
    .eq('rule_type', 'travel_documents_request')
    .eq('trigger_type', 'days_before_tour')
    .order('days_before_tour', { ascending: true });

  if (rulesError) {
    console.error('Error fetching travel docs rules:', rulesError);
    throw rulesError;
  }

  if (!rules || rules.length === 0) {
    console.log('No active travel docs rules found');
    return { batchesCreated, emailsSent };
  }

  console.log(`Found ${rules.length} active travel docs rules`);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get tours requiring passport details
  const { data: tours, error: toursError } = await supabase
    .from('tours')
    .select('id, name, start_date, end_date')
    .eq('travel_documents_required', true)
    .gte('start_date', todayStr)
    .neq('status', 'archived');

  if (toursError) {
    console.error('Error fetching tours:', toursError);
    throw toursError;
  }

  console.log(`Found ${tours?.length || 0} tours requiring passport details`);

  for (const tour of tours || []) {
    try {
      const tourStartDate = new Date(tour.start_date);
      const daysUntilTour = Math.floor((tourStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Find applicable rule
      let applicableRule = null;
      for (const rule of rules) {
        if (daysUntilTour <= rule.days_before_tour) {
          applicableRule = rule;
          break;
        }
      }

      if (!applicableRule) {
        continue;
      }

      console.log(`Travel docs rule "${applicableRule.rule_name}" applies to tour "${tour.name}"`);

      // Check for existing batch
      const { data: existingBatch } = await supabase
        .from('automated_email_log')
        .select('id, approval_status, sent_at')
        .eq('tour_id', tour.id)
        .eq('rule_id', applicableRule.id)
        .is('booking_id', null)
        .maybeSingle();

      if (existingBatch) {
        if (existingBatch.approval_status === 'sent' || existingBatch.approval_status === 'processing') {
          continue;
        }
        
        if (existingBatch.approval_status === 'approved') {
          // Process approved batch - invoke travel docs edge function
          console.log(`Processing approved travel docs batch for "${tour.name}"`);
          
          await supabase
            .from('automated_email_log')
            .update({ approval_status: 'processing' })
            .eq('id', existingBatch.id);
          
          const { data: result, error: invokeError } = await supabase.functions.invoke(
            'process-travel-docs-emails',
            { body: { tourId: tour.id, ruleId: applicableRule.id, batchId: existingBatch.id } }
          );
          
          if (invokeError) {
            console.error('Error invoking travel docs processor:', invokeError);
            errors.push({ tour: tour.name, error: invokeError });
            await supabase
              .from('automated_email_log')
              .update({ approval_status: 'approved' })
              .eq('id', existingBatch.id);
          } else {
            emailsSent += result?.emailsSent || 0;
          }
          continue;
        }
        
        if (existingBatch.approval_status === 'pending_approval') {
          continue;
        }
        
        if (existingBatch.approval_status === 'rejected') {
          console.log(`Travel docs batch was rejected for tour "${tour.name}" - skipping (rejection is permanent)`);
          continue;
        }
      }

      // Get eligible bookings
      let bookingsQuery = supabase
        .from('bookings')
        .select(`id, customers!bookings_lead_passenger_id_fkey(email)`)
        .eq('tour_id', tour.id)
        .neq('status', 'cancelled')
        .neq('status', 'waitlisted');

      if (applicableRule.recipient_filter === 'with_accommodation') {
        bookingsQuery = bookingsQuery.eq('accommodation_required', true);
      } else if (applicableRule.recipient_filter === 'without_accommodation') {
        bookingsQuery = bookingsQuery.eq('accommodation_required', false);
      }

      const { data: bookings } = await bookingsQuery;
      const eligibleBookings = bookings?.filter((b: any) => b.customers?.email) || [];

      if (eligibleBookings.length === 0) {
        continue;
      }

      // Create batch approval record
      const { error: insertError } = await supabase
        .from('automated_email_log')
        .insert({
          tour_id: tour.id,
          booking_id: null,
          rule_id: applicableRule.id,
          tour_start_date: tour.start_date,
          days_before_send: applicableRule.days_before_tour,
          booking_count: eligibleBookings.length,
          approval_status: applicableRule.requires_approval ? 'pending_approval' : 'approved'
        });

      if (!insertError) {
        console.log(`Created travel docs batch for "${tour.name}" with ${eligibleBookings.length} bookings`);
        batchesCreated++;
      }

    } catch (tourError) {
      console.error(`Error processing tour ${tour.name} for passport details:`, tourError);
      errors.push({ tour: tour.name, type: 'passport_details', error: tourError });
    }
  }

  return { batchesCreated, emailsSent };
}

// Helper function to process a batch and send emails to all bookings
async function processBatchEmails(
  supabase: any, 
  tour: any, 
  rule: any, 
  batchId: string,
  errors: any[]
): Promise<number> {
  let sentCount = 0;
  let failedCount = 0;

  console.log(`=== Starting batch email processing for tour "${tour.name}" ===`);
  console.log(`Rule: ${rule.rule_name}, Recipient filter: ${rule.recipient_filter || 'all'}`);

  // Get all eligible bookings for this tour with recipient filter
  let bookingsQuery = supabase
    .from('bookings')
    .select(`
      id,
      passenger_count,
      accommodation_required,
      lead_passenger:customers!bookings_lead_passenger_id_fkey(first_name, last_name, email)
    `)
    .eq('tour_id', tour.id)
    .neq('status', 'cancelled')
    .neq('status', 'waitlisted');

  // Apply recipient filter
  if (rule.recipient_filter === 'with_accommodation') {
    bookingsQuery = bookingsQuery.eq('accommodation_required', true);
    console.log('Filtering for bookings WITH accommodation');
  } else if (rule.recipient_filter === 'without_accommodation') {
    bookingsQuery = bookingsQuery.eq('accommodation_required', false);
    console.log('Filtering for bookings WITHOUT accommodation');
  } else {
    console.log('No accommodation filter applied - sending to ALL bookings');
  }

  const { data: bookings, error: bookingsError } = await bookingsQuery;

  if (bookingsError) {
    console.error(`Error fetching bookings for batch processing:`, bookingsError);
    errors.push({ tour: tour.name, error: bookingsError });
    
    // Revert to approved status so it can be retried
    await supabase
      .from('automated_email_log')
      .update({ approval_status: 'approved' })
      .eq('id', batchId);
    
    return 0;
  }

  const eligibleBookings = bookings?.filter((b: any) => b.lead_passenger?.email) || [];
  console.log(`Found ${eligibleBookings.length} eligible bookings with valid email addresses`);
  
  if (eligibleBookings.length === 0) {
    console.log('No eligible bookings found - marking batch as sent (empty)');
    await supabase
      .from('automated_email_log')
      .update({ 
        approval_status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', batchId);
    return 0;
  }

  // Log each booking being processed
  for (const booking of eligibleBookings) {
    console.log(`  - Booking ${booking.id}: ${booking.lead_passenger?.first_name} ${booking.lead_passenger?.last_name} (${booking.lead_passenger?.email}), ${booking.passenger_count} pax, accommodation: ${booking.accommodation_required}`);
  }

  // Helper function for rate limiting delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Check for tour-specific template override
  let emailTemplate = rule.email_templates;
  const { data: override } = await supabase
    .from('tour_email_rule_overrides')
    .select('email_template_id')
    .eq('tour_id', tour.id)
    .eq('rule_id', rule.id)
    .maybeSingle();

  if (override?.email_template_id) {
    console.log(`Using tour-specific template override for tour "${tour.name}", rule "${rule.rule_name}"`);
    const { data: overrideTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', override.email_template_id)
      .single();
    if (overrideTemplate) {
      emailTemplate = overrideTemplate;
    }
  }

  for (let i = 0; i < eligibleBookings.length; i++) {
    const booking = eligibleBookings[i];
    try {
      console.log(`[${i + 1}/${eligibleBookings.length}] Sending email for booking ${booking.id} to ${booking.lead_passenger?.email}...`);
      
      const { data: emailResult, error: emailError } = await supabase.functions.invoke(
        'send-booking-confirmation',
        {
          body: {
            bookingId: booking.id,
            customSubject: emailTemplate?.subject_template,
            customContent: emailTemplate?.content_template,
            fromEmail: emailTemplate?.from_email,
            isAutomated: true
          }
        }
      );

      if (emailError) {
        console.error(`Error sending email for booking ${booking.id}:`, emailError);
        errors.push({ 
          booking: booking.id, 
          email: booking.lead_passenger?.email,
          error: emailError 
        });
        failedCount++;
      } else {
        console.log(`✓ Email sent successfully for booking ${booking.id} (${booking.lead_passenger?.email})`);
        sentCount++;
      }
    } catch (sendError) {
      console.error(`Exception sending email for booking ${booking.id}:`, sendError);
      errors.push({ 
        booking: booking.id, 
        email: booking.lead_passenger?.email,
        error: sendError 
      });
      failedCount++;
    }

    // Rate limiting: wait 600ms between emails to stay under Resend's 2 req/sec limit
    if (i < eligibleBookings.length - 1) {
      await delay(600);
    }
  }

  // Update batch status to sent
  await supabase
    .from('automated_email_log')
    .update({ 
      approval_status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', batchId);

  console.log(`=== Batch complete for tour "${tour.name}" ===`);
  console.log(`  Sent: ${sentCount}, Failed: ${failedCount}, Total: ${eligibleBookings.length}`);
  
  return sentCount;
}
