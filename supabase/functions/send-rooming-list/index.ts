import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";
import PDFDocument from "npm:pdfkit@0.15.0";

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

// Function to generate PDF using PDFKit
async function generateRoomingListPDF(hotelName: string, tourName: string, roomingData: any[], hotel: any): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      layout: 'landscape',
      margins: { top: 50, bottom: 50, left: 40, right: 40 }
    });
    
    const chunks: Uint8Array[] = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Add title
    doc.fontSize(20).font('Helvetica-Bold').text(`Rooming List - ${hotelName}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text(tourName, { align: 'center' });
    doc.moveDown(1);

    // Add hotel information
    doc.fontSize(10).font('Helvetica-Bold').text('Hotel Information:');
    doc.fontSize(9).font('Helvetica');
    doc.text(`Hotel: ${hotelName}`);
    if (hotel.address) {
      doc.text(`Address: ${hotel.address}`);
    }
    if (hotel.contact_phone) {
      doc.text(`Phone: ${hotel.contact_phone}`);
    }
    doc.text(`Total Rooms: ${roomingData.length}`);
    doc.moveDown(1);

    // Table setup
    const tableTop = doc.y;
    const colWidths = [35, 80, 70, 60, 55, 55, 35, 50, 60, 50, 70];
    const headers = ['Room #', 'Lead Passenger', 'Other Passengers', 'Group', 'Check In', 'Check Out', 'Nights', 'Bedding', 'Room Type', 'Upgrade', 'Requests'];
    
    // Draw table header
    let xPos = 40;
    doc.fontSize(8).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.rect(xPos, tableTop, colWidths[i], 20).fillAndStroke('#333', '#000');
      doc.fillColor('#fff').text(header, xPos + 2, tableTop + 5, { width: colWidths[i] - 4, align: 'left' });
      xPos += colWidths[i];
    });

    // Draw table rows
    doc.fillColor('#000').font('Helvetica');
    let yPos = tableTop + 20;
    
    roomingData.forEach((room, index) => {
      const rowHeight = 25;
      
      // Alternate row colors
      if (index % 2 === 1) {
        doc.rect(40, yPos, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#f5f5f5');
      }
      
      xPos = 40;
      const rowData = [
        room.roomNumber.toString(),
        room.leadPassenger,
        [room.passenger2, room.passenger3].filter(Boolean).join(', ') || '-',
        room.groupName || '-',
        room.checkIn || '-',
        room.checkOut || '-',
        room.nights.toString(),
        room.bedding,
        room.roomType,
        room.roomUpgrade || '-',
        room.roomRequests || '-'
      ];
      
      doc.fontSize(7).fillColor('#000');
      rowData.forEach((text, i) => {
        doc.text(text, xPos + 2, yPos + 5, { width: colWidths[i] - 4, height: rowHeight - 10, ellipsis: true });
        xPos += colWidths[i];
      });
      
      yPos += rowHeight;
      
      // Check if we need a new page
      if (yPos > 500) {
        doc.addPage({ size: 'A4', layout: 'landscape' });
        yPos = 50;
      }
    });

    // Add footer
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).font('Helvetica');
      doc.text(
        `Generated on ${new Date().toLocaleDateString('en-AU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`,
        40,
        doc.page.height - 30,
        { align: 'left' }
      );
      doc.text(
        `Page ${i + 1} of ${pages.count}`,
        0,
        doc.page.height - 30,
        { align: 'right', width: doc.page.width - 40 }
      );
    }

    doc.end();
  });
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

    // Generate HTML table for email
    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Room #</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Lead Passenger</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Other Passengers</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Group</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Check In</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Check Out</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Nights</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Bedding</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Room Type</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Upgrade</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Requests</th>
          </tr>
        </thead>
        <tbody>
          ${roomingData.map(room => `
            <tr>
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
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>If you have any questions or need clarification, please don't hesitate to contact us.</p>
        </div>
      </div>
    `;

    
    // Generate PDF
    const pdfBuffer = await generateRoomingListPDF(hotelName, tourName, roomingData, hotel);
    
    // Convert to base64 for email attachment
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    
    const emailData: any = {
      from: `Tour Operations <${fromEmail}>`,
      to: [recipientEmail],
      subject: subject || `Rooming List - ${hotelName} - ${tourName}`,
      html: emailHtml,
      attachments: [
        {
          filename: `${hotelName.replace(/[^a-z0-9]/gi, '_')}-rooming-list.pdf`,
          content: pdfBase64,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
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
