import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const resend = new Resend(resendApiKey);

    // Check if called with specific batch params (from process-automated-emails)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, run full scan
    }

    const { tourId, ruleId, batchId } = body;

    // Helper function for rate limiting delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Format date helper
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-AU', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    };

    const errors: any[] = [];
    let emailsSent = 0;

    // If called with specific params, process that batch only
    if (tourId && ruleId && batchId) {
      console.log(`Processing specific travel docs batch: tour=${tourId}, batch=${batchId}`);
      
      const { data: tour } = await supabase
        .from('tours')
        .select('id, name, start_date, end_date')
        .eq('id', tourId)
        .single();

      const { data: rule } = await supabase
        .from('automated_email_rules')
        .select('*')
        .eq('id', ruleId)
        .single();

      if (tour && rule) {
        emailsSent = await processTravelDocsBatch(supabase, resend, tour, rule, batchId, errors, delay, formatDate);
      }

      return new Response(
        JSON.stringify({ success: true, emailsSent, errors: errors.length > 0 ? errors : undefined }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Otherwise, this is a standalone call - run full processing
    console.log('Running full travel docs email processing...');

    // Process each tour
    for (const tour of upcomingTours || []) {
      try {
        const tourStartDate = new Date(tour.start_date);
        const daysUntilTour = Math.floor((tourStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`Tour "${tour.name}" is ${daysUntilTour} days away`);

        // Find the most recent applicable rule
        let applicableRule = null;
        for (const rule of rules || []) {
          if (daysUntilTour <= rule.days_before_tour) {
            applicableRule = rule;
            break;
          }
        }

        if (!applicableRule) {
          console.log(`No applicable travel docs rule for tour "${tour.name}" (${daysUntilTour} days away)`);
          continue;
        }

        console.log(`Applicable rule for "${tour.name}": ${applicableRule.rule_name} (${applicableRule.days_before_tour} days)`);

        // Check if we already have a batch for this tour/rule
        const { data: existingBatch } = await supabase
          .from('automated_email_log')
          .select('id, approval_status, sent_at')
          .eq('tour_id', tour.id)
          .eq('rule_id', applicableRule.id)
          .is('booking_id', null)
          .maybeSingle();

        if (existingBatch) {
          console.log(`Batch already exists for tour "${tour.name}", status: ${existingBatch.approval_status}`);
          
          if (existingBatch.approval_status === 'sent') {
            console.log(`Travel docs emails already sent for tour "${tour.name}" - skipping`);
            continue;
          }
          
          if (existingBatch.approval_status === 'processing') {
            console.log(`Currently processing for tour "${tour.name}" - skipping`);
            continue;
          }
          
          if (existingBatch.approval_status === 'approved') {
            console.log(`Processing approved travel docs batch for tour "${tour.name}"`);
            
            // Mark as processing
            await supabase
              .from('automated_email_log')
              .update({ approval_status: 'processing' })
              .eq('id', existingBatch.id);
            
            // Process and send emails
            const sentCount = await processTravelDocsBatch(supabase, resend, tour, applicableRule, existingBatch.id, errors, delay, formatDate);
            totalEmailsSent += sentCount;
            continue;
          }
          
          if (existingBatch.approval_status === 'pending_approval') {
            console.log(`Travel docs batch pending approval for tour "${tour.name}" - skipping`);
            continue;
          }
          
          if (existingBatch.approval_status === 'rejected') {
            console.log(`Deleting rejected batch for tour "${tour.name}"`);
            await supabase
              .from('automated_email_log')
              .delete()
              .eq('id', existingBatch.id);
          }
        }

        // Get eligible bookings for this tour
        let bookingsQuery = supabase
          .from('bookings')
          .select(`
            id,
            lead_passenger_id,
            passport_number,
            customers!bookings_lead_passenger_id_fkey(id, first_name, last_name, email)
          `)
          .eq('tour_id', tour.id)
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted');

        // Apply recipient filter if specified
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

        // Filter bookings that have an email address
        const eligibleBookings = bookings?.filter(b => b.customers?.email) || [];
        const bookingCount = eligibleBookings.length;

        if (bookingCount === 0) {
          console.log(`No eligible bookings for tour "${tour.name}"`);
          continue;
        }

        console.log(`Creating travel docs batch for tour "${tour.name}" with ${bookingCount} bookings`);

        // Create batch record - requires approval
        const { error: logError } = await supabase
          .from('automated_email_log')
          .insert({
            tour_id: tour.id,
            booking_id: null,
            rule_id: applicableRule.id,
            tour_start_date: tour.start_date,
            days_before_send: applicableRule.days_before_tour,
            booking_count: bookingCount,
            approval_status: applicableRule.requires_approval ? 'pending_approval' : 'approved'
          });

        if (logError) {
          console.error('Error creating batch record:', logError);
          errors.push({ tour: tour.name, rule: applicableRule.rule_name, error: logError });
        } else {
          console.log(`Created travel docs batch for tour "${tour.name}", ${bookingCount} bookings`);
          totalBatchesCreated++;
        }

      } catch (tourError) {
        console.error(`Error processing tour ${tour.name}:`, tourError);
        errors.push({ tour: tour.name, error: tourError });
      }
    }

    const result = {
      success: true,
      totalBatchesCreated,
      totalEmailsSent,
      rulesProcessed: rules?.length || 0,
      toursChecked: upcomingTours?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    console.log('Travel docs email processing complete:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Fatal error in travel docs email processing:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Process approved batch and send travel docs request emails
async function processTravelDocsBatch(
  supabase: any,
  resend: any,
  tour: any,
  rule: any,
  batchId: string,
  errors: any[],
  delay: (ms: number) => Promise<void>,
  formatDate: (dateStr: string) => string
): Promise<number> {
  let sentCount = 0;
  let failedCount = 0;

  console.log(`=== Processing travel docs batch for tour "${tour.name}" ===`);

  // Get the travel_documents_request template
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('type', 'travel_documents_request')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (templateError) {
    console.error('Error fetching email template:', templateError);
  }

  // Get all eligible bookings
  let bookingsQuery = supabase
    .from('bookings')
    .select(`
      id,
      lead_passenger_id,
      passport_number,
      passport_expiry_date,
      passport_country,
      nationality,
      id_number,
      customers!bookings_lead_passenger_id_fkey(id, first_name, last_name, email)
    `)
    .eq('tour_id', tour.id)
    .neq('status', 'cancelled')
    .neq('status', 'waitlisted');

  // Apply recipient filter
  if (rule.recipient_filter === 'with_accommodation') {
    bookingsQuery = bookingsQuery.eq('accommodation_required', true);
  } else if (rule.recipient_filter === 'without_accommodation') {
    bookingsQuery = bookingsQuery.eq('accommodation_required', false);
  }

  const { data: bookings, error: bookingsError } = await bookingsQuery;

  if (bookingsError) {
    console.error('Error fetching bookings:', bookingsError);
    errors.push({ tour: tour.name, error: bookingsError });
    
    await supabase
      .from('automated_email_log')
      .update({ approval_status: 'approved' })
      .eq('id', batchId);
    
    return 0;
  }

  const eligibleBookings = bookings?.filter((b: any) => b.customers?.email) || [];
  console.log(`Found ${eligibleBookings.length} eligible bookings`);

  if (eligibleBookings.length === 0) {
    await supabase
      .from('automated_email_log')
      .update({ 
        approval_status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', batchId);
    return 0;
  }

  const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://art-tour-manager.lovable.app';

  for (let i = 0; i < eligibleBookings.length; i++) {
    const booking = eligibleBookings[i];
    const customer = booking.customers;

    try {
      console.log(`[${i + 1}/${eligibleBookings.length}] Processing ${customer.email}...`);

      // Create access token for this booking
      const { data: tokenData, error: tokenError } = await supabase
        .from('customer_access_tokens')
        .insert({
          customer_id: customer.id,
          booking_id: booking.id,
          purpose: 'travel_documents',
          created_by: '00000000-0000-0000-0000-000000000000', // System user
        })
        .select()
        .single();

      if (tokenError) {
        console.error(`Token creation error for ${customer.email}:`, tokenError);
        errors.push({ booking: booking.id, email: customer.email, error: tokenError });
        failedCount++;
        continue;
      }

      const updateLink = `${baseUrl}/update-travel-docs/${tokenData.token}`;

      // Check existing passport details
      const existingDetails = [];
      if (booking.passport_number) existingDetails.push(`Passport Number: ${booking.passport_number}`);
      if (booking.passport_country) existingDetails.push(`Passport Country: ${booking.passport_country}`);
      if (booking.passport_expiry_date) existingDetails.push(`Expiry Date: ${formatDate(booking.passport_expiry_date)}`);
      if (booking.nationality) existingDetails.push(`Nationality: ${booking.nationality}`);
      if (booking.id_number) existingDetails.push(`ID Number: ${booking.id_number}`);

      // Build the travel docs button HTML
      const travelDocsButton = `<div style="text-align: center; margin: 30px 0;"><a href="${updateLink}" style="display: inline-block; background: #232628; color: #F5C518; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Submit Travel Documents</a></div>`;

      // Process template content if we have one
      let emailSubject = `Travel Documents Required - ${tour.name}`;
      let emailContent = '';

      if (template) {
        // Replace merge fields in subject
        emailSubject = template.subject_template
          .replace(/\{\{tour_name\}\}/g, tour.name);

        // Replace merge fields in content
        emailContent = template.content_template
          .replace(/\{\{customer_first_name\}\}/g, customer.first_name || '')
          .replace(/\{\{customer_last_name\}\}/g, customer.last_name || '')
          .replace(/\{\{tour_name\}\}/g, tour.name)
          .replace(/\{\{tour_start_date\}\}/g, formatDate(tour.start_date))
          .replace(/\{\{tour_end_date\}\}/g, formatDate(tour.end_date))
          .replace(/\{\{travel_docs_button\}\}/g, travelDocsButton)
          .replace(/\{\{travel_docs_link\}\}/g, updateLink)
          .replace(/\{\{passport_number\}\}/g, booking.passport_number || '')
          .replace(/\{\{passport_country\}\}/g, booking.passport_country || '')
          .replace(/\{\{passport_expiry_date\}\}/g, booking.passport_expiry_date ? formatDate(booking.passport_expiry_date) : '')
          .replace(/\{\{nationality\}\}/g, booking.nationality || '');

        // Handle conditional sections for has_passport_details
        const hasPassport = booking.passport_number || booking.passport_country || booking.passport_expiry_date || booking.nationality;
        
        if (hasPassport) {
          // Remove the "no passport" section and keep the "has passport" section
          emailContent = emailContent
            .replace(/\{\{\^has_passport_details\}\}[\s\S]*?\{\{\/has_passport_details\}\}/g, '')
            .replace(/\{\{#has_passport_details\}\}/g, '')
            .replace(/\{\{\/has_passport_details\}\}/g, '');
          
          // Also handle inner conditionals
          emailContent = emailContent
            .replace(/\{\{#passport_number\}\}([\s\S]*?)\{\{\/passport_number\}\}/g, booking.passport_number ? '$1' : '')
            .replace(/\{\{#passport_country\}\}([\s\S]*?)\{\{\/passport_country\}\}/g, booking.passport_country ? '$1' : '')
            .replace(/\{\{#passport_expiry_date\}\}([\s\S]*?)\{\{\/passport_expiry_date\}\}/g, booking.passport_expiry_date ? '$1' : '')
            .replace(/\{\{#nationality\}\}([\s\S]*?)\{\{\/nationality\}\}/g, booking.nationality ? '$1' : '');
        } else {
          // Remove the "has passport" section and keep the "no passport" section
          emailContent = emailContent
            .replace(/\{\{#has_passport_details\}\}[\s\S]*?\{\{\/has_passport_details\}\}/g, '')
            .replace(/\{\{\^has_passport_details\}\}/g, '')
            .replace(/\{\{\/has_passport_details\}\}/g, '');
        }
      } else {
        // Fallback to hardcoded template if no template exists
        emailContent = `
          <p>Dear ${customer.first_name},</p>
          <p>We require your passport details for your upcoming tour:</p>
          <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; color: #2e7d32;">${tour.name}</h3>
            <p style="margin: 0; font-size: 14px;">
              <strong>Tour Dates:</strong> ${formatDate(tour.start_date)} - ${formatDate(tour.end_date)}
            </p>
          </div>
          ${existingDetailsHtml}
          <p>Please click the button below to provide or update your travel document details:</p>
          ${travelDocsButton}
          <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1565c0;">
              <strong>Note:</strong> This link will expire in 72 hours. Your passport details are securely stored and will be automatically deleted 30 days after your tour ends.
            </p>
          </div>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Kind regards,<br><strong>Australian Racing Tours</strong></p>
        `;
      }

      // Build full email HTML
      const fullEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <img src="https://art-tour-manager.lovable.app/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" alt="Australian Racing Tours" style="height: 50px; margin-bottom: 10px;" />
            <h1 style="color: #fff; margin: 0; font-size: 24px;">Travel Documents Required</h1>
          </div>
          
          <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
            ${emailContent}
          </div>
          
          <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
            <p style="margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="margin: 5px 0; word-break: break-all;">${updateLink}</p>
          </div>
        </body>
        </html>
      `;

      // Send the email
      const emailResponse = await resend.emails.send({
        from: template?.from_email || 'Australian Racing Tours <info@australianracingtours.com.au>',
        to: [customer.email],
        subject: emailSubject,
        html: fullEmailHtml,
      });

      console.log(`✓ Email sent to ${customer.email}`);

      // Log the email send
      if (emailResponse.data?.id) {
        await supabase.from('email_logs').insert({
          message_id: emailResponse.data.id,
          recipient_email: customer.email,
          recipient_name: `${customer.first_name} ${customer.last_name}`,
          subject: `Travel Documents Required - ${tour.name}`,
          template_name: 'travel_documents_request',
          booking_id: booking.id,
          tour_id: tour.id,
        });
      }

      sentCount++;

    } catch (sendError) {
      console.error(`Exception sending email for ${customer.email}:`, sendError);
      errors.push({ booking: booking.id, email: customer.email, error: sendError });
      failedCount++;
    }

    // Rate limiting: 600ms between emails
    if (i < eligibleBookings.length - 1) {
      await delay(600);
    }
  }

  // Update batch status
  await supabase
    .from('automated_email_log')
    .update({ 
      approval_status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', batchId);

  console.log(`=== Travel docs batch complete: Sent ${sentCount}, Failed ${failedCount} ===`);
  
  return sentCount;
}
