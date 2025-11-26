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

    console.log('Processing scheduled automated reports...');

    // Get all active weekly rules (schedule_type = 'weekly')
    const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const { data: weeklyRules, error: rulesError } = await supabase
      .from('automated_report_rules')
      .select('*')
      .eq('is_active', true)
      .eq('schedule_type', 'weekly')
      .eq('schedule_value', currentDay);

    if (rulesError) {
      throw rulesError;
    }

    if (!weeklyRules || weeklyRules.length === 0) {
      console.log('No active weekly rules found for today');
      return new Response(
        JSON.stringify({ message: 'No active weekly rules for today' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${weeklyRules.length} weekly rules to process`);

    // Get all upcoming tours to send reports for
    const { data: upcomingTours, error: toursError } = await supabase
      .from('tours')
      .select('id, name, start_date')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true });

    if (toursError) {
      throw toursError;
    }

    if (!upcomingTours || upcomingTours.length === 0) {
      console.log('No upcoming tours found');
      return new Response(
        JSON.stringify({ message: 'No upcoming tours to report on' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${upcomingTours.length} upcoming tours`);

    // Process each rule for each tour
    const results = [];
    for (const rule of weeklyRules) {
      for (const tour of upcomingTours) {
        try {
          console.log(`Processing rule "${rule.rule_name}" for tour "${tour.name}"`);
          
          // Call the process-automated-reports function
          const response = await fetch(`${supabaseUrl}/functions/v1/process-automated-reports`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tour_id: tour.id,
              report_types: rule.report_types,
              recipient_emails: rule.recipient_emails,
              rule_id: rule.id,
              schedule_type: rule.schedule_type,
              schedule_value: rule.schedule_value,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            results.push({
              rule: rule.rule_name,
              tour: tour.name,
              status: 'success',
              ...result
            });
            console.log(`Successfully processed rule "${rule.rule_name}" for tour "${tour.name}"`);
          } else {
            const errorText = await response.text();
            results.push({
              rule: rule.rule_name,
              tour: tour.name,
              status: 'error',
              error: errorText
            });
            console.error(`Failed to process rule "${rule.rule_name}" for tour "${tour.name}":`, errorText);
          }
        } catch (error) {
          results.push({
            rule: rule.rule_name,
            tour: tour.name,
            status: 'error',
            error: error.message
          });
          console.error(`Error processing rule "${rule.rule_name}" for tour "${tour.name}":`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in scheduled report processing:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
