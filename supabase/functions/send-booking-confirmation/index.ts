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
}

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

    const { bookingId, customSubject, customContent }: BookingConfirmationRequest = await req.json();

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
        customers:lead_passenger_id (first_name, last_name, email, phone, city, state, country),
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
          activities (name, activity_date, start_time, location, guide_name)
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

    // Process email template if available
    let emailSubject = `Booking Confirmation - ${booking.tours?.name || 'Your Tour'}`;
    let emailHtml = '';

    if (template) {
      // Create merge data object
      const mergeData = {
        customer_first_name: booking.customers?.first_name || '',
        customer_last_name: booking.customers?.last_name || '',
        customer_email: booking.customers?.email || '',
        customer_phone: booking.customers?.phone || '',
        customer_city: booking.customers?.city || '',
        customer_state: booking.customers?.state || '',
        customer_country: booking.customers?.country || '',
        tour_name: booking.tours?.name || '',
        tour_location: booking.tours?.location || '',
        tour_start_date: booking.tours?.start_date ? new Date(booking.tours.start_date).toLocaleDateString('en-AU') : '',
        tour_end_date: booking.tours?.end_date ? new Date(booking.tours.end_date).toLocaleDateString('en-AU') : '',
        tour_days: booking.tours?.days || '',
        tour_nights: booking.tours?.nights || '',
        tour_pickup_point: booking.tours?.pickup_point || '',
        tour_inclusions: booking.tours?.inclusions || '',
        tour_exclusions: booking.tours?.exclusions || '',
        booking_passenger_count: booking.passenger_count || 1,
        booking_status: booking.status || '',
        booking_check_in_date: booking.check_in_date ? new Date(booking.check_in_date).toLocaleDateString('en-AU') : '',
        booking_check_out_date: booking.check_out_date ? new Date(booking.check_out_date).toLocaleDateString('en-AU') : '',
        booking_total_nights: booking.total_nights || '',
        booking_passenger_2_name: booking.passenger_2_name || '',
        booking_passenger_3_name: booking.passenger_3_name || '',
        booking_group_name: booking.group_name || '',
        booking_dietary_restrictions: booking.dietary_restrictions || '',
        booking_extra_requests: booking.extra_requests || '',
        booking_medical_conditions: booking.medical_conditions || '',
        booking_emergency_contact_name: booking.emergency_contact_name || '',
        booking_passport_number: booking.passport_number || ''
      };

      // Process subject template (use custom if provided)
      if (customSubject) {
        emailSubject = customSubject;
      } else {
        emailSubject = template.subject_template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          return mergeData[key.trim() as keyof typeof mergeData] || '';
        });
      }

      // Process content template (use custom if provided)
      if (customContent) {
        emailHtml = customContent;
      } else {
        emailHtml = template.content_template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          return mergeData[key.trim() as keyof typeof mergeData] || '';
        });
      }

      // Handle hotel bookings loop
      if (booking.hotel_bookings && booking.hotel_bookings.length > 0) {
        const hotelBookingsHtml = booking.hotel_bookings.map((hb: any) => `
          <div style="margin-bottom: 15px; padding: 15px; border: 1px solid #eee; border-radius: 5px;">
            <p><strong>Hotel:</strong> ${hb.hotels?.name || 'Hotel TBD'}</p>
            <p><strong>Check-in:</strong> ${hb.check_in_date ? new Date(hb.check_in_date).toLocaleDateString('en-AU') : 'TBD'}</p>
            <p><strong>Check-out:</strong> ${hb.check_out_date ? new Date(hb.check_out_date).toLocaleDateString('en-AU') : 'TBD'}</p>
            <p><strong>Nights:</strong> ${hb.nights || 'TBD'}</p>
            <p><strong>Room Type:</strong> ${hb.room_type || 'Standard'}</p>
            <p><strong>Bedding:</strong> ${hb.bedding || 'Double'}</p>
            ${hb.room_upgrade ? `<p><strong>Room Upgrade:</strong> ${hb.room_upgrade}</p>` : ''}
          </div>
        `).join('');
        
        emailHtml = emailHtml.replace(/\{\{#hotel_bookings\}\}[\s\S]*?\{\{\/hotel_bookings\}\}/g, hotelBookingsHtml);
      } else {
        emailHtml = emailHtml.replace(/\{\{#hotel_bookings\}\}[\s\S]*?\{\{\/hotel_bookings\}\}/g, '<p>No hotel bookings</p>');
      }

      // Handle activity bookings loop
      if (booking.activity_bookings && booking.activity_bookings.length > 0) {
        const activityBookingsHtml = booking.activity_bookings.map((ab: any) => `
          <div style="margin-bottom: 15px; padding: 15px; border: 1px solid #eee; border-radius: 5px;">
            <p><strong>Activity:</strong> ${ab.activities?.name || 'Activity TBD'}</p>
            <p><strong>Date:</strong> ${ab.activities?.activity_date ? new Date(ab.activities.activity_date).toLocaleDateString('en-AU') : 'TBD'}</p>
            <p><strong>Start Time:</strong> ${ab.activities?.start_time || 'TBD'}</p>
            <p><strong>Location:</strong> ${ab.activities?.location || 'TBD'}</p>
            <p><strong>Guide:</strong> ${ab.activities?.guide_name || 'TBD'}</p>
            <p><strong>Passengers Attending:</strong> ${ab.passengers_attending || 'TBD'}</p>
          </div>
        `).join('');
        
        emailHtml = emailHtml.replace(/\{\{#activity_bookings\}\}[\s\S]*?\{\{\/activity_bookings\}\}/g, activityBookingsHtml);
      } else {
        emailHtml = emailHtml.replace(/\{\{#activity_bookings\}\}[\s\S]*?\{\{\/activity_bookings\}\}/g, '<p>No activity bookings</p>');
      }

      // Convert line breaks to HTML breaks
      emailHtml = emailHtml.replace(/\n/g, '<br>');
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

    // Send email
    const emailResponse = await resend.emails.send({
      from: template?.from_email ? `Bookings <${template.from_email}>` : "Bookings <onboarding@resend.dev>",
      to: [booking.customers.email],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Booking confirmation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      sentTo: booking.customers.email 
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