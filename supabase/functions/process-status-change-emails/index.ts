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
    const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://art-tour-manager.lovable.app';

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
          passport_number,
          passport_country,
          passport_expiry_date,
          nationality,
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
          tour_type,
          travel_documents_required
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

        // Check for tour-specific template override
        if (item.tour_id && item.rule?.id) {
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

        // Check if this is a travel documents template
        const isTravelDocsTemplate = template.type === 'travel_documents_request';

        // Collect all passengers with email addresses
        const passengers = [];
        
        // Lead passenger
        if (booking.customers?.email) {
          passengers.push({
            customerId: booking.customers.id,
            email: booking.customers.email,
            firstName: booking.customers.preferred_name || booking.customers.first_name,
            lastName: booking.customers.last_name,
          });
        }

        // Passenger 2
        if (booking.passenger_2?.email) {
          passengers.push({
            customerId: booking.passenger_2.id,
            email: booking.passenger_2.email,
            firstName: booking.passenger_2.preferred_name || booking.passenger_2.first_name,
            lastName: booking.passenger_2.last_name,
          });
        }

        // Passenger 3
        if (booking.passenger_3?.email) {
          passengers.push({
            customerId: booking.passenger_3.id,
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
          let subject = template.subject_template;
          let content = template.content_template;

          // Build replacements
          const replacements: Record<string, string> = {
            '{{customer_first_name}}': passenger.firstName,
            '{{customer_last_name}}': passenger.lastName,
            '{{customer_name}}': `${passenger.firstName} ${passenger.lastName}`,
            '{{tour_name}}': tour.name,
            '{{tour_start_date}}': formatDate(tour.start_date),
            '{{tour_end_date}}': formatDate(tour.end_date),
            '{{tour_location}}': tour.location || '',
            '{{booking_status}}': item.new_status,
            '{{previous_status}}': item.previous_status || 'new',
            '{{passenger_count}}': String(booking.passenger_count),
          };

          // Handle travel documents template specially
          if (isTravelDocsTemplate) {
            // Create access token for travel docs
            const { data: tokenData, error: tokenError } = await supabase
              .from('customer_access_tokens')
              .insert({
                customer_id: passenger.customerId,
                booking_id: booking.id,
                purpose: 'travel_documents',
                created_by: '00000000-0000-0000-0000-000000000000', // System user
              })
              .select()
              .single();

            if (tokenError) {
              console.error(`Token creation error for ${passenger.email}:`, tokenError);
              errorCount++;
              continue;
            }

            const updateLink = `${baseUrl}/update-travel-docs/${tokenData.token}`;
            const travelDocsButton = `<div style="text-align: center; margin: 30px 0;"><a href="${updateLink}" style="display: inline-block; background: #232628; color: #F5C518; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">UPDATE PASSPORT DETAILS</a></div>`;

            // Add travel docs specific replacements
            replacements['{{travel_docs_button}}'] = travelDocsButton;
            replacements['{{travel_docs_link}}'] = updateLink;
            replacements['{{passport_number}}'] = booking.passport_number || '';
            replacements['{{passport_country}}'] = booking.passport_country || '';
            replacements['{{passport_expiry_date}}'] = booking.passport_expiry_date ? formatDate(booking.passport_expiry_date) : '';
            replacements['{{nationality}}'] = booking.nationality || '';

            // Handle conditional sections for passport details
            const hasPassport = booking.passport_number || booking.passport_country || booking.passport_expiry_date || booking.nationality;
            
            if (hasPassport) {
              // Remove the "no passport" section and keep the "has passport" section
              content = content
                .replace(/\{\{\^has_passport_details\}\}[\s\S]*?\{\{\/has_passport_details\}\}/g, '')
                .replace(/\{\{#has_passport_details\}\}/g, '')
                .replace(/\{\{\/has_passport_details\}\}/g, '');
              
              // Handle inner conditionals
              content = content
                .replace(/\{\{#passport_number\}\}([\s\S]*?)\{\{\/passport_number\}\}/g, booking.passport_number ? '$1' : '')
                .replace(/\{\{#passport_country\}\}([\s\S]*?)\{\{\/passport_country\}\}/g, booking.passport_country ? '$1' : '')
                .replace(/\{\{#passport_expiry_date\}\}([\s\S]*?)\{\{\/passport_expiry_date\}\}/g, booking.passport_expiry_date ? '$1' : '')
                .replace(/\{\{#nationality\}\}([\s\S]*?)\{\{\/nationality\}\}/g, booking.nationality ? '$1' : '');
            } else {
              // Remove the "has passport" section and keep the "no passport" section
              content = content
                .replace(/\{\{#has_passport_details\}\}[\s\S]*?\{\{\/has_passport_details\}\}/g, '')
                .replace(/\{\{\^has_passport_details\}\}/g, '')
                .replace(/\{\{\/has_passport_details\}\}/g, '');
            }
          }

          // Apply all replacements
          for (const [key, value] of Object.entries(replacements)) {
            subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
            content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
          }

          // Build full email HTML with wrapper
          const fullEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <img src="https://art-tour-manager.lovable.app/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" alt="Australian Racing Tours" style="height: 50px; max-width: 200px; width: auto; margin-bottom: 10px;" />
              </div>
              <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                ${content}
              </div>
            </body>
            </html>
          `;

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
              html: fullEmailHtml,
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
