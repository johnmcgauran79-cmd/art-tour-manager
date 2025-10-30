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

    // Fetch activity passenger data
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
            last_name
          )
        )
      `)
      .eq('activity_id', activityId)
      .neq('bookings.status', 'cancelled');

    if (passengersError) {
      console.error("Error fetching passengers:", passengersError);
      throw passengersError;
    }

    console.log("Fetched passengers:", passengers?.length);

    // Transform data
    const passengerList = passengers?.map((p: any) => ({
      lead_passenger_name: `${p.bookings.customers.first_name} ${p.bookings.customers.last_name}`,
      passenger_2_name: p.bookings.passenger_2_name,
      passenger_3_name: p.bookings.passenger_3_name,
      passengers_attending: p.passengers_attending,
      dietary_restrictions: p.bookings.dietary_restrictions,
    })) || [];

    const totalPassengers = passengerList.reduce((sum: number, p: any) => sum + p.passengers_attending, 0);

    // Generate HTML for email body
    const emailHtml = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #1a365d; color: white; padding: 20px; }
            .content { padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary { background-color: #e6f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${activityName}</h1>
            ${activityDate ? `<p>Date: ${activityDate}</p>` : ''}
          </div>
          <div class="content">
            <p>${emailData.message.replace(/\n/g, '<br>')}</p>
            
            <div class="summary">
              <strong>Total Passengers: ${totalPassengers}</strong>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Lead Passenger</th>
                  <th>Additional Passengers</th>
                  <th>Tickets</th>
                  <th>Dietary Requirements</th>
                </tr>
              </thead>
              <tbody>
                ${passengerList.map((p: any) => `
                  <tr>
                    <td>${p.lead_passenger_name}</td>
                    <td>${[p.passenger_2_name, p.passenger_3_name].filter(Boolean).join(', ') || '-'}</td>
                    <td><strong>${p.passengers_attending}</strong></td>
                    <td>${p.dietary_restrictions || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="summary">
              <p><strong>Total Bookings:</strong> ${passengerList.length}</p>
              <p><strong>Total Passengers:</strong> ${totalPassengers}</p>
            </div>

            <div class="footer">
              <p>This is an automated message from Australian Racing Tours.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Generate PDF HTML
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
            h2 { color: #2d3748; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary { background-color: #e6f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>${activityName}</h1>
          ${activityDate ? `<h2>Date: ${activityDate}</h2>` : ''}
          <div class="summary">
            <strong>Total Passengers: ${totalPassengers}</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>Lead Passenger</th>
                <th>Additional Passengers</th>
                <th>Tickets</th>
                <th>Dietary Requirements</th>
              </tr>
            </thead>
            <tbody>
              ${passengerList.map((p: any) => `
                <tr>
                  <td>${p.lead_passenger_name}</td>
                  <td>${[p.passenger_2_name, p.passenger_3_name].filter(Boolean).join(', ') || '-'}</td>
                  <td><strong>${p.passengers_attending}</strong></td>
                  <td>${p.dietary_restrictions || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="summary">
            <p><strong>Total Bookings:</strong> ${passengerList.length}</p>
            <p><strong>Total Passengers:</strong> ${totalPassengers}</p>
          </div>
        </body>
      </html>
    `;

    // Convert HTML to PDF using Puppeteer
    const pdfBuffer = await generatePDF(pdfHtml);

    // Send email with Resend
    const emailResponse = await resend.emails.send({
      from: emailData.from,
      to: emailData.to,
      cc: emailData.cc.length > 0 ? emailData.cc : undefined,
      subject: emailData.subject,
      html: emailHtml,
      attachments: [
        {
          filename: `${activityName.replace(/[^a-z0-9]/gi, '_')}_Passenger_List.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
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

async function generatePDF(html: string): Promise<Uint8Array> {
  // Use Puppeteer to generate PDF
  const puppeteer = await import("https://deno.land/x/puppeteer@16.2.0/mod.ts");
  
  const browser = await puppeteer.default.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(html);
  
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });
  
  await browser.close();
  
  return pdf;
}

serve(handler);