// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed statuses for post-booking emails
const ALLOWED_STATUSES = ['invoiced', 'host', 'fully_paid', 'complimentary', 'instalment_paid'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting post-booking email processing...');

    // Get all active post-booking email rules
    const { data: rules, error: rulesError } = await supabase
      .from('automated_email_rules')
      .select('*, email_templates(*)')
      .eq('is_active', true)
      .eq('trigger_type', 'days_after_booking')
      .eq('requires_approval', false);

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      throw rulesError;
    }

    console.log(`Found ${rules?.length || 0} active post-booking rules`);

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active post-booking rules', emailsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalEmailsSent = 0;
    const errors: any[] = [];
    const today = new Date();

    // Process each rule
    for (const rule of rules) {
      console.log(`Processing rule: ${rule.rule_name} (${rule.days_before_tour} days after booking)`);

      // Build the status filter - use rule's status_filter if set, otherwise use defaults
      const statusFilter = rule.status_filter && rule.status_filter.length > 0 
        ? rule.status_filter 
        : ALLOWED_STATUSES;

      // Find bookings that:
      // 1. Were created X days ago (matching the rule's days_before_tour which represents days AFTER booking)
      // 2. Have an allowed status
      // 3. Have not already received this email
      const daysAgo = new Date(today);
      daysAgo.setDate(daysAgo.getDate() - rule.days_before_tour);
      const targetDateStart = new Date(daysAgo);
      targetDateStart.setHours(0, 0, 0, 0);
      const targetDateEnd = new Date(daysAgo);
      targetDateEnd.setHours(23, 59, 59, 999);

      console.log(`Looking for bookings created between ${targetDateStart.toISOString()} and ${targetDateEnd.toISOString()}`);

      // Get eligible bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          created_at,
          passenger_count,
          tour:tours(id, name, start_date),
          lead_passenger:customers!bookings_lead_passenger_id_fkey(id, first_name, last_name, email)
        `)
        .gte('created_at', targetDateStart.toISOString())
        .lte('created_at', targetDateEnd.toISOString())
        .in('status', statusFilter);

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        errors.push({ rule: rule.rule_name, error: bookingsError });
        continue;
      }

      console.log(`Found ${bookings?.length || 0} bookings created on target date with valid status`);

      if (!bookings || bookings.length === 0) {
        continue;
      }

      // Filter out bookings that have already received this email
      const bookingIds = bookings.map(b => b.id);
      const { data: alreadySent } = await supabase
        .from('post_booking_email_log')
        .select('booking_id')
        .eq('rule_id', rule.id)
        .in('booking_id', bookingIds);

      const alreadySentIds = new Set(alreadySent?.map(s => s.booking_id) || []);
      const eligibleBookings = bookings.filter(b => 
        !alreadySentIds.has(b.id) && 
        b.lead_passenger?.email
      );

      console.log(`${eligibleBookings.length} bookings eligible after filtering already-sent`);

      // Rate limiting delay helper
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Process each eligible booking
      for (let i = 0; i < eligibleBookings.length; i++) {
        const booking = eligibleBookings[i];
        
        try {
          console.log(`[${i + 1}/${eligibleBookings.length}] Sending post-booking email for booking ${booking.id} to ${booking.lead_passenger?.email}`);

          // Check for tour-specific template override
          let emailTemplate = rule.email_templates;
          if (booking.tour?.id) {
            const { data: override } = await supabase
              .from('tour_email_rule_overrides')
              .select('email_template_id')
              .eq('tour_id', booking.tour.id)
              .eq('rule_id', rule.id)
              .maybeSingle();

            if (override?.email_template_id) {
              console.log(`Using tour-specific template override for booking ${booking.id}`);
              const { data: overrideTemplate } = await supabase
                .from('email_templates')
                .select('*')
                .eq('id', override.email_template_id)
                .single();
              if (overrideTemplate) {
                emailTemplate = overrideTemplate;
              }
            }
          }

          // Delegate to send-booking-confirmation with RAW templates
          // This ensures all merge fields, conditionals, and action buttons
          // are properly resolved by the central template processor.
          const { data: emailResult, error: emailError } = await supabase.functions.invoke(
            'send-booking-confirmation',
            {
              body: {
                bookingId: booking.id,
                customSubject: emailTemplate?.subject_template,
                customContent: emailTemplate?.content_template,
                fromEmail: emailTemplate?.from_email,
                isAutomated: true,
                includeAdditionalPassengers: true
              }
            }
          );

          if (emailError) {
            console.error(`Error sending email for booking ${booking.id}:`, emailError);
            errors.push({ booking: booking.id, error: emailError });
          } else {
            console.log(`✓ Post-booking email sent for booking ${booking.id}`);

            // Log the sent email
            await supabase
              .from('post_booking_email_log')
              .insert({
                booking_id: booking.id,
                rule_id: rule.id,
                email_log_id: emailResult?.emailLogId || null
              });

            totalEmailsSent++;
          }
        } catch (sendError) {
          console.error(`Exception sending email for booking ${booking.id}:`, sendError);
          errors.push({ booking: booking.id, error: sendError });
        }

        // Rate limiting: wait 600ms between emails
        if (i < eligibleBookings.length - 1) {
          await delay(600);
        }
      }
    }

    const result = {
      success: true,
      totalEmailsSent,
      rulesProcessed: rules.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    console.log('Post-booking email processing complete:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Fatal error in post-booking email processing:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
