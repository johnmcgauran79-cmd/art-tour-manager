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

    const { bookingId }: BookingConfirmationRequest = await req.json();

    // Fetch booking details with all related information
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        tours:tour_id (name, start_date, end_date, location),
        customers:lead_passenger_id (first_name, last_name, email),
        hotel_bookings (
          check_in_date,
          check_out_date,
          room_type,
          room_upgrade,
          bedding,
          hotels (name)
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

    // Format hotel details
    const hotelDetails = booking.hotel_bookings?.map((hb: any) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>${hb.hotels?.name || 'Hotel TBD'}</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(hb.check_in_date).toLocaleDateString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(hb.check_out_date).toLocaleDateString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${hb.room_type || 'Standard'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${hb.bedding || 'Double'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${hb.room_upgrade || 'None'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="padding: 8px; border: 1px solid #ddd; text-align: center;">No hotel bookings</td></tr>';

    // Create email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #333; margin-bottom: 30px;">Booking Confirmation</h1>
          
          <div style="margin-bottom: 30px;">
            <h2 style="color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px;">Tour Details</h2>
            <p><strong>Tour:</strong> ${booking.tours?.name || 'TBD'}</p>
            <p><strong>Location:</strong> ${booking.tours?.location || 'TBD'}</p>
            <p><strong>Tour Dates:</strong> ${booking.tours?.start_date ? new Date(booking.tours.start_date).toLocaleDateString() : 'TBD'} - ${booking.tours?.end_date ? new Date(booking.tours.end_date).toLocaleDateString() : 'TBD'}</p>
          </div>

          <div style="margin-bottom: 30px;">
            <h2 style="color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px;">Passenger Information</h2>
            <p><strong>Lead Passenger:</strong> ${booking.customers?.first_name} ${booking.customers?.last_name}</p>
            <p><strong>Total Passengers:</strong> ${booking.passenger_count}</p>
            ${booking.passenger_2_name ? `<p><strong>Passenger 2:</strong> ${booking.passenger_2_name}</p>` : ''}
            ${booking.passenger_3_name ? `<p><strong>Passenger 3:</strong> ${booking.passenger_3_name}</p>` : ''}
            ${booking.group_name ? `<p><strong>Group Name:</strong> ${booking.group_name}</p>` : ''}
          </div>

          <div style="margin-bottom: 30px;">
            <h2 style="color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px;">Hotel Accommodation</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Hotel</th>
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Check In</th>
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Check Out</th>
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Room Type</th>
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Bedding</th>
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Upgrade</th>
                </tr>
              </thead>
              <tbody>
                ${hotelDetails}
              </tbody>
            </table>
          </div>

          ${booking.dietary_restrictions ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px;">Dietary Requirements</h2>
            <p>${booking.dietary_restrictions}</p>
          </div>
          ` : ''}

          ${booking.extra_requests ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px;">Special Requests</h2>
            <p>${booking.extra_requests}</p>
          </div>
          ` : ''}

          <div style="margin-top: 40px; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
            <p style="margin: 0; color: #666;"><strong>Questions or Changes?</strong></p>
            <p style="margin: 5px 0 0 0; color: #666;">If you have any questions or need to make changes to your booking, please reply to this email and we'll get back to you promptly.</p>
          </div>
        </div>
      </div>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Bookings <onboarding@resend.dev>", // Replace with your verified domain
      to: [booking.customers.email],
      subject: `Booking Confirmation - ${booking.tours?.name || 'Your Tour'}`,
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