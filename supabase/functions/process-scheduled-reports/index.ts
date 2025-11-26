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

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentDate = now.getDate(); // 1-31
    const results = [];

    // Get all active rules
    const { data: allRules, error: rulesError } = await supabase
      .from('automated_report_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) {
      throw rulesError;
    }

    if (!allRules || allRules.length === 0) {
      console.log('No active rules found');
      return new Response(
        JSON.stringify({ message: 'No active rules to process' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${allRules.length} active rules to evaluate`);

    // Filter rules that should run today
    const rulesToProcess = allRules.filter(rule => {
      if (rule.schedule_type === 'weekly') {
        // Weekly: check if today matches the day of week
        return rule.schedule_value === currentDay;
      } else if (rule.schedule_type === 'monthly') {
        // Monthly: check if today matches the day of month
        return rule.schedule_value === currentDate;
      }
      // 'days_before_tour' rules are handled differently below
      return false;
    });

    console.log(`${rulesToProcess.length} rules match today's schedule (weekly/monthly)`);

    // Get all upcoming tours
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

    // Process weekly and monthly rules for all tours
    for (const rule of rulesToProcess) {
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

    // Process "days before tour" rules
    const daysBeforeRules = allRules.filter(rule => rule.schedule_type === 'days_before_tour');
    console.log(`Processing ${daysBeforeRules.length} days-before-tour rules`);

    for (const rule of daysBeforeRules) {
      for (const tour of upcomingTours) {
        try {
          const tourStartDate = new Date(tour.start_date);
          const daysUntilTour = Math.floor((tourStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Check if today matches the "X days before" threshold
          if (daysUntilTour === rule.schedule_value) {
            console.log(`Processing days-before rule "${rule.rule_name}" for tour "${tour.name}" (${daysUntilTour} days before)`);
            
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
                days_until_tour: daysUntilTour,
                ...result
              });
              console.log(`Successfully processed days-before rule "${rule.rule_name}" for tour "${tour.name}"`);
            } else {
              const errorText = await response.text();
              results.push({
                rule: rule.rule_name,
                tour: tour.name,
                status: 'error',
                days_until_tour: daysUntilTour,
                error: errorText
              });
              console.error(`Failed to process days-before rule "${rule.rule_name}" for tour "${tour.name}":`, errorText);
            }
          }
        } catch (error) {
          results.push({
            rule: rule.rule_name,
            tour: tour.name,
            status: 'error',
            error: error.message
          });
          console.error(`Error processing days-before rule "${rule.rule_name}" for tour "${tour.name}":`, error);
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
