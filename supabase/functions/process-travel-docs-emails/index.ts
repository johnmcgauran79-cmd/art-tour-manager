import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

    // Fetch configurable settings
    const { data: gSettings } = await supabase
      .from('general_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['email_header_image_url', 'default_sender_name', 'default_from_email_client', 'token_expiry_hours']);
    
    const getS = (key: string, fb: string) => {
      const row = (gSettings || []).find((r: any) => r.setting_key === key);
      if (!row) return fb;
      const val = row.setting_value;
      return typeof val === 'string' ? val : String(val);
    };
    
    const emailHeaderImageUrl = getS('email_header_image_url', 'https://art-tour-manager.lovable.app/images/email-header-default.png');
    const senderName = getS('default_sender_name', 'Australian Racing Tours');
    const fromEmailAddr = getS('default_from_email_client', 'bookings@australianracingtours.com.au');
    const tokenExpiryHours = Number(getS('token_expiry_hours', '168')) || 168;

    // Check if called with specific batch params (from process-automated-emails)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, run full scan
    }

    const { tourId, ruleId, batchId } = body;

    // Helper function for rate limiting delay
    const delay = (ms: number): Promise<void> => new Promise<void>(resolve => setTimeout(() => resolve(), ms));

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

    // This function is invoked with specific batch params from process-automated-emails
    if (!tourId || !ruleId || !batchId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required params: tourId, ruleId, batchId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing travel docs batch: tour=${tourId}, batch=${batchId}`);

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
      emailsSent = await processTravelDocsBatch(
        supabase, resend, tour, rule, batchId, errors, delay, formatDate,
        emailHeaderImageUrl, senderName, fromEmailAddr
      );
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent, errors: errors.length > 0 ? errors : undefined }),
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
  formatDate: (dateStr: string) => string,
  emailHeaderImageUrl: string,
  senderName: string,
  fromEmailAddr: string
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

      // Build the travel docs button HTML
      const travelDocsButton = `<div style="text-align: center; margin: 30px 0;"><a href="${updateLink}" style="display: inline-block; background: #232628; color: #F5C518; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">UPDATE PASSPORT DETAILS</a></div>`;

      // Process template content if we have one
      let emailSubject = `Passport Details Required - ${tour.name}`;
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
          <p>Please click the button below to provide or update your passport details:</p>
          ${travelDocsButton}
          <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1565c0;">
              <strong>Note:</strong> This link will expire in 7 days. Your passport details are securely stored and will be automatically deleted 30 days after your tour ends.
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
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; width: 100%; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <img src="${emailHeaderImageUrl}" alt="Australian Racing Tours" style="height: 80px; max-width: 400px; width: auto;" />
            <h1 style="color: #fff; margin: 0; font-size: 24px;">Passport Details Required</h1>
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
        from: template?.from_email || `${senderName} <${fromEmailAddr}>`,
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
          subject: `Passport Details Required - ${tour.name}`,
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
