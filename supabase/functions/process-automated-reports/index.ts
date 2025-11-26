import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface ReportData {
  tourId: string;
  tourName: string;
  tourStartDate: string;
  reportTypes: string[];
}

// Generate Rooming List Report HTML by calling the dedicated edge function
async function generateRoomingListReport(supabaseUrl: string, supabaseServiceKey: string, tourId: string): Promise<string> {
  console.log('Calling generate-rooming-list-report edge function...');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-rooming-list-report`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tour_id: tourId,
      format: 'html'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate rooming list report: ${error}`);
  }

  const result = await response.json();
  return result.html;
}

// Generate Passenger List Report HTML by calling the dedicated edge function
async function generatePassengerListReport(supabaseUrl: string, supabaseServiceKey: string, tourId: string): Promise<string> {
  console.log('Calling generate-passenger-list-report edge function...');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-passenger-list-report`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tour_id: tourId,
      format: 'html'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate passenger list report: ${error}`);
  }

  const result = await response.json();
  return result.html;
}

// Generate Booking Changes Report HTML by calling the dedicated edge function
async function generateBookingChangesReport(supabaseUrl: string, supabaseServiceKey: string): Promise<string> {
  console.log('Calling generate-booking-changes-report edge function...');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-booking-changes-report`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      days_back: 7,
      format: 'html'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate booking changes report: ${error}`);
  }

  const result = await response.json();
  return result.html;
}

// Generate Activity Matrix Report HTML by calling the dedicated edge function
async function generateActivityMatrixReport(supabaseUrl: string, supabaseServiceKey: string, tourId: string): Promise<string> {
  console.log('Calling generate-activity-matrix-report edge function...');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-activity-matrix-report`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tour_id: tourId,
      format: 'html'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate activity matrix report: ${error}`);
  }

  const result = await response.json();
  return result.html;
}

// Main report generation function
async function generateReport(
  reportType: string, 
  tourId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string> {
  console.log(`Generating ${reportType} report`);
  
  switch (reportType) {
    case 'rooming_list':
      return await generateRoomingListReport(supabaseUrl, supabaseServiceKey, tourId);
    case 'passenger_list':
      return await generatePassengerListReport(supabaseUrl, supabaseServiceKey, tourId);
    case 'booking_changes':
      // Booking Changes Report is system-wide, uses dedicated edge function
      return await generateBookingChangesReport(supabaseUrl, supabaseServiceKey);
    case 'activity_matrix':
      return await generateActivityMatrixReport(supabaseUrl, supabaseServiceKey, tourId);
    case 'bedding_review':
      return '<p>Bedding Review report coming soon.</p>';
    case 'hotel_check':
      return '<p>Hotel Allocation Check report coming soon.</p>';
    case 'activity_check':
      return '<p>Activity Allocation Check report coming soon.</p>';
    default:
      return `<p>Unknown report type: ${reportType}</p>`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tour_id, report_types, recipient_emails, rule_id, schedule_type, schedule_value } = await req.json();

    console.log('Processing automated reports:', { tour_id, report_types, recipient_emails, rule_id, schedule_type, schedule_value });

    if (!tour_id || !report_types || !Array.isArray(report_types) || report_types.length === 0) {
      throw new Error('tour_id and report_types are required');
    }

    if (!recipient_emails || !Array.isArray(recipient_emails) || recipient_emails.length === 0) {
      throw new Error('recipient_emails is required');
    }

    // Get tour details
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('name, start_date')
      .eq('id', tour_id)
      .single();

    if (tourError || !tour) {
      throw new Error(`Tour not found: ${tour_id}`);
    }

    // Generate all reports
    const reportLabels: Record<string, string> = {
      'rooming_list': 'Rooming List',
      'booking_changes': 'Booking Changes Report',
      'passenger_list': 'Passenger List',
      'activity_matrix': 'Activity Allocation Matrix',
      'bedding_review': 'Bedding Type Review',
      'hotel_check': 'Hotel Allocation Check',
      'activity_check': 'Activity Allocation Check'
    };

    // Check if booking_changes is the only report type
    const isOnlyBookingChanges = report_types.length === 1 && report_types[0] === 'booking_changes';
    
    // Generate report title based on schedule type
    let reportTitle = 'Automated Report';
    if (schedule_type === 'weekly') {
      reportTitle = 'Weekly Report';
    } else if (schedule_type === 'monthly') {
      reportTitle = 'Monthly Report';
    } else if (schedule_type === 'days_before_tour' && schedule_value) {
      reportTitle = `${schedule_value} Days Before Report`;
    }
    
    let emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #333;">${reportTitle}${isOnlyBookingChanges ? '' : ': ' + tour.name}</h1>
        ${!isOnlyBookingChanges ? `<p style="color: #666;">Tour Start Date: ${new Date(tour.start_date).toLocaleDateString()}</p>` : ''}
        <hr style="border: 1px solid #eee; margin: 20px 0;">
    `;

    // Generate each report
    for (const reportType of report_types) {
      const reportHtml = await generateReport(reportType, tour_id, supabaseUrl, supabaseServiceKey);
      emailHtml += `
        <div style="margin: 30px 0;">
          <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
            ${reportLabels[reportType] || reportType}
          </h2>
          ${reportHtml}
        </div>
      `;
    }

    emailHtml += `
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated report from Australian Racing Tours
        </p>
      </div>
    `;

    // Send email
    console.log('Sending email to:', recipient_emails);

    const emailResponse = await resend.emails.send({
      from: 'Australian Racing Tours <info@australianracingtours.com.au>',
      to: recipient_emails,
      subject: isOnlyBookingChanges ? `${reportTitle}: Booking Changes` : `${reportTitle}: ${tour.name}`,
      html: emailHtml,
    });

    console.log('Email sent successfully:', emailResponse);

    if (emailResponse.error) {
      throw new Error(`Resend API Error: ${emailResponse.error.message}`);
    }

    // Log to automated_report_log
    const { error: logError } = await supabase
      .from('automated_report_log')
      .insert({
        rule_id: rule_id || null,
        tour_id: tour_id,
        report_types: report_types,
        recipient_emails: recipient_emails,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Error logging report:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reports sent to ${recipient_emails.join(', ')}`,
        email_id: emailResponse.data?.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error processing automated reports:', error);
    
    // Try to log the error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('automated_report_log')
        .insert({
          rule_id: null,
          tour_id: null,
          status: 'error',
          error_message: error.message,
          sent_at: new Date().toISOString(),
        });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }

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
