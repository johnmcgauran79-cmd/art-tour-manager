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

    const { report_types, recipient_email, tour_id } = await req.json();

    console.log('Sending test automated report:', { report_types, recipient_email, tour_id });

    if (!report_types || !Array.isArray(report_types) || report_types.length === 0) {
      throw new Error('report_types must be a non-empty array');
    }

    if (!recipient_email) {
      throw new Error('recipient_email is required');
    }

    // Get a sample tour if not provided
    let selectedTourId = tour_id;
    if (!selectedTourId) {
      const { data: tours } = await supabase
        .from('tours')
        .select('id')
        .eq('status', 'available')
        .order('start_date', { ascending: true })
        .limit(1);
      
      if (tours && tours.length > 0) {
        selectedTourId = tours[0].id;
      } else {
        throw new Error('No available tours found for testing');
      }
    }

    // Call the main report processing function to generate real reports
    const processReportsUrl = `${supabaseUrl}/functions/v1/process-automated-reports`;
    const processResponse = await fetch(processReportsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tour_id: selectedTourId,
        report_types: report_types,
        recipient_emails: [recipient_email],
        rule_id: null, // This is a test, not from an actual rule
      }),
    });

    const processResult = await processResponse.json();

    if (!processResponse.ok) {
      throw new Error(processResult.error || 'Failed to generate test reports');
    }

    console.log('Test reports generated and sent:', processResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test reports sent to ${recipient_email}`,
        tour_id: selectedTourId,
        ...processResult,
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