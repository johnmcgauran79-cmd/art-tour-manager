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
  includeAdditionalPassengers?: boolean;
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

    const { bookingId, customSubject, customContent, fromEmail, ccEmails, bccEmails, includeAdditionalPassengers }: BookingConfirmationRequest = await req.json();
    
    // Default to true if not explicitly provided (backwards compatible)
    const shouldIncludeAdditionalPassengers = includeAdditionalPassengers !== false;

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

    // Fetch booking details with all related information including additional passengers
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        tours:tour_id (name, start_date, end_date, days, nights, location, pickup_point, inclusions, exclusions, tour_type, tour_host, capacity, minimum_passengers_required, price_single, price_double, price_twin, deposit_required, final_payment_date, instalment_date, instalment_amount, instalment_details, travel_documents_required, notes),
        customers:lead_passenger_id (id, first_name, last_name, preferred_name, email, phone, city, state, country, spouse_name, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, medical_conditions, accessibility_needs, notes),
        secondary_contact:customers!secondary_contact_id (first_name, last_name, email, phone),
        passenger_2:customers!passenger_2_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs),
        passenger_3:customers!passenger_3_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs),
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
        // Canonical format used across the app: /update-profile/:token
        // (we still support legacy query-param links in the router for old emails).
        profileUpdateLink = `${baseUrl}/update-profile/${tokenData.token}`;
        // IMPORTANT: Keep this HTML on a single line.
        // Later in the pipeline we convert any remaining "\n" to "<br>", which can break table markup.
        // data-art-profile-update marker helps us reliably detect whether the button is already present.
        profileUpdateButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-profile-update="button"><tr><td><a href="${profileUpdateLink}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">Update My Profile</a></td></tr></table>`;
        console.log('Generated profile update link for customer:', booking.customers.id);
      }
    }

    // Process email template if available
    let emailSubject = `Booking Confirmation - ${booking.tours?.name || 'Your Tour'}`;
    let emailHtml = '';
    
    // Create comprehensive merge data object with nested structures
    // Defined at handler scope so it's accessible to sendToPassenger
    let mergeData: Record<string, any> = {
      // Customer fields (will be overridden for additional passengers)
      customer_first_name: booking.customers?.first_name || '',
      customer_last_name: booking.customers?.last_name || '',
      customer_preferred_name: booking.customers?.preferred_name || '',
      customer_email: booking.customers?.email || '',
      customer_phone: booking.customers?.phone || '',
      customer_city: booking.customers?.city || '',
      customer_state: booking.customers?.state || '',
      customer_country: booking.customers?.country || '',
      customer_spouse_name: booking.customers?.spouse_name || '',
      customer_dietary_requirements: booking.customers?.dietary_requirements || '',
      customer_medical_conditions: booking.customers?.medical_conditions || '',
      customer_accessibility_needs: booking.customers?.accessibility_needs || '',
      customer_emergency_contact_name: booking.customers?.emergency_contact_name || '',
      customer_emergency_contact_phone: booking.customers?.emergency_contact_phone || '',
      customer_emergency_contact_relationship: booking.customers?.emergency_contact_relationship || '',
      customer_notes: booking.customers?.notes || '',

      // Nested objects (backwards-compatible with older templates using dot notation,
      // e.g. {{customer.preferred_name}} or {{tour.name}})
      customer: {
        first_name: booking.customers?.first_name || '',
        last_name: booking.customers?.last_name || '',
        preferred_name: booking.customers?.preferred_name || '',
        email: booking.customers?.email || '',
        phone: booking.customers?.phone || '',
        city: booking.customers?.city || '',
        state: booking.customers?.state || '',
        country: booking.customers?.country || '',
        spouse_name: booking.customers?.spouse_name || '',
        dietary_requirements: booking.customers?.dietary_requirements || '',
        medical_conditions: booking.customers?.medical_conditions || '',
        accessibility_needs: booking.customers?.accessibility_needs || '',
        emergency_contact_name: booking.customers?.emergency_contact_name || '',
        emergency_contact_phone: booking.customers?.emergency_contact_phone || '',
        emergency_contact_relationship: booking.customers?.emergency_contact_relationship || '',
        notes: booking.customers?.notes || '',
      },
      
      // Tour fields
      tour_name: booking.tours?.name || '',
      tour_location: booking.tours?.location || '',
      tour_type: booking.tours?.tour_type || '',
      tour_start_date: formatDate(booking.tours?.start_date),
      tour_end_date: formatDate(booking.tours?.end_date),
      tour_days: booking.tours?.days || '',
      tour_nights: booking.tours?.nights || '',
      tour_pickup_point: booking.tours?.pickup_point || '',
      tour_host: booking.tours?.tour_host || '',
      tour_capacity: booking.tours?.capacity || '',
      tour_minimum_passengers: booking.tours?.minimum_passengers_required || '',
      tour_price_single: booking.tours?.price_single || '',
      tour_price_double: booking.tours?.price_double || '',
      tour_price_twin: booking.tours?.price_twin || '',
      tour_deposit_required: booking.tours?.deposit_required || '',
      tour_final_payment_date: formatDate(booking.tours?.final_payment_date),
      tour_instalment_date: formatDate(booking.tours?.instalment_date),
      tour_instalment_amount: booking.tours?.instalment_amount || '',
      tour_instalment_details: booking.tours?.instalment_details || '',
      tour_notes: booking.tours?.notes || '',
      tour_inclusions: booking.tours?.inclusions || '',
      tour_exclusions: booking.tours?.exclusions || '',
      tour_travel_documents_required: booking.tours?.travel_documents_required ? 'Yes' : 'No',

      tour: {
        name: booking.tours?.name || '',
        location: booking.tours?.location || '',
        type: booking.tours?.tour_type || '',
        start_date: formatDate(booking.tours?.start_date),
        end_date: formatDate(booking.tours?.end_date),
        days: booking.tours?.days || '',
        nights: booking.tours?.nights || '',
        pickup_point: booking.tours?.pickup_point || '',
        host: booking.tours?.tour_host || '',
        capacity: booking.tours?.capacity || '',
        minimum_passengers: booking.tours?.minimum_passengers_required || '',
        price_single: booking.tours?.price_single || '',
        price_double: booking.tours?.price_double || '',
        price_twin: booking.tours?.price_twin || '',
        deposit_required: booking.tours?.deposit_required || '',
        final_payment_date: formatDate(booking.tours?.final_payment_date),
        instalment_date: formatDate(booking.tours?.instalment_date),
        instalment_amount: booking.tours?.instalment_amount || '',
        instalment_details: booking.tours?.instalment_details || '',
        notes: booking.tours?.notes || '',
        inclusions: booking.tours?.inclusions || '',
        exclusions: booking.tours?.exclusions || '',
        travel_documents_required: booking.tours?.travel_documents_required ? 'Yes' : 'No',
      },
      
      // Booking fields
      booking_id: booking.id || '',
      booking_status: booking.status || '',
      booking_passenger_count: booking.passenger_count || '',
      booking_group_name: booking.group_name || '',
      booking_accommodation_required: booking.accommodation_required ? 'Yes' : 'No',
      booking_extra_requests: booking.extra_requests || '',
      booking_check_in_date: formatDate(booking.check_in_date),
      booking_check_out_date: formatDate(booking.check_out_date),
      booking_total_nights: booking.total_nights || '',
      booking_revenue: booking.revenue || '',
      booking_invoice_notes: booking.invoice_notes || '',
      booking_whatsapp_group_comms: booking.whatsapp_group_comms ? 'Yes' : 'No',
      booking_created_at: formatDate(booking.created_at),
      booking_updated_at: formatDate(booking.updated_at),
      booking_passport_number: booking.passport_number || '',
      booking_passport_expiry_date: formatDate(booking.passport_expiry_date),
      booking_passport_country: booking.passport_country || '',
      booking_nationality: booking.nationality || '',

      booking: {
        id: booking.id || '',
        status: booking.status || '',
        passenger_count: booking.passenger_count || '',
        group_name: booking.group_name || '',
        accommodation_required: booking.accommodation_required ? 'Yes' : 'No',
        extra_requests: booking.extra_requests || '',
        check_in_date: formatDate(booking.check_in_date),
        check_out_date: formatDate(booking.check_out_date),
        total_nights: booking.total_nights || '',
        revenue: booking.revenue || '',
        invoice_notes: booking.invoice_notes || '',
        whatsapp_group_comms: booking.whatsapp_group_comms ? 'Yes' : 'No',
        created_at: formatDate(booking.created_at),
        updated_at: formatDate(booking.updated_at),
        passport_number: booking.passport_number || '',
        passport_expiry_date: formatDate(booking.passport_expiry_date),
        passport_country: booking.passport_country || '',
        nationality: booking.nationality || '',
      },
      
      // Profile update action fields
      profile_update_link: profileUpdateLink,
      profile_update_button: profileUpdateButton,

      // Alias used by some older templates/flows
      profile_update_url: profileUpdateLink,
      
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
        // Patch empty href="" anchors first.
        emailHtml = injectProfileUpdateLink(emailHtml, profileUpdateLink);

        // If the email references profile updates but the button token was stripped upstream,
        // inject the button near the copy (without being blocked by the presence of the link).
        const hasButtonAlready = /data-art-profile-update=(['"])button\1/i.test(emailHtml) || emailHtml.includes('Update My Profile');
        if (!hasButtonAlready && /update\s+your\s+profile/i.test(emailHtml) && profileUpdateButton) {
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
    
    // Send main email to lead passenger
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

    // Send emails to additional passengers (passenger_2 and passenger_3) if they have email addresses
    // These passengers receive their own direct emails, not CC'd
    const additionalPassengerEmails: string[] = [];
    
    const sendToPassenger = async (passenger: any, passengerLabel: string) => {
      if (!passenger?.email) return;
      
      // Skip if this email is the same as the lead passenger
      if (passenger.email === booking.customers.email) return;
      
      console.log(`Sending email to ${passengerLabel}: ${passenger.email}`);
      
      // Create personalized merge data for this passenger
      const passengerMergeData = {
        ...mergeData,
        customer_first_name: passenger.first_name || '',
        customer_last_name: passenger.last_name || '',
        customer_preferred_name: passenger.preferred_name || '',
        customer_email: passenger.email || '',
        customer_phone: passenger.phone || '',
        customer_dietary_requirements: passenger.dietary_requirements || '',
        customer_medical_conditions: passenger.medical_conditions || '',
        customer_accessibility_needs: passenger.accessibility_needs || '',
        customer_emergency_contact_name: passenger.emergency_contact_name || '',
        customer_emergency_contact_phone: passenger.emergency_contact_phone || '',
        customer_emergency_contact_relationship: passenger.emergency_contact_relationship || '',
        customer: {
          first_name: passenger.first_name || '',
          last_name: passenger.last_name || '',
          preferred_name: passenger.preferred_name || '',
          email: passenger.email || '',
          phone: passenger.phone || '',
          dietary_requirements: passenger.dietary_requirements || '',
          medical_conditions: passenger.medical_conditions || '',
          accessibility_needs: passenger.accessibility_needs || '',
          emergency_contact_name: passenger.emergency_contact_name || '',
          emergency_contact_phone: passenger.emergency_contact_phone || '',
          emergency_contact_relationship: passenger.emergency_contact_relationship || '',
        },
      };
      
      // Generate profile update link for this passenger
      let passengerProfileLink = '';
      let passengerProfileButton = '';
      
      if (needsProfileUpdateLink && passenger.id) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        const { data: tokenData, error: tokenError } = await supabaseClient
          .from('customer_access_tokens')
          .insert({
            customer_id: passenger.id,
            created_by: requestUserId || SYSTEM_ACTOR_ID,
            expires_at: expiresAt.toISOString(),
          })
          .select('token')
          .single();
        
        if (!tokenError && tokenData) {
          const baseUrl = Deno.env.get('SITE_URL') || 'https://art-tour-manager.lovable.app';
          passengerProfileLink = `${baseUrl}/update-profile/${tokenData.token}`;
          passengerProfileButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-profile-update="button"><tr><td><a href="${passengerProfileLink}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">Update My Profile</a></td></tr></table>`;
          
          passengerMergeData.profile_update_link = passengerProfileLink;
          passengerMergeData.profile_update_button = passengerProfileButton;
        }
      }
      
      // Process template for this passenger
      const contentToProcess = customContent || template?.content_template || '';
      let passengerEmailHtml = processTemplate(contentToProcess, passengerMergeData);
      passengerEmailHtml = passengerEmailHtml.replace(/\n/g, '<br>');
      
      if (passengerProfileLink) {
        passengerEmailHtml = injectProfileUpdateLink(passengerEmailHtml, passengerProfileLink);
        const hasButtonAlready = /data-art-profile-update=(['"])button\1/i.test(passengerEmailHtml) || passengerEmailHtml.includes('Update My Profile');
        if (!hasButtonAlready && /update\s+your\s+profile/i.test(passengerEmailHtml) && passengerProfileButton) {
          passengerEmailHtml = injectProfileUpdateButtonNearCopy(passengerEmailHtml, passengerProfileButton);
        }
      }
      
      const subjectToProcess = customSubject || template?.subject_template || emailSubject;
      const passengerSubject = processTemplate(subjectToProcess, passengerMergeData);
      
      try {
        const passengerEmailResponse = await resend.emails.send({
          from: `Bookings <${finalFromEmail}>`,
          to: [passenger.email],
          subject: passengerSubject,
          html: passengerEmailHtml,
        });
        
        if (passengerEmailResponse.data?.id) {
          additionalPassengerEmails.push(passenger.email);
          
          await supabaseClient
            .from('email_logs')
            .insert({
              message_id: passengerEmailResponse.data.id,
              booking_id: bookingId,
              tour_id: booking.tour_id,
              recipient_email: passenger.email,
              recipient_name: `${passenger.first_name} ${passenger.last_name}`,
              subject: passengerSubject,
              template_name: template?.name || 'Custom',
            });
        }
      } catch (passengerEmailError) {
        console.error(`Error sending email to ${passengerLabel}:`, passengerEmailError);
      }
    };
    
    // Send to passenger 2 and 3 if they exist AND if includeAdditionalPassengers is true
    if (shouldIncludeAdditionalPassengers) {
      if (booking.passenger_2) {
        await sendToPassenger(booking.passenger_2, 'Passenger 2');
      }
      if (booking.passenger_3) {
        await sendToPassenger(booking.passenger_3, 'Passenger 3');
      }
    } else {
      console.log('Skipping additional passengers as includeAdditionalPassengers is false');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      sentTo: booking.customers.email,
      ccTo: ccRecipients.length > 0 ? ccRecipients : undefined,
      additionalPassengers: additionalPassengerEmails.length > 0 ? additionalPassengerEmails : undefined
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