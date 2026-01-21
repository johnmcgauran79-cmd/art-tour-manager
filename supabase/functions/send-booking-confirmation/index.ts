import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookingConfirmationRequest {
  bookingId: string;
  customSubject?: string;
  customContent?: string;
  fromEmail?: string;
  ccEmails?: string[];
  bccEmails?: string[];
}

// Some rich text editors can inject zero-width characters into text nodes.
// If these land inside merge fields (e.g. "{{profile_update_button\u200b}}"),
// our placeholder detection + replacement will silently fail.
const stripZeroWidth = (value: string) => value.replace(/[\u200B-\u200D\uFEFF]/g, "");

// If client-side editors pre-render templates, placeholders like {{profile_update_link}}
// can be replaced with an empty string, leaving <a href="">update your profile</a>.
// This helper patches such links at send-time, so we still deliver a working URL.
const injectProfileUpdateLink = (html: string, link: string): string => {
  return html.replace(
    /<a\b([^>]*?)href=(['"])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, preAttrs, quote, href, postAttrs, inner) => {
      const innerText = String(inner)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const isUpdateProfileLink = innerText.includes("update your profile");
      const isHrefEmpty = String(href).trim() === "" || String(href).trim() === "#";

      if (isUpdateProfileLink && isHrefEmpty) {
        return `<a${preAttrs}href=${quote}${link}${quote}${postAttrs}>${inner}</a>`;
      }

      return full;
    }
  );
};

// If the template copy references profile updates but the {{profile_update_button}} token
// was stripped during client-side processing, we inject a button near the copy.
const injectProfileUpdateButtonNearCopy = (html: string, buttonHtml: string): string => {
  return html.replace(
    /(<p\b[^>]*>[\s\S]*?update\s+your\s+profile[\s\S]*?<\/p>)/i,
    `$1${buttonHtml}`
  );
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // For auditing/profile-update token creation we want a UUID in created_by.
    // When called from the web app we can attribute it to the current user.
    // When called from automated jobs (no auth header), we fall back to a valid UUID.
    const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
    let requestUserId: string | null = null;

    if (bearerToken) {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(bearerToken);
      if (userError) {
        console.warn('[ProfileUpdate] Unable to resolve request user from JWT:', userError.message);
      } else {
        requestUserId = userData.user?.id ?? null;
      }
    }

    const { bookingId, customSubject, customContent, fromEmail, ccEmails, bccEmails }: BookingConfirmationRequest = await req.json();

    // Fetch email template for booking confirmation
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('type', 'booking_confirmation')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    if (templateError) {
      console.error('Error fetching email template:', templateError);
    }

    // Fetch booking details with all related information
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        tours:tour_id (name, start_date, end_date, days, nights, location, pickup_point, inclusions, exclusions),
        customers:lead_passenger_id (id, first_name, last_name, email, phone, city, state, country),
        secondary_contact:customers!secondary_contact_id (first_name, last_name, email, phone),
        hotel_bookings (
          check_in_date,
          check_out_date,
          nights,
          room_type,
          room_upgrade,
          bedding,
          hotels (name, contact_name, contact_phone, contact_email)
        ),
        activity_bookings (
          passengers_attending,
          activities (
            name, activity_date, activity_status, start_time, end_time, location,
            pickup_time, pickup_location, collection_time, collection_location, dropoff_location,
            depart_for_activity, transport_mode, driver_name, driver_phone,
            transport_company, transport_contact_name, transport_phone, transport_email,
            contact_name, contact_phone, contact_email, hospitality_inclusions, notes,
            spots_available, spots_booked
          )
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!booking.customers?.email) {
      return new Response(
        JSON.stringify({ error: 'No email address found for this booking' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Helper function to format dates
    const formatDate = (dateString?: string): string => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Helper function to get nested value from object
    const getNestedValue = (obj: any, path: string): any => {
      return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
      }, obj);
    };

    // Helper function to process template (simplified version of EmailTemplateEngine)
    // IMPORTANT: Process in correct order - conditionals/loops FIRST, then simple variables
    const processTemplate = (templateStr: string, data: any): string => {
      // Normalize to avoid invisible zero-width chars breaking merge fields.
      let processed = stripZeroWidth(templateStr);
      
      // STEP 1: Handle conditional sections {{#variable}}...{{/variable}} FIRST
      // This ensures array loops are processed before simple variable replacement
      processed = processed.replace(/\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
        const value = getNestedValue(data, stripZeroWidth(String(key)).trim());
        
        // For arrays (like hotel_bookings), repeat the content for each item
        if (Array.isArray(value)) {
          if (value.length === 0) {
            return ''; // Empty array - don't show section
          }
          return value.map(item => {
            // Process inner variables with the array item's data
            return content.replace(/\{\{([^#\/\^}][^}]*)\}\}/g, (innerMatch: string, innerKey: string) => {
              const trimmedKey = stripZeroWidth(innerKey).trim();
              // First try to get value from the array item
              let itemValue = getNestedValue(item, trimmedKey);
              // If not found in item, try from root data (for mixed templates)
              if (itemValue === undefined) {
                itemValue = getNestedValue(data, trimmedKey);
              }
              return itemValue !== undefined && itemValue !== null ? String(itemValue) : '';
            });
          }).join('');
        }
        
        // For boolean/truthy values, include the content if truthy
        if (value) {
          // Process inner variables with root data
          return content.replace(/\{\{([^#\/\^}][^}]*)\}\}/g, (innerMatch: string, innerKey: string) => {
            const innerValue = getNestedValue(data, stripZeroWidth(innerKey).trim());
            return innerValue !== undefined && innerValue !== null ? String(innerValue) : '';
          });
        }
        return '';
      });
      
      // STEP 2: Handle inverted conditional sections {{^variable}}...{{/variable}}
      processed = processed.replace(/\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
        const value = getNestedValue(data, stripZeroWidth(String(key)).trim());
        const isEmpty = !value || (Array.isArray(value) && value.length === 0);
        if (isEmpty) {
          // Process inner variables
          return content.replace(/\{\{([^#\/\^}][^}]*)\}\}/g, (innerMatch: string, innerKey: string) => {
            const innerValue = getNestedValue(data, stripZeroWidth(innerKey).trim());
            return innerValue !== undefined && innerValue !== null ? String(innerValue) : '';
          });
        }
        return '';
      });
      
      // STEP 3: Handle remaining simple variable replacements {{variable}}
      processed = processed.replace(/\{\{([^#\/\^}][^}]*)\}\}/g, (match, key) => {
        const value = getNestedValue(data, stripZeroWidth(String(key)).trim());
        return value !== undefined && value !== null ? String(value) : '';
      });
      
      return processed;
    };

    // Check if profile update link/button is needed in the template.
    // NOTE: Be tolerant to whitespace added by editors (e.g. "{{ profile_update_button }}").
    const contentToCheck = customContent || template?.content_template || '';
    const normalizedContentToCheck = stripZeroWidth(contentToCheck);
    // IMPORTANT: Some client-side flows pre-render templates using EmailTemplateEngine.
    // That engine cannot generate secure profile update tokens, so it may replace these
    // placeholders with empty strings before the email hits this function.
    // We therefore also detect the user-facing copy as a fallback.
    const hasProfileUpdatePlaceholder = /\{\{\s*profile_update_(link|button)\s*\}\}/.test(normalizedContentToCheck);
    const hasProfileUpdateCopy = /update\s+your\s+profile/i.test(normalizedContentToCheck);
    const hasEmptyUpdateProfileAnchor = /<a[^>]*href=(['"])\s*\1[^>]*>[\s\S]*update\s+your\s+profile/i.test(normalizedContentToCheck);
    const needsProfileUpdateLink = hasProfileUpdatePlaceholder || hasProfileUpdateCopy || hasEmptyUpdateProfileAnchor;
    
    console.log('Profile update check - customContent length:', customContent?.length || 0);
    console.log('Profile update check - has "profile_update" substring:', normalizedContentToCheck.includes('profile_update'));
    console.log('Profile update check - hasProfileUpdatePlaceholder:', hasProfileUpdatePlaceholder);
    console.log('Profile update check - hasProfileUpdateCopy:', hasProfileUpdateCopy);
    console.log('Profile update check - hasEmptyUpdateProfileAnchor:', hasEmptyUpdateProfileAnchor);
    console.log('Profile update check - needsProfileUpdateLink:', needsProfileUpdateLink);
    console.log('Profile update check - customer id:', booking.customers?.id);
    
    let profileUpdateLink = '';
    let profileUpdateButton = '';
    
    if (needsProfileUpdateLink && booking.customers?.id) {
      // Generate a profile update token
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
      
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('customer_access_tokens')
        .insert({
          customer_id: booking.customers.id,
          // IMPORTANT: This column is UUID in the DB; using "system" causes token creation to fail,
          // which means no link/button can be generated.
          created_by: requestUserId || SYSTEM_ACTOR_ID,
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();
      
      if (tokenError) {
        console.error('Error creating profile update token:', tokenError);
      } else if (tokenData) {
        const baseUrl = Deno.env.get('SITE_URL') || 'https://art-tour-manager.lovable.app';
        profileUpdateLink = `${baseUrl}/update-profile?token=${tokenData.token}`;
        // IMPORTANT: Keep this HTML on a single line.
        // Later in the pipeline we convert any remaining "\n" to "<br>", which can break table markup.
        profileUpdateButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;"><tr><td><a href="${profileUpdateLink}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">Update My Profile</a></td></tr></table>`;
        console.log('Generated profile update link for customer:', booking.customers.id);
      }
    }

    // Process email template if available
    let emailSubject = `Booking Confirmation - ${booking.tours?.name || 'Your Tour'}`;
    let emailHtml = '';

    if (template) {
      console.log('=== TEMPLATE PROCESSING DEBUG ===');
      console.log('Custom subject provided:', !!customSubject);
      console.log('Custom content provided:', !!customContent);
      console.log('Hotel bookings count:', booking.hotel_bookings?.length || 0);
      console.log('Profile update link generated:', !!profileUpdateLink);
      
      if (booking.hotel_bookings && booking.hotel_bookings.length > 0) {
        console.log('First hotel booking:', JSON.stringify({
          hotel_name: booking.hotel_bookings[0].hotels?.name,
          check_in: booking.hotel_bookings[0].check_in_date,
          check_out: booking.hotel_bookings[0].check_out_date
        }));
      }
      
      // Create comprehensive merge data object with nested structures
      const mergeData = {
        // Customer fields
        customer_first_name: booking.customers?.first_name || '',
        customer_last_name: booking.customers?.last_name || '',
        customer_email: booking.customers?.email || '',
        customer_phone: booking.customers?.phone || '',
        customer_city: booking.customers?.city || '',
        customer_state: booking.customers?.state || '',
        customer_country: booking.customers?.country || '',
        customer_spouse_name: booking.customers?.spouse_name || '',
        customer_dietary_requirements: booking.customers?.dietary_requirements || '',
        customer_notes: booking.customers?.notes || '',
        
        // Tour fields
        tour_name: booking.tours?.name || '',
        tour_location: booking.tours?.location || '',
        tour_start_date: formatDate(booking.tours?.start_date),
        tour_end_date: formatDate(booking.tours?.end_date),
        tour_days: booking.tours?.days || '',
        tour_nights: booking.tours?.nights || '',
        tour_pickup_point: booking.tours?.pickup_point || '',
        tour_notes: booking.tours?.notes || '',
        tour_inclusions: booking.tours?.inclusions || '',
        tour_exclusions: booking.tours?.exclusions || '',
        
        // Booking fields
        booking_passenger_count: booking.passenger_count || 1,
        booking_status: booking.status || '',
        booking_check_in_date: formatDate(booking.check_in_date),
        booking_check_out_date: formatDate(booking.check_out_date),
        booking_total_nights: booking.total_nights || '',
        booking_passenger_2_name: booking.passenger_2_name || '',
        booking_passenger_3_name: booking.passenger_3_name || '',
        booking_group_name: booking.group_name || '',
        booking_extra_requests: booking.extra_requests || '',
        booking_passport_number: booking.passport_number || '',
        // Medical info from customer record
        booking_dietary_restrictions: booking.customers?.dietary_requirements || '',
        booking_medical_conditions: booking.customers?.medical_conditions || '',
        booking_emergency_contact_name: booking.customers?.emergency_contact_name || '',
        booking_emergency_contact_phone: booking.customers?.emergency_contact_phone || '',
        
        // Profile update action fields
        profile_update_link: profileUpdateLink,
        profile_update_button: profileUpdateButton,
        
        // Hotel bookings array
        hotel_bookings: (booking.hotel_bookings || []).map((hb: any) => ({
          hotel_name: hb.hotels?.name || '',
          hotel_address: hb.hotels?.address || '',
          hotel_contact_name: hb.hotels?.contact_name || '',
          hotel_contact_phone: hb.hotels?.contact_phone || '',
          hotel_contact_email: hb.hotels?.contact_email || '',
          hotel_check_in_date: formatDate(hb.check_in_date),
          hotel_check_out_date: formatDate(hb.check_out_date),
          hotel_nights: hb.nights || '',
          hotel_room_type: hb.room_type || '',
          hotel_bedding: hb.bedding || '',
          hotel_room_upgrade: hb.room_upgrade || '',
          hotel_room_requests: hb.room_requests || '',
          hotel_confirmation_number: hb.confirmation_number || '',
        })),
        
        // Activity bookings array
        activity_bookings: (booking.activity_bookings || []).map((ab: any) => ({
          activity_name: ab.activities?.name || '',
          activity_date: formatDate(ab.activities?.activity_date),
          activity_status: ab.activities?.activity_status || '',
          activity_start_time: ab.activities?.start_time || '',
          activity_end_time: ab.activities?.end_time || '',
          activity_location: ab.activities?.location || '',
          activity_pickup_time: ab.activities?.pickup_time || '',
          activity_pickup_location: ab.activities?.pickup_location || '',
          activity_collection_time: ab.activities?.collection_time || '',
          activity_collection_location: ab.activities?.collection_location || '',
          activity_dropoff_location: ab.activities?.dropoff_location || '',
          activity_depart_for_activity: ab.activities?.depart_for_activity || '',
          activity_transport_mode: ab.activities?.transport_mode || '',
          activity_driver_name: ab.activities?.driver_name || '',
          activity_driver_phone: ab.activities?.driver_phone || '',
          activity_transport_company: ab.activities?.transport_company || '',
          activity_transport_contact_name: ab.activities?.transport_contact_name || '',
          activity_transport_phone: ab.activities?.transport_phone || '',
          activity_transport_email: ab.activities?.transport_email || '',
          activity_contact_name: ab.activities?.contact_name || '',
          activity_contact_phone: ab.activities?.contact_phone || '',
          activity_contact_email: ab.activities?.contact_email || '',
          activity_hospitality_inclusions: ab.activities?.hospitality_inclusions || '',
          activity_notes: ab.activities?.notes || '',
          activity_spots_available: ab.activities?.spots_available || '',
          activity_spots_booked: ab.activities?.spots_booked || '',
          passengers_attending: ab.passengers_attending || '',
        })),
      };
      
      console.log('Merge data hotel_bookings:', mergeData.hotel_bookings?.length || 0);
      if (mergeData.hotel_bookings && mergeData.hotel_bookings.length > 0) {
        console.log('First merge hotel:', JSON.stringify(mergeData.hotel_bookings[0]));
      }

      // Process subject template (use custom if provided, otherwise use default template)
      // Always process the template to replace merge fields
      const subjectToProcess = customSubject || template.subject_template;
      emailSubject = processTemplate(subjectToProcess, mergeData);
      console.log('Processed subject template');

      // Process content template (use custom if provided, otherwise use default template)
      // Always process the template to replace merge fields
      const contentToProcess = customContent || template.content_template;
      emailHtml = processTemplate(contentToProcess, mergeData);
      console.log('Processed content template');

      // Convert line breaks to HTML breaks
      emailHtml = emailHtml.replace(/\n/g, '<br>');

      // Final safety pass: if the client-side render stripped the placeholder out of href,
      // patch the update-profile anchor/button into a working state.
      if (profileUpdateLink) {
        const beforeInject = emailHtml;
        emailHtml = injectProfileUpdateLink(emailHtml, profileUpdateLink);

        const didInjectLink = beforeInject !== emailHtml;
        const hasButtonAlready = emailHtml.includes('Update My Profile') || emailHtml.includes(profileUpdateLink);

        if (!didInjectLink && !hasButtonAlready && /update\s+your\s+profile/i.test(emailHtml) && profileUpdateButton) {
          emailHtml = injectProfileUpdateButtonNearCopy(emailHtml, profileUpdateButton);
        }
      }
    } else {
      // Fallback to simple HTML if no template found
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Booking Confirmation</h1>
          <p>Dear ${booking.customers?.first_name} ${booking.customers?.last_name},</p>
          <p>Thank you for your booking confirmation for <strong>${booking.tours?.name || 'your tour'}</strong>.</p>
          <p>We will be in touch with more details soon.</p>
          <p>Best regards,<br>The Team</p>
        </div>
      `;
    }

    // Send email - use provided fromEmail, fallback to template from_email, then default
    const finalFromEmail = fromEmail || template?.from_email || "bookings@australianracingtours.com.au";
    
    // Prepare recipients - merge provided CC emails with secondary contact if they exist
    const ccRecipients = [...(ccEmails || [])];
    if (booking.secondary_contact?.email && !ccRecipients.includes(booking.secondary_contact.email)) {
      ccRecipients.push(booking.secondary_contact.email);
    }
    
    // Prepare BCC recipients
    const bccRecipients = bccEmails || [];
    
    const emailResponse = await resend.emails.send({
      from: `Bookings <${finalFromEmail}>`,
      to: [booking.customers.email],
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Booking confirmation email sent successfully:", emailResponse);

    // Check if Resend returned an error
    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          error: `Email sending failed: ${emailResponse.error.message || emailResponse.error}` 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Log email to database for tracking
    if (emailResponse.data?.id) {
      const { error: logError } = await supabaseClient
        .from('email_logs')
        .insert({
          message_id: emailResponse.data.id,
          booking_id: bookingId,
          tour_id: booking.tour_id,
          recipient_email: booking.customers.email,
          recipient_name: `${booking.customers.first_name} ${booking.customers.last_name}`,
          subject: emailSubject,
          template_name: template?.name || 'Custom',
        });

      if (logError) {
        console.error('Error logging email:', logError);
        // Don't fail the request if logging fails
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      sentTo: booking.customers.email,
      ccTo: ccRecipients.length > 0 ? ccRecipients : undefined
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-booking-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);