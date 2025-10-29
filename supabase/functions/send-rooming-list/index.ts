import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";
// @deno-types="npm:@types/html-pdf-node@1.0.0"
import pdf from "npm:html-pdf-node@1.0.29";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RoomingListRequest {
  hotelId: string;
  tourId: string;
  tourName: string;
  hotelEmail?: string;
  hotelName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { hotelId, tourId, tourName, hotelEmail, hotelName }: RoomingListRequest = await req.json();

    // Fetch hotel data
    const { data: hotel, error: hotelError } = await supabaseClient
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single();

    if (hotelError || !hotel) {
      console.error('Error fetching hotel:', hotelError);
      return new Response(
        JSON.stringify({ error: 'Hotel not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recipientEmail = hotelEmail || hotel.contact_email;
    
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'No email address found for this hotel. Please add a contact email in the hotel settings.' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch hotel bookings for rooming list
    const { data: hotelBookingsData, error: bookingsError } = await supabaseClient
      .from('hotel_bookings')
      .select(`
        *,
        bookings!inner (
          id,
          tour_id,
          passenger_count,
          passenger_2_name,
          passenger_3_name,
          group_name,
          status,
          created_at,
          customers!lead_passenger_id (first_name, last_name)
        )
      `)
      .eq('hotel_id', hotelId)
      .eq('allocated', true)
      .eq('bookings.tour_id', tourId)
      .neq('bookings.status', 'cancelled')
      .order('created_at', { ascending: true });

    if (bookingsError) {
      console.error('Error fetching hotel bookings:', bookingsError);
      throw bookingsError;
    }

    // Format date helper
    const formatDate = (dateString?: string): string => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Generate rooming data
    const roomingData = (hotelBookingsData || []).map((hotelBooking: any, index: number) => {
      const booking = hotelBooking.bookings;
      return {
        roomNumber: index + 1,
        leadPassenger: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim(),
        passenger2: booking.passenger_2_name,
        passenger3: booking.passenger_3_name,
        groupName: booking.group_name,
        checkIn: formatDate(hotelBooking.check_in_date),
        checkOut: formatDate(hotelBooking.check_out_date),
        nights: hotelBooking.nights || '-',
        bedding: hotelBooking.bedding || '-',
        roomType: hotelBooking.room_type || '-',
        roomUpgrade: hotelBooking.room_upgrade || '-',
        roomRequests: hotelBooking.room_requests || '-',
      };
    });

    // Generate HTML for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
            }
            h1 { 
              color: #333; 
              border-bottom: 2px solid #333; 
              padding-bottom: 10px; 
            }
            .hotel-info { 
              margin-bottom: 20px; 
            }
            .hotel-info p { 
              margin: 5px 0; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 15px; 
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background-color: #f2f2f2; 
              font-weight: bold; 
            }
            tr:nth-child(even) { 
              background-color: #f9f9f9; 
            }
            .capitalize {
              text-transform: capitalize;
            }
          </style>
        </head>
        <body>
          <h1>Rooming List - ${hotelName}</h1>
          <div class="hotel-info">
            <p><strong>Hotel:</strong> ${hotelName}</p>
            ${hotel.address ? `<p><strong>Address:</strong> ${hotel.address}</p>` : ''}
            <p><strong>Tour:</strong> ${tourName}</p>
            <p><strong>Total Rooms:</strong> ${roomingData.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Room #</th>
                <th>Lead Passenger</th>
                <th>Other Passengers</th>
                <th>Group</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Nights</th>
                <th>Bedding</th>
                <th>Room Type</th>
                <th>Upgrade</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              ${roomingData.map(room => `
                <tr>
                  <td>${room.roomNumber}</td>
                  <td><strong>${room.leadPassenger}</strong></td>
                  <td>
                    ${room.passenger2 ? `<div>${room.passenger2}</div>` : ''}
                    ${room.passenger3 ? `<div>${room.passenger3}</div>` : ''}
                  </td>
                  <td>${room.groupName || ''}</td>
                  <td>${room.checkIn}</td>
                  <td>${room.checkOut}</td>
                  <td>${room.nights}</td>
                  <td class="capitalize">${room.bedding}</td>
                  <td>${room.roomType}</td>
                  <td>${room.roomUpgrade}</td>
                  <td>${room.roomRequests}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Generate PDF
    const pdfOptions = { 
      format: 'A4',
      landscape: true,
      printBackground: true
    };

    console.log('Generating PDF...');
    const pdfBuffer = await pdf.generatePdf({ content: htmlContent }, pdfOptions);
    
    // Convert buffer to base64
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "Tour Operations <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `Rooming List - ${tourName} - ${hotelName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Rooming List for ${tourName}</h1>
          <p>Dear ${hotel.contact_name || 'Team'},</p>
          <p>Please find attached the rooming list for <strong>${tourName}</strong>.</p>
          <p><strong>Hotel:</strong> ${hotelName}</p>
          <p><strong>Total Rooms:</strong> ${roomingData.length}</p>
          <p>If you have any questions or need clarification, please don't hesitate to contact us.</p>
          <p>Best regards,<br>Operations Team</p>
        </div>
      `,
      attachments: [
        {
          filename: `${tourName}-${hotelName}-Rooming-List.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log("Rooming list email sent successfully:", emailResponse);

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

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      sentTo: recipientEmail
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-rooming-list function:", error);
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
