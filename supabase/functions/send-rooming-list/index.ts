import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

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
  fromEmail?: string;
  ccEmail?: string;
  subject?: string;
  message?: string;
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

    const { 
      hotelId, 
      tourId, 
      tourName, 
      hotelEmail, 
      hotelName,
      fromEmail = 'onboarding@resend.dev',
      ccEmail = '',
      subject,
      message 
    }: RoomingListRequest = await req.json();

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

    // Generate HTML table for rooming list
    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px;">
        <thead>
          <tr style="background-color: #333;">
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Room #</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Lead Passenger</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Other Passengers</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Group</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Check In</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Check Out</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Nights</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Bedding</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Room Type</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Upgrade</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Requests</th>
          </tr>
        </thead>
        <tbody>
          ${roomingData.map((room, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#fff' : '#f5f5f5'};">
              <td style="border: 1px solid #ddd; padding: 10px;">${room.roomNumber}</td>
              <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">${room.leadPassenger}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">
                ${room.passenger2 ? `<div>${room.passenger2}</div>` : ''}
                ${room.passenger3 ? `<div>${room.passenger3}</div>` : ''}
              </td>
              <td style="border: 1px solid #ddd; padding: 10px;">${room.groupName || ''}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">${room.checkIn}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">${room.checkOut}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">${room.nights}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-transform: capitalize;">${room.bedding}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">${room.roomType}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">${room.roomUpgrade}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">${room.roomRequests}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Generate Room Type/Date Matrix Report
    const generateRoomTypeMatrix = () => {
      interface RoomTypeData {
        [roomType: string]: {
          [date: string]: number;
        };
      }
      
      const roomTypeData: RoomTypeData = {};
      const beddingData: RoomTypeData = {};
      const dateSet = new Set<string>();

      // Process each booking to count room types and bedding per date
      (hotelBookingsData || []).forEach((hotelBooking: any) => {
        if (!hotelBooking.check_in_date || !hotelBooking.check_out_date) return;

        const checkIn = new Date(hotelBooking.check_in_date);
        const checkOut = new Date(hotelBooking.check_out_date);
        const roomType = hotelBooking.room_type || 'Unspecified';
        const beddingType = hotelBooking.bedding || 'Unspecified';

        // Initialize if not exists
        if (!roomTypeData[roomType]) roomTypeData[roomType] = {};
        if (!beddingData[beddingType]) beddingData[beddingType] = {};

        // Count for each night between check-in and check-out
        const currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
          const dateStr = currentDate.toLocaleDateString('en-AU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          dateSet.add(dateStr);
          
          if (!roomTypeData[roomType][dateStr]) roomTypeData[roomType][dateStr] = 0;
          if (!beddingData[beddingType][dateStr]) beddingData[beddingType][dateStr] = 0;
          
          roomTypeData[roomType][dateStr]++;
          beddingData[beddingType][dateStr]++;
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });

      // Sort dates chronologically
      const allDates = Array.from(dateSet).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      });

      const roomTypes = Object.keys(roomTypeData).sort();
      const beddingTypes = Object.keys(beddingData).sort();

      return { roomTypeData, beddingData, allDates, roomTypes, beddingTypes };
    };

    const { roomTypeData, beddingData, allDates, roomTypes, beddingTypes } = generateRoomTypeMatrix();

    const roomTypeMatrixHTML = `
      <div style="margin-top: 40px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">Room Type/Date Report - ${hotelName}</h2>
        
        <div style="margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>Hotel:</strong> ${hotelName}</p>
          ${hotel.address ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${hotel.address}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Total Room Types:</strong> ${roomTypes.length}</p>
          <p style="margin: 5px 0;"><strong>Total Bedding Types:</strong> ${beddingTypes.length}</p>
        </div>

        <h3 style="color: #555; margin-top: 30px; margin-bottom: 15px;">By Room Type</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2; font-weight: bold;">Room Type</th>
              ${allDates.map(date => 
                `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #f2f2f2; font-weight: bold;">${date}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${roomTypes.map(roomType => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${roomType}</td>
                ${allDates.map(date => 
                  `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${roomTypeData[roomType]?.[date] || 0}</td>`
                ).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3 style="color: #555; margin-top: 30px; margin-bottom: 15px;">By Bedding Type</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #e8f4f8; font-weight: bold;">Bedding Type</th>
              ${allDates.map(date => 
                `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #e8f4f8; font-weight: bold;">${date}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${beddingTypes.map(beddingType => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-transform: capitalize;">${beddingType}</td>
                ${allDates.map(date => 
                  `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${beddingData[beddingType]?.[date] || 0}</td>`
                ).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Generate email body
    const defaultMessage = `Dear ${hotelName},\n\nPlease find below the rooming list for ${tourName}.\n\nKind regards,\nOperations Team`;
    const emailBody = message || defaultMessage;
    const htmlBody = emailBody.replace(/\n/g, '<br>');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">Rooming List - ${hotelName}</h1>
        
        <div style="margin: 20px 0;">
          ${htmlBody}
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Hotel:</strong> ${hotelName}</p>
          ${hotel.address ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${hotel.address}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Tour:</strong> ${tourName}</p>
          <p style="margin: 5px 0;"><strong>Total Rooms:</strong> ${roomingData.length}</p>
        </div>
        
        ${tableHTML}
        
        ${roomTypeMatrixHTML}
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>If you have any questions or need clarification, please don't hesitate to contact us.</p>
          <p style="margin-top: 10px;"><em>Note: You can print this email to PDF using your browser's print function (File > Print > Save as PDF)</em></p>
        </div>
      </div>
    `;

    const emailData: any = {
      from: `Tour Operations <${fromEmail}>`,
      to: [recipientEmail],
      subject: subject || `Rooming List - ${hotelName} - ${tourName}`,
      html: emailHtml,
    };

    // Add CC if provided
    if (ccEmail) {
      emailData.cc = [ccEmail];
    }

    const emailResponse = await resend.emails.send(emailData);

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
