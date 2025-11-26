import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { report_types, recipient_email } = await req.json();

    console.log('Sending test automated report:', { report_types, recipient_email });

    if (!report_types || !Array.isArray(report_types) || report_types.length === 0) {
      throw new Error('report_types must be a non-empty array');
    }

    if (!recipient_email) {
      throw new Error('recipient_email is required');
    }

    // For now, just send a test email showing what reports would be included
    // In the future, this would actually generate and attach the reports
    const reportLabels: Record<string, string> = {
      'rooming_list': 'Rooming List',
      'booking_changes': 'Booking Changes Report',
      'passenger_list': 'Passenger List',
      'activity_matrix': 'Activity Allocation Matrix',
      'bedding_review': 'Bedding Type Review',
      'hotel_check': 'Hotel Allocation Check',
      'activity_check': 'Activity Allocation Check'
    };

    const reportListHtml = report_types.map((type: string) => 
      `<li>${reportLabels[type] || type}</li>`
    ).join('');

    const emailHtml = `
      <h2>Test Automated Report</h2>
      <p>This is a test email for your automated report rule.</p>
      <h3>Reports that will be included:</h3>
      <ul>
        ${reportListHtml}
      </ul>
      <p>When this rule runs, these reports will be generated and sent to the configured recipients.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">This is a test email from Australian Racing Tours automated report system.</p>
    `;

    console.log('Sending test email to:', recipient_email);

    const emailResponse = await resend.emails.send({
      from: 'Australian Racing Tours <onboarding@resend.dev>',
      to: [recipient_email],
      subject: 'Test: Automated Report Preview',
      html: emailHtml,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test email sent to ${recipient_email}`,
        email_id: emailResponse.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error sending test automated report:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});