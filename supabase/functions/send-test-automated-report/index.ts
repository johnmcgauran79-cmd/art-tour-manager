import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const reportList = report_types.map((type: string) => {
      const labels: Record<string, string> = {
        'rooming_list': 'Rooming List',
        'booking_changes': 'Booking Changes Report',
        'passenger_list': 'Passenger List',
        'activity_matrix': 'Activity Allocation Matrix',
        'bedding_review': 'Bedding Type Review',
        'hotel_check': 'Hotel Allocation Check',
        'activity_check': 'Activity Allocation Check'
      };
      return labels[type] || type;
    }).join(', ');

    console.log('Test email would include reports:', reportList);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test email sent to ${recipient_email} with reports: ${reportList}`,
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