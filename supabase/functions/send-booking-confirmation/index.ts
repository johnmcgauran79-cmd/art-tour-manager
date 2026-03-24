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

// Similar helpers for travel docs links
const injectTravelDocsLink = (html: string, link: string): string => {
  return html.replace(
    /<a\b([^>]*?)href=(['"])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, preAttrs, quote, href, postAttrs, inner) => {
      const innerText = String(inner)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const isTravelDocsLink = innerText.includes("travel document") || innerText.includes("submit travel");
      const isHrefEmpty = String(href).trim() === "" || String(href).trim() === "#";

      if (isTravelDocsLink && isHrefEmpty) {
        return `<a${preAttrs}href=${quote}${link}${quote}${postAttrs}>${inner}</a>`;
      }

      return full;
    }
  );
};

const injectTravelDocsButtonNearCopy = (html: string, buttonHtml: string): string => {
  return html.replace(
    /(<p\b[^>]*>[\s\S]*?(travel\s+document|passport\s+detail)[\s\S]*?<\/p>)/i,
    `$1${buttonHtml}`
  );
};

// Branded email wrapper - wraps content in ART header with logo
const wrapBrandedEmail = (content: string, title?: string, headerImageUrl?: string): string => {
  const headerTitle = title || 'Australian Racing Tours';
  const logoUrl = headerImageUrl || 'https://art-tour-manager.lovable.app/images/email-header-default.png';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <img src="${logoUrl}" alt="Australian Racing Tours" style="height: 80px; max-width: 400px; width: auto; margin-bottom: 10px;" />
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    ${content}
  </div>
  
  <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
    <p style="margin: 0;">Australian Racing Tours</p>
    <p style="margin: 5px 0;">This email was sent regarding your tour booking.</p>
  </div>
</body>
</html>`;
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

    // Fetch default email header image and sender settings
    const { data: generalSettings } = await supabaseClient
      .from('general_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['email_header_image_url', 'default_sender_name', 'default_from_email_client', 'token_expiry_hours']);

    const getGSetting = (key: string, fb: string) => {
      const row = (generalSettings || []).find((r: any) => r.setting_key === key);
      if (!row) return fb;
      const val = row.setting_value;
      return typeof val === 'string' ? val : String(val);
    };

    const defaultHeaderImageUrl = getGSetting('email_header_image_url', 'https://art-tour-manager.lovable.app/images/email-header-default.png');
    const defaultSenderName = getGSetting('default_sender_name', 'Australian Racing Tours');
    const defaultFromEmailClient = getGSetting('default_from_email_client', 'bookings@australianracingtours.com.au');
    const tokenExpiryHours = Number(getGSetting('token_expiry_hours', '168')) || 168;

    // Fetch email template for booking confirmation
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*, header_image_url')
      .eq('type', 'booking_confirmation')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    if (templateError) {
      console.error('Error fetching email template:', templateError);
    }

    // Use template-specific header image if set, otherwise use default
    const emailHeaderImageUrl = template?.header_image_url || defaultHeaderImageUrl;

    // Fetch booking details with all related information including additional passengers
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        tours:tour_id (name, start_date, end_date, days, nights, location, pickup_point, inclusions, exclusions, tour_type, tour_host, capacity, minimum_passengers_required, price_single, price_double, price_twin, deposit_required, final_payment_date, instalment_date, instalment_amount, instalment_details, travel_documents_required, pickup_location_required, notes),
        selected_pickup_option:tour_pickup_options!bookings_selected_pickup_option_id_fkey (id, name, pickup_time, details),
        customers:lead_passenger_id (id, first_name, last_name, preferred_name, email, phone, city, state, country, spouse_name, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, medical_conditions, accessibility_needs, notes),
        secondary_contact:customers!secondary_contact_id (first_name, last_name, email, phone),
        passenger_2:customers!passenger_2_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, medical_conditions, accessibility_needs),
        passenger_3:customers!passenger_3_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, medical_conditions, accessibility_needs),
        booking_travel_docs (
          passenger_slot,
          customer_id,
          passport_first_name,
          passport_middle_name,
          passport_surname,
          passport_number,
          passport_country,
          passport_expiry_date,
          nationality,
          date_of_birth,
          name_as_per_passport
        ),
        hotel_bookings (
          check_in_date,
          check_out_date,
          nights,
          room_type,
          room_upgrade,
          bedding,
          hotels (name, contact_name, contact_phone, contact_email, address, extra_night_price)
        ),
        activity_bookings (
          passengers_attending,
          activities (
            name, activity_date, activity_status, start_time, end_time, location,
            depart_for_activity, transport_mode, driver_name, driver_phone,
            transport_company, transport_contact_name, transport_phone, transport_email,
            contact_name, contact_phone, contact_email, hospitality_inclusions, notes,
            spots_available, spots_booked,
            activity_journeys (journey_number, pickup_time, pickup_location, destination, sort_order)
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

    const getTravelDocsForPassenger = (customerId?: string | null, slotNumber?: number) => {
      const docs = booking.booking_travel_docs || [];

      if (customerId) {
        const byCustomer = docs.find((d: any) => d.customer_id === customerId);
        if (byCustomer) return byCustomer;
      }

      if (typeof slotNumber === 'number') {
        return docs.find((d: any) => Number(d.passenger_slot) === slotNumber) || null;
      }

      return null;
    };

    const computeHasPassportDetails = (docs: any | null | undefined): boolean => {
      if (!docs) return false;
      return Boolean(
        docs.passport_number ||
          docs.passport_country ||
          docs.passport_expiry_date ||
          docs.nationality ||
          docs.passport_first_name ||
          docs.passport_surname ||
          docs.date_of_birth ||
          docs.name_as_per_passport
      );
    };

    // IMPORTANT: Keep this HTML single-line (no \n) because later we run .replace(/\n/g, '<br>')
    // which can break table markup.
    const buildExistingPassportDetailsHtml = (docs: any | null | undefined): string => {
      if (!computeHasPassportDetails(docs)) return '';

      const formatField = (value: string | null | undefined, placeholder = 'Not provided') => {
        const trimmed = value ? String(value).trim() : '';
        return trimmed ? trimmed : `<span style="color: #999; font-style: italic;">${placeholder}</span>`;
      };

      const nameAsPerPassportRaw = docs?.name_as_per_passport ? String(docs.name_as_per_passport).trim() : '';
      const nameFromParts = [docs?.passport_first_name, docs?.passport_middle_name, docs?.passport_surname]
        .filter(Boolean)
        .map((v: any) => String(v).trim())
        .filter(Boolean)
        .join(' ');

      const nameAsPerPassport = nameAsPerPassportRaw || nameFromParts;

      return [
        `<div style="background:#f9f9f9;padding:16px;border-radius:6px;margin:20px 0;">`,
        `<h3 style="margin:0 0 12px 0;color:#333;font-size:16px;border-bottom:1px solid #ddd;padding-bottom:10px;">Current Details on File</h3>`,
        `<table style="width:100%;border-collapse:collapse;font-size:14px;">`,
        `<tr><td style="padding:6px 10px 6px 0;color:#666;width:40%;"><strong>Name (as per passport):</strong></td><td style="padding:6px 0;">${formatField(nameAsPerPassport)}</td></tr>`,
        `<tr><td style="padding:6px 10px 6px 0;color:#666;"><strong>Date of Birth:</strong></td><td style="padding:6px 0;">${docs?.date_of_birth ? formatDate(docs.date_of_birth) : formatField(null)}</td></tr>`,
        `<tr><td style="padding:6px 10px 6px 0;color:#666;"><strong>Passport Number:</strong></td><td style="padding:6px 0;">${formatField(docs?.passport_number)}</td></tr>`,
        `<tr><td style="padding:6px 10px 6px 0;color:#666;"><strong>Passport Country:</strong></td><td style="padding:6px 0;">${formatField(docs?.passport_country)}</td></tr>`,
        `<tr><td style="padding:6px 10px 6px 0;color:#666;"><strong>Passport Expiry:</strong></td><td style="padding:6px 0;">${docs?.passport_expiry_date ? formatDate(docs.passport_expiry_date) : formatField(null)}</td></tr>`,
        `<tr><td style="padding:6px 10px 6px 0;color:#666;"><strong>Nationality:</strong></td><td style="padding:6px 0;">${formatField(docs?.nationality)}</td></tr>`,
        `</table>`,
        `</div>`,
      ].join('');
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
          // Recursively process inner content to handle nested conditionals
          return processTemplate(content, data);
        }
        return '';
      });
      
      // STEP 2: Handle inverted conditional sections {{^variable}}...{{/variable}}
      processed = processed.replace(/\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
        const value = getNestedValue(data, stripZeroWidth(String(key)).trim());
        const isEmpty = !value || (Array.isArray(value) && value.length === 0);
        if (isEmpty) {
          // Recursively process inner content to handle nested conditionals
          return processTemplate(content, data);
        }
        return '';
      });
      
      // STEP 3: Handle remaining simple variable replacements {{variable}}
      processed = processed.replace(/\{\{([^#\/\^}][^}]*)\}\}/g, (match, key) => {
        const trimmedKey = stripZeroWidth(String(key)).trim();
        const value = getNestedValue(data, trimmedKey);
        
        // Empty field handling: show N/A for specific field types when empty
        if (value === undefined || value === null || value === '') {
          const naFields = [
            /passenger_(2|3)/,                    // All passenger 2/3 fields
            /dietary/i,                           // Dietary requirements
            /accessibility/i,                     // Accessibility needs
            /medical/i,                           // Medical conditions
            /emergency_contact/i,                 // Emergency contact fields
            /booking_passenger_2_name/,           // Legacy passenger name fields
            /booking_passenger_3_name/,
          ];
          
          const shouldShowNA = naFields.some(pattern => pattern.test(trimmedKey));
          return shouldShowNA ? 'N/A' : '';
        }
        
        return String(value);
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
        profileUpdateButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-profile-update="button"><tr><td><a href="${profileUpdateLink}" target="_blank" style="background-color: #232628; color: #F5C518; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">UPDATE MY PROFILE</a></td></tr></table>`;
        console.log('Generated profile update link for customer:', booking.customers.id);
      }
    }

    // Check if travel docs link/button is needed in the template
    // Similar pattern to profile update links
    const hasTravelDocsPlaceholder = /\{\{\s*travel_docs_(link|button)\s*\}\}/.test(normalizedContentToCheck);
    const hasTravelDocsCopy = /(travel\s+document|passport\s+detail)/i.test(normalizedContentToCheck);
    const hasEmptyTravelDocsAnchor = /<a[^>]*href=(['"])\s*\1[^>]*>[\s\S]*(travel\s+document|submit\s+travel)/i.test(normalizedContentToCheck);
    const needsTravelDocsLink = hasTravelDocsPlaceholder || hasTravelDocsCopy || hasEmptyTravelDocsAnchor;
    
    // Only generate travel docs links if the tour requires travel documents
    const tourRequiresTravelDocs = booking.tours?.travel_documents_required === true;
    const shouldGenerateTravelDocsLink = needsTravelDocsLink && tourRequiresTravelDocs;
    
    console.log('Travel docs check - hasTravelDocsPlaceholder:', hasTravelDocsPlaceholder);
    console.log('Travel docs check - hasTravelDocsCopy:', hasTravelDocsCopy);
    console.log('Travel docs check - tourRequiresTravelDocs:', tourRequiresTravelDocs);
    console.log('Travel docs check - shouldGenerateTravelDocsLink:', shouldGenerateTravelDocsLink);
    
    let travelDocsLink = '';
    let travelDocsButton = '';
    
    if (shouldGenerateTravelDocsLink && booking.customers?.id) {
      // Generate a travel docs token (7-day expiry, booking-specific)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + tokenExpiryHours);
      
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('customer_access_tokens')
        .insert({
          customer_id: booking.customers.id,
          booking_id: bookingId,
          purpose: 'travel_documents',
          created_by: requestUserId || SYSTEM_ACTOR_ID,
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();
      
      if (tokenError) {
        console.error('Error creating travel docs token:', tokenError);
      } else if (tokenData) {
        const baseUrl = Deno.env.get('SITE_URL') || 'https://art-tour-manager.lovable.app';
        travelDocsLink = `${baseUrl}/update-travel-docs/${tokenData.token}`;
        // IMPORTANT: Keep this HTML on a single line to prevent formatting issues.
        // data-art-travel-docs marker helps us reliably detect whether the button is already present.
        travelDocsButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-travel-docs="button"><tr><td><a href="${travelDocsLink}" target="_blank" style="background-color: #232628; color: #F5C518; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">UPDATE PASSPORT DETAILS</a></td></tr></table>`;
        console.log('Generated travel docs link for customer:', booking.customers.id);
      }
    }

    // Check if pickup location link/button is needed
    const tourRequiresPickup = booking.tours?.pickup_location_required === true;
    const hasPickupPlaceholder = /\{\{\s*pickup_(link|button)\s*\}\}/.test(normalizedContentToCheck);
    const needsPickupLink = hasPickupPlaceholder && tourRequiresPickup;
    
    console.log('Pickup check - tourRequiresPickup:', tourRequiresPickup);
    console.log('Pickup check - hasPickupPlaceholder:', hasPickupPlaceholder);
    
    // Resolve current pickup selection
    const selectedPickupOption = booking.selected_pickup_option;
    const pickupLocationName = selectedPickupOption?.name || '';
    const pickupLocationTime = selectedPickupOption?.pickup_time || '';
    const pickupLocationDetails = selectedPickupOption?.details || '';
    const hasPickupSelection = !!selectedPickupOption;
    
    let pickupLink = '';
    let pickupButton = '';
    
    if (needsPickupLink && booking.customers?.id) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + tokenExpiryHours);
      
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('customer_access_tokens')
        .insert({
          customer_id: booking.customers.id,
          booking_id: bookingId,
          purpose: 'pickup',
          created_by: requestUserId || SYSTEM_ACTOR_ID,
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();
      
      if (tokenError) {
        console.error('Error creating pickup token:', tokenError);
      } else if (tokenData) {
        const baseUrl = Deno.env.get('SITE_URL') || 'https://art-tour-manager.lovable.app';
        pickupLink = `${baseUrl}/select-pickup/${tokenData.token}`;
        pickupButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-pickup="button"><tr><td><a href="${pickupLink}" target="_blank" style="background-color: #232628; color: #F5C518; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">UPDATE PICKUP LOCATION</a></td></tr></table>`;
        console.log('Generated pickup link for customer:', booking.customers.id);
      }
    }

    // Check if itinerary link/button is needed
    const hasItineraryPlaceholder = /\{\{\s*itinerary_(link|button)\s*\}\}/.test(normalizedContentToCheck);
    
    let itineraryLink = '';
    let itineraryButton = '';
    
    if (hasItineraryPlaceholder && booking.customers?.id) {
      // Generate an itinerary token (7-day expiry, booking-specific so we can find the tour)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + tokenExpiryHours);
      
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('customer_access_tokens')
        .insert({
          customer_id: booking.customers.id,
          booking_id: bookingId,
          purpose: 'itinerary',
          created_by: requestUserId || SYSTEM_ACTOR_ID,
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();
      
      if (tokenError) {
        console.error('Error creating itinerary token:', tokenError);
      } else if (tokenData) {
        const baseUrl = Deno.env.get('SITE_URL') || 'https://art-tour-manager.lovable.app';
        itineraryLink = `${baseUrl}/view-itinerary/${tokenData.token}`;
        itineraryButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-itinerary="button"><tr><td><a href="${itineraryLink}" target="_blank" style="background-color: #232628; color: #F5C518; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">VIEW TOUR ITINERARY</a></td></tr></table>`;
        console.log('Generated itinerary link for customer:', booking.customers.id);
      }
    }

    // Process email template if available
    let emailSubject = `Booking Confirmation - ${booking.tours?.name || 'Your Tour'}`;
    let emailHtml = '';

    const leadTravelDocs = getTravelDocsForPassenger(booking.customers?.id, 1);
    const leadHasPassportDetails = computeHasPassportDetails(leadTravelDocs);
    const leadExistingPassportDetails = buildExistingPassportDetailsHtml(leadTravelDocs);

    // Create comprehensive merge data object with nested structures
    // Defined at handler scope so it's accessible to sendToPassenger
    let mergeData: Record<string, any> = {
      // Customer fields (dynamic - will be overridden for additional passengers)
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
      customer_emergency_contact_email: booking.customers?.emergency_contact_email || '',
      customer_notes: booking.customers?.notes || '',

      // Travel docs fields (dynamic - changes per recipient)
      passport_first_name: leadTravelDocs?.passport_first_name || '',
      passport_middle_name: leadTravelDocs?.passport_middle_name || '',
      passport_surname: leadTravelDocs?.passport_surname || '',
      name_as_per_passport: leadTravelDocs?.name_as_per_passport || '',
      passport_number: leadTravelDocs?.passport_number || '',
      passport_country: leadTravelDocs?.passport_country || '',
      passport_expiry_date: formatDate(leadTravelDocs?.passport_expiry_date),
      nationality: leadTravelDocs?.nationality || '',
      date_of_birth: formatDate(leadTravelDocs?.date_of_birth),
      has_passport_details: leadHasPassportDetails,
      existing_passport_details: leadExistingPassportDetails,

      // Lead passenger fields (static - always the lead passenger regardless of recipient)
      lead_passenger_first_name: booking.customers?.first_name || '',
      lead_passenger_last_name: booking.customers?.last_name || '',
      lead_passenger_preferred_name: booking.customers?.preferred_name || '',
      lead_passenger_email: booking.customers?.email || '',
      lead_passenger_phone: booking.customers?.phone || '',
      lead_passenger_city: booking.customers?.city || '',
      lead_passenger_state: booking.customers?.state || '',
      lead_passenger_country: booking.customers?.country || '',
      lead_passenger_spouse_name: booking.customers?.spouse_name || '',
      lead_passenger_dietary_requirements: booking.customers?.dietary_requirements || '',
      lead_passenger_medical_conditions: booking.customers?.medical_conditions || '',
      lead_passenger_accessibility_needs: booking.customers?.accessibility_needs || '',
      lead_passenger_emergency_contact_name: booking.customers?.emergency_contact_name || '',
      lead_passenger_emergency_contact_phone: booking.customers?.emergency_contact_phone || '',
      lead_passenger_emergency_contact_relationship: booking.customers?.emergency_contact_relationship || '',
      lead_passenger_emergency_contact_email: booking.customers?.emergency_contact_email || '',

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
        emergency_contact_email: booking.customers?.emergency_contact_email || '',
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
      booking_notes_requests: booking.booking_notes || '',
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

      // Passenger 2 fields (from linked contact record)
      passenger_2_first_name: booking.passenger_2?.first_name || '',
      passenger_2_last_name: booking.passenger_2?.last_name || '',
      passenger_2_preferred_name: booking.passenger_2?.preferred_name || '',
      passenger_2_email: booking.passenger_2?.email || '',
      passenger_2_phone: booking.passenger_2?.phone || '',
      passenger_2_dietary_requirements: booking.passenger_2?.dietary_requirements || '',
      passenger_2_medical_conditions: booking.passenger_2?.medical_conditions || '',
      passenger_2_accessibility_needs: booking.passenger_2?.accessibility_needs || '',
      passenger_2_emergency_contact_name: booking.passenger_2?.emergency_contact_name || '',
      passenger_2_emergency_contact_phone: booking.passenger_2?.emergency_contact_phone || '',
      passenger_2_emergency_contact_relationship: booking.passenger_2?.emergency_contact_relationship || '',
      passenger_2_emergency_contact_email: booking.passenger_2?.emergency_contact_email || '',

      // Passenger 3 fields (from linked contact record)
      passenger_3_first_name: booking.passenger_3?.first_name || '',
      passenger_3_last_name: booking.passenger_3?.last_name || '',
      passenger_3_preferred_name: booking.passenger_3?.preferred_name || '',
      passenger_3_email: booking.passenger_3?.email || '',
      passenger_3_phone: booking.passenger_3?.phone || '',
      passenger_3_dietary_requirements: booking.passenger_3?.dietary_requirements || '',
      passenger_3_medical_conditions: booking.passenger_3?.medical_conditions || '',
      passenger_3_accessibility_needs: booking.passenger_3?.accessibility_needs || '',
      passenger_3_emergency_contact_name: booking.passenger_3?.emergency_contact_name || '',
      passenger_3_emergency_contact_phone: booking.passenger_3?.emergency_contact_phone || '',
      passenger_3_emergency_contact_relationship: booking.passenger_3?.emergency_contact_relationship || '',
      passenger_3_emergency_contact_email: booking.passenger_3?.emergency_contact_email || '',

      booking: {
        id: booking.id || '',
        status: booking.status || '',
        passenger_count: booking.passenger_count || '',
        group_name: booking.group_name || '',
        accommodation_required: booking.accommodation_required ? 'Yes' : 'No',
        extra_requests: booking.booking_notes || '',
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
      
      // Travel docs action fields
      travel_docs_link: travelDocsLink,
      travel_docs_button: travelDocsButton,

      // Pickup location action fields
      pickup_link: pickupLink,
      pickup_button: pickupButton,
      
      // Itinerary action fields
      itinerary_link: itineraryLink,
      itinerary_button: itineraryButton,
      pickup_location_name: pickupLocationName,
      pickup_location_time: pickupLocationTime,
      pickup_location_details: pickupLocationDetails,

      // Computed condition fields (boolean flags for conditional template sections)
      has_passenger_2: !!booking.passenger_2,
      has_passenger_3: !!booking.passenger_3,
      has_multiple_passengers: (booking.passenger_count || 1) > 1,
      passenger_2_has_email: !!booking.passenger_2?.email,
      passenger_2_missing_email: !!booking.passenger_2 && !booking.passenger_2?.email,
      passenger_3_has_email: !!booking.passenger_3?.email,
      passenger_3_missing_email: !!booking.passenger_3 && !booking.passenger_3?.email,
      passenger_2_has_phone: !!booking.passenger_2?.phone,
      passenger_2_missing_phone: !!booking.passenger_2 && !booking.passenger_2?.phone,
      passenger_3_has_phone: !!booking.passenger_3?.phone,
      passenger_3_missing_phone: !!booking.passenger_3 && !booking.passenger_3?.phone,
      has_hotel_bookings: (booking.hotel_bookings || []).length > 0,
      has_activity_bookings: (booking.activity_bookings || []).length > 0,
      has_accommodation: !!booking.accommodation_required,
      no_accommodation: !booking.accommodation_required,
      has_group_name: !!booking.group_name,
      has_extra_requests: !!booking.booking_notes,
      tour_requires_travel_docs: !!booking.tours?.travel_documents_required,
      tour_requires_pickup: tourRequiresPickup,
      has_pickup_selection: hasPickupSelection,
      missing_pickup_selection: tourRequiresPickup && !hasPickupSelection,
      needs_passport_submission: !!booking.tours?.travel_documents_required && !leadHasPassportDetails,
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
        hotel_extra_night_price: hb.hotels?.extra_night_price || '',
      })),
      
      // Activity bookings array
      activity_bookings: (booking.activity_bookings || []).map((ab: any) => ({
        activity_name: ab.activities?.name || '',
        activity_date: formatDate(ab.activities?.activity_date),
        activity_status: ab.activities?.activity_status || '',
        activity_start_time: ab.activities?.start_time || '',
        activity_end_time: ab.activities?.end_time || '',
        activity_location: ab.activities?.location || '',
        activity_pickup_time: (ab.activities?.activity_journeys || [])[0]?.pickup_time || '',
        activity_pickup_location: (ab.activities?.activity_journeys || [])[0]?.pickup_location || '',
        activity_collection_time: (ab.activities?.activity_journeys || []).length > 1 ? (ab.activities?.activity_journeys || [])[1]?.pickup_time || '' : '',
        activity_collection_location: (ab.activities?.activity_journeys || []).length > 1 ? (ab.activities?.activity_journeys || [])[1]?.pickup_location || '' : '',
        activity_dropoff_location: (ab.activities?.activity_journeys || [])[0]?.destination || '',
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
        const hasButtonAlready = /data-art-profile-update=(['"])button\1/i.test(emailHtml) || emailHtml.includes('Update Your Profile');
        if (!hasButtonAlready && /update\s+your\s+profile/i.test(emailHtml) && profileUpdateButton) {
          emailHtml = injectProfileUpdateButtonNearCopy(emailHtml, profileUpdateButton);
        }
      }
      
      // Final safety pass for travel docs: same pattern as profile update
      if (travelDocsLink) {
        // Patch empty href="" anchors for travel docs links first.
        emailHtml = injectTravelDocsLink(emailHtml, travelDocsLink);

        // If the email references travel docs but the button token was stripped upstream,
        // inject the button near the copy.
        const hasTravelDocsButtonAlready = /data-art-travel-docs=(['"])button\1/i.test(emailHtml) || emailHtml.includes('UPDATE PASSPORT DETAILS');
        if (!hasTravelDocsButtonAlready && /(travel\s+document|passport\s+detail)/i.test(emailHtml) && travelDocsButton) {
          emailHtml = injectTravelDocsButtonNearCopy(emailHtml, travelDocsButton);
        }
      }
      
      // Wrap the processed content in the branded email wrapper
      emailHtml = wrapBrandedEmail(emailHtml, undefined, emailHeaderImageUrl);
    } else {
      // Fallback to simple HTML if no template found - use branded wrapper
      const fallbackContent = `
        <p>Dear ${booking.customers?.first_name} ${booking.customers?.last_name},</p>
        <p>Thank you for your booking confirmation for <strong>${booking.tours?.name || 'your tour'}</strong>.</p>
        <p>We will be in touch with more details soon.</p>
        <p>Best regards,<br>The Team</p>
      `;
      emailHtml = wrapBrandedEmail(fallbackContent, 'Booking Confirmation', emailHeaderImageUrl);
    }

    // Send email - use provided fromEmail, fallback to template from_email, then default
    const finalFromEmail = fromEmail || template?.from_email || `${defaultSenderName} <${defaultFromEmailClient}>`;
    
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
    
    const sendToPassenger = async (passenger: any, passengerLabel: string, passengerSlotNumber: number) => {
      if (!passenger?.email) return;
      
      // Skip if this email is the same as the lead passenger
      if (passenger.email === booking.customers.email) return;
      
      console.log(`Sending email to ${passengerLabel}: ${passenger.email}`);

      const passengerDocs = getTravelDocsForPassenger(passenger.id, passengerSlotNumber);
      const passengerHasPassportDetails = computeHasPassportDetails(passengerDocs);
      const passengerExistingPassportDetails = buildExistingPassportDetailsHtml(passengerDocs);
      
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
        customer_emergency_contact_email: passenger.emergency_contact_email || '',

        // Travel docs fields (dynamic)
        passport_first_name: passengerDocs?.passport_first_name || '',
        passport_middle_name: passengerDocs?.passport_middle_name || '',
        passport_surname: passengerDocs?.passport_surname || '',
        name_as_per_passport: passengerDocs?.name_as_per_passport || '',
        passport_number: passengerDocs?.passport_number || '',
        passport_country: passengerDocs?.passport_country || '',
        passport_expiry_date: formatDate(passengerDocs?.passport_expiry_date),
        nationality: passengerDocs?.nationality || '',
        date_of_birth: formatDate(passengerDocs?.date_of_birth),
        has_passport_details: passengerHasPassportDetails,
        needs_passport_submission: !!booking.tours?.travel_documents_required && !passengerHasPassportDetails,
        existing_passport_details: passengerExistingPassportDetails,

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
          emergency_contact_email: passenger.emergency_contact_email || '',
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
          passengerProfileButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-profile-update="button"><tr><td><a href="${passengerProfileLink}" target="_blank" style="background-color: #232628; color: #F5C518; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">UPDATE MY PROFILE</a></td></tr></table>`;
          
          passengerMergeData.profile_update_link = passengerProfileLink;
          passengerMergeData.profile_update_button = passengerProfileButton;
        }
      }
      
      // Generate travel docs link for this passenger if tour requires it
      let passengerTravelDocsLink = '';
      let passengerTravelDocsButton = '';
      
      if (shouldGenerateTravelDocsLink && passenger.id) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + tokenExpiryHours);
        
        const { data: tokenData, error: tokenError } = await supabaseClient
          .from('customer_access_tokens')
          .insert({
            customer_id: passenger.id,
            booking_id: bookingId,
            purpose: 'travel_documents',
            created_by: requestUserId || SYSTEM_ACTOR_ID,
            expires_at: expiresAt.toISOString(),
          })
          .select('token')
          .single();
        
        if (!tokenError && tokenData) {
          const baseUrl = Deno.env.get('SITE_URL') || 'https://art-tour-manager.lovable.app';
          passengerTravelDocsLink = `${baseUrl}/update-travel-docs/${tokenData.token}`;
          passengerTravelDocsButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-travel-docs="button"><tr><td><a href="${passengerTravelDocsLink}" target="_blank" style="background-color: #232628; color: #F5C518; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">UPDATE PASSPORT DETAILS</a></td></tr></table>`;
          
          passengerMergeData.travel_docs_link = passengerTravelDocsLink;
          passengerMergeData.travel_docs_button = passengerTravelDocsButton;
        }
      }
      
      // Generate pickup link for this passenger if tour requires it
      if (needsPickupLink && passenger.id) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + tokenExpiryHours);
        
        const { data: tokenData, error: tokenError } = await supabaseClient
          .from('customer_access_tokens')
          .insert({
            customer_id: passenger.id,
            booking_id: bookingId,
            purpose: 'pickup',
            created_by: requestUserId || SYSTEM_ACTOR_ID,
            expires_at: expiresAt.toISOString(),
          })
          .select('token')
          .single();
        
        if (!tokenError && tokenData) {
          const baseUrl = Deno.env.get('SITE_URL') || 'https://art-tour-manager.lovable.app';
          const passengerPickupLink = `${baseUrl}/select-pickup/${tokenData.token}`;
          const passengerPickupButton = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;" data-art-pickup="button"><tr><td><a href="${passengerPickupLink}" target="_blank" style="background-color: #232628; color: #F5C518; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">UPDATE PICKUP LOCATION</a></td></tr></table>`;
          
          passengerMergeData.pickup_link = passengerPickupLink;
          passengerMergeData.pickup_button = passengerPickupButton;
        }
      }
      
      // Process template for this passenger
      const contentToProcess = customContent || template?.content_template || '';
      let passengerEmailHtml = processTemplate(contentToProcess, passengerMergeData);
      passengerEmailHtml = passengerEmailHtml.replace(/\n/g, '<br>');
      
      if (passengerProfileLink) {
        passengerEmailHtml = injectProfileUpdateLink(passengerEmailHtml, passengerProfileLink);
        const hasButtonAlready = /data-art-profile-update=(['"])button\1/i.test(passengerEmailHtml) || passengerEmailHtml.includes('Update Your Profile');
        if (!hasButtonAlready && /update\s+your\s+profile/i.test(passengerEmailHtml) && passengerProfileButton) {
          passengerEmailHtml = injectProfileUpdateButtonNearCopy(passengerEmailHtml, passengerProfileButton);
        }
      }
      
      if (passengerTravelDocsLink) {
        passengerEmailHtml = injectTravelDocsLink(passengerEmailHtml, passengerTravelDocsLink);
        const hasTravelDocsButtonAlready = /data-art-travel-docs=(['"])button\1/i.test(passengerEmailHtml) || passengerEmailHtml.includes('UPDATE PASSPORT DETAILS');
        if (!hasTravelDocsButtonAlready && /(travel\s+document|passport\s+detail)/i.test(passengerEmailHtml) && passengerTravelDocsButton) {
          passengerEmailHtml = injectTravelDocsButtonNearCopy(passengerEmailHtml, passengerTravelDocsButton);
        }
      }
      
      // Wrap in branded email template
      passengerEmailHtml = wrapBrandedEmail(passengerEmailHtml, undefined, emailHeaderImageUrl);
      
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
        await sendToPassenger(booking.passenger_2, 'Passenger 2', 2);
      }
      if (booking.passenger_3) {
        await sendToPassenger(booking.passenger_3, 'Passenger 3', 3);
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