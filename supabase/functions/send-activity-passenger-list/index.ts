import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailData {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  message: string;
}

interface RequestBody {
  activityId: string;
  activityName: string;
  activityDate?: string;
  emailData: EmailData;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { activityId, activityName, activityDate, emailData }: RequestBody = await req.json();

    console.log("Fetching activity passenger data for activity:", activityId);

    // Fetch activity passenger data - only those actually attending
    const { data: passengers, error: passengersError } = await supabase
      .from('activity_bookings')
      .select(`
        passengers_attending,
        bookings!inner(
          id,
          lead_passenger_id,
          passenger_2_name,
          passenger_3_name,
          dietary_restrictions,
          status,
          customers!bookings_lead_passenger_id_fkey(
            first_name,
            last_name,
            dietary_requirements
          )
        )
      `)
      .eq('activity_id', activityId)
      .gt('passengers_attending', 0)
      .neq('bookings.status', 'cancelled');

    if (passengersError) {
      console.error("Error fetching passengers:", passengersError);
      throw passengersError;
    }

    console.log("Fetched passengers:", passengers?.length);

    // Transform data - combine dietary info from both booking and customer
    const passengerList = passengers?.map((p: any) => {
      const bookingDietary = p.bookings.dietary_restrictions;
      const customerDietary = p.bookings.customers.dietary_requirements;
      const combinedDietary = [bookingDietary, customerDietary]
        .filter(Boolean)
        .join('; ');
      
      return {
        lead_passenger_name: `${p.bookings.customers.first_name} ${p.bookings.customers.last_name}`,
        passenger_2_name: p.bookings.passenger_2_name,
        passenger_3_name: p.bookings.passenger_3_name,
        passengers_attending: p.passengers_attending,
        dietary_restrictions: combinedDietary || null,
      };
    }) || [];

    const totalPassengers = passengerList.reduce((sum: number, p: any) => sum + p.passengers_attending, 0);

    // Generate HTML table for passenger list
    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px;">
        <thead>
          <tr style="background-color: #333;">
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Lead Passenger</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Additional Passengers</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: center; color: white;">Tickets</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; color: white;">Dietary Requirements</th>
          </tr>
        </thead>
        <tbody>
          ${passengerList.map((p: any, idx: number) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#fff' : '#f5f5f5'};">
              <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">${p.lead_passenger_name}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">
                ${p.passenger_2_name ? `<div>${p.passenger_2_name}</div>` : ''}
                ${p.passenger_3_name ? `<div>${p.passenger_3_name}</div>` : ''}
                ${!p.passenger_2_name && !p.passenger_3_name ? '-' : ''}
              </td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;">${p.passengers_attending}</td>
              <td style="border: 1px solid #ddd; padding: 10px;">${p.dietary_restrictions || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Generate email HTML
    const htmlBody = emailData.message.replace(/\n/g, '<br>');
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${activityName} - Passenger List</h1>
        ${activityDate ? `<h2 style="color: #555; margin-top: 10px;">Date: ${activityDate}</h2>` : ''}
        
        <div style="margin: 20px 0;">
          ${htmlBody}
        </div>
        
        <div style="background: #e6f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Activity:</strong> ${activityName}</p>
          ${activityDate ? `<p style="margin: 5px 0;"><strong>Date:</strong> ${activityDate}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Total Passengers:</strong> ${totalPassengers}</p>
          <p style="margin: 5px 0;"><strong>Total Bookings:</strong> ${passengerList.length}</p>
        </div>
        
        ${tableHTML}
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>If you have any questions or need clarification, please don't hesitate to contact us.</p>
          <p style="margin-top: 10px;"><em>Note: You can print this email to PDF using your browser's print function (File > Print > Save as PDF)</em></p>
        </div>
      </div>
    `;

    // Extract name from email and format sender
    const fromEmailAddress = emailData.from || 'info@australianracingtours.com.au';
    const emailLocalPart = fromEmailAddress.split('@')[0];
    const senderName = emailLocalPart.charAt(0).toUpperCase() + emailLocalPart.slice(1);
    const fromName = `${senderName} - Australian Racing Tours`;
    
    // Send email with Resend
    const emailPayload: any = {
      from: `${fromName} <${fromEmailAddress}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailHtml,
    };

    // Add CC if provided
    if (emailData.cc.length > 0) {
      emailPayload.cc = emailData.cc;
    }

    // Add BCC if provided
    if (emailData.bcc.length > 0) {
      emailPayload.bcc = emailData.bcc;
    }

    const emailResponse = await resend.emails.send(emailPayload);

    console.log("Email sent successfully:", emailResponse);

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

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id,
        sentTo: emailData.to 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-activity-passenger-list function:", error);
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