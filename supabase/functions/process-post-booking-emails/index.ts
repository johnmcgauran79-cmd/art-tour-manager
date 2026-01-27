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

          // Generate a profile update token for this customer
          const profileToken = crypto.randomUUID();
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 168); // 7 days

          // Get the admin user ID for token creation
          const { data: adminUser } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .limit(1)
            .single();

          if (adminUser && booking.lead_passenger?.id) {
            // Create the profile update token
            await supabase
              .from('customer_access_tokens')
              .insert({
                customer_id: booking.lead_passenger.id,
                token: profileToken,
                expires_at: expiresAt.toISOString(),
                created_by: adminUser.user_id
              });
          }

          // Build profile update URL
          const baseUrl = Deno.env.get('SITE_URL') || 'https://art-tour-manager.lovable.app';
          const profileUpdateUrl = `${baseUrl}/update-profile/${profileToken}`;

          // Prepare email content with profile update link
          let emailContent = rule.email_templates?.content_template || '';
          let emailSubject = rule.email_templates?.subject_template || 'Your Booking Confirmation';

          // Replace placeholders
          const customerName = `${booking.lead_passenger?.first_name || ''} ${booking.lead_passenger?.last_name || ''}`.trim() || 'Valued Customer';
          const tourName = booking.tour?.name || 'Your Tour';
          const tourStartDate = booking.tour?.start_date 
            ? new Date(booking.tour.start_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })
            : '';

          emailContent = emailContent
            .replace(/\{\{customer\.first_name\}\}/g, booking.lead_passenger?.first_name || '')
            .replace(/\{\{customer\.last_name\}\}/g, booking.lead_passenger?.last_name || '')
            .replace(/\{\{customer\.name\}\}/g, customerName)
            .replace(/\{\{tour\.name\}\}/g, tourName)
            .replace(/\{\{tour\.start_date\}\}/g, tourStartDate)
            .replace(/\{\{booking\.passenger_count\}\}/g, String(booking.passenger_count || 1))
            .replace(/\{\{profile_update_url\}\}/g, profileUpdateUrl)
            .replace(/\{\{profile_update_link\}\}/g, `<a href="${profileUpdateUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Update Your Profile</a>`);

          emailSubject = emailSubject
            .replace(/\{\{customer\.first_name\}\}/g, booking.lead_passenger?.first_name || '')
            .replace(/\{\{tour\.name\}\}/g, tourName);

          // Send the email via send-booking-confirmation with custom content
          const { data: emailResult, error: emailError } = await supabase.functions.invoke(
            'send-booking-confirmation',
            {
              body: {
                bookingId: booking.id,
                customSubject: emailSubject,
                customContent: emailContent,
                fromEmail: rule.email_templates?.from_email,
                isAutomated: true
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
