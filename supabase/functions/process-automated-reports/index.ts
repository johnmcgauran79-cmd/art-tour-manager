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

// Generate Rooming List Report HTML
async function generateRoomingListReport(supabase: any, tourId: string, tourName: string): Promise<string> {
  const { data: hotels } = await supabase
    .from('hotels')
    .select('*, hotel_bookings(*, bookings(*, customers(*)))')
    .eq('tour_id', tourId)
    .order('name');

  if (!hotels || hotels.length === 0) {
    return '<p>No hotel data available for this tour.</p>';
  }

  let html = `<h2>Rooming List - ${tourName}</h2>`;
  
  for (const hotel of hotels) {
    html += `<h3>${hotel.name}</h3>`;
    html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<thead><tr><th>Guest Name</th><th>Bedding</th><th>Check In</th><th>Check Out</th><th>Nights</th><th>Room Type</th></tr></thead>';
    html += '<tbody>';

    const hotelBookings = hotel.hotel_bookings || [];
    for (const hb of hotelBookings) {
      const booking = hb.bookings;
      if (!booking || booking.status === 'cancelled') continue;
      
      const customer = booking.customers || {};
      const guestName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown';
      
      html += '<tr>';
      html += `<td>${guestName}</td>`;
      html += `<td>${hb.bedding || 'N/A'}</td>`;
      html += `<td>${hb.check_in_date || 'N/A'}</td>`;
      html += `<td>${hb.check_out_date || 'N/A'}</td>`;
      html += `<td>${hb.nights || 'N/A'}</td>`;
      html += `<td>${hb.room_type || 'Standard'}</td>`;
      html += '</tr>';
    }
    
    html += '</tbody></table>';
  }

  return html;
}

// Generate Passenger List Report HTML
async function generatePassengerListReport(supabase: any, tourId: string, tourName: string): Promise<string> {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, customers!bookings_lead_passenger_id_fkey(*)')
    .eq('tour_id', tourId)
    .neq('status', 'cancelled')
    .order('created_at');

  if (!bookings || bookings.length === 0) {
    return '<p>No passenger data available for this tour.</p>';
  }

  let html = `<h2>Passenger List - ${tourName}</h2>`;
  html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
  html += '<thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Passengers</th><th>Dietary Requirements</th><th>Status</th></tr></thead>';
  html += '<tbody>';

  for (const booking of bookings) {
    const customer = booking.customers || {};
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown';
    
    html += '<tr>';
    html += `<td>${name}</td>`;
    html += `<td>${customer.email || 'N/A'}</td>`;
    html += `<td>${customer.phone || 'N/A'}</td>`;
    html += `<td>${booking.passenger_count || 1}</td>`;
    html += `<td>${booking.dietary_restrictions || 'None'}</td>`;
    html += `<td>${booking.status || 'N/A'}</td>`;
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

// Generate Booking Changes Report HTML (system-wide, last 7 days)
async function generateBookingChangesReport(supabase: any): Promise<string> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get all audit log entries for bookings in the past 7 days
  const { data: auditData } = await supabase
    .from('audit_log')
    .select('id, timestamp, operation_type, record_id, user_id, details')
    .eq('table_name', 'bookings')
    .gte('timestamp', sevenDaysAgo.toISOString())
    .order('timestamp', { ascending: false });

  if (!auditData || auditData.length === 0) {
    return '<p>No booking changes in the past 7 days.</p>';
  }

  // Get unique booking IDs
  const bookingIds = [...new Set(auditData.map(entry => entry.record_id).filter(Boolean))];
  
  // Fetch booking and customer details (include cancelled bookings)
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      tour_id,
      status,
      tours (name),
      customers!lead_passenger_id (first_name, last_name)
    `)
    .in('id', bookingIds);

  // Fetch user profiles
  const userIds = [...new Set(auditData.map(entry => entry.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', userIds);

  // Group operations by booking_id to consolidate new bookings
  const bookingGroups = new Map();
  auditData.forEach(entry => {
    const bookingId = entry.record_id;
    if (!bookingId) return;
    
    if (!bookingGroups.has(bookingId)) {
      bookingGroups.set(bookingId, []);
    }
    bookingGroups.get(bookingId).push(entry);
  });

  const consolidatedChanges = [];

  // Process each booking's operations
  bookingGroups.forEach((entries, bookingId) => {
    const booking = bookings?.find(b => b.id === bookingId);
    
    // Skip if booking no longer exists (was deleted)
    if (!booking) return;
    
    const customerName = booking.customers 
      ? `${booking.customers.first_name} ${booking.customers.last_name}`
      : 'Unknown Customer';
    const tourName = booking.tours?.name || 'Unknown Tour';

    // Check if this booking was created in this period
    const createEntry = entries.find(e => e.operation_type === 'CREATE_BOOKING' || e.operation_type === 'CREATE');
    
    // Check if booking was cancelled in this period
    const wasCancelled = booking.status === 'cancelled';
    const cancelEntry = wasCancelled ? entries.find(e => {
      const details = e.details;
      return details?.status?.old && details?.status?.new === 'cancelled';
    }) : null;
    
    if (createEntry) {
      // Show the new booking entry
      const profile = profiles?.find(p => p.id === createEntry.user_id);
      consolidatedChanges.push({
        timestamp: createEntry.timestamp,
        customer_name: customerName,
        tour_name: tourName,
        operation_type: 'CREATE_BOOKING',
        user_name: profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
          : 'System',
      });
      
      // If cancelled, show cancellation
      if (cancelEntry) {
        const profile = profiles?.find(p => p.id === cancelEntry.user_id);
        consolidatedChanges.push({
          timestamp: cancelEntry.timestamp,
          customer_name: customerName,
          tour_name: tourName,
          operation_type: 'CANCEL_BOOKING',
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
        });
      }
      
      // Consolidate activity updates
      const activityUpdates = entries.filter(e => e.operation_type === 'UPDATE_ACTIVITY_BOOKING' && e.id !== cancelEntry?.id);
      if (activityUpdates.length > 0) {
        const latestActivityUpdate = activityUpdates[0];
        const profile = profiles?.find(p => p.id === latestActivityUpdate.user_id);
        consolidatedChanges.push({
          timestamp: latestActivityUpdate.timestamp,
          customer_name: customerName,
          tour_name: tourName,
          operation_type: 'UPDATE_ACTIVITIES_CONSOLIDATED',
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
        });
      }
      
      // Show hotel updates separately
      const hotelUpdates = entries.filter(e => e.operation_type === 'UPDATE_HOTEL_BOOKING' && e.id !== cancelEntry?.id);
      hotelUpdates.forEach(entry => {
        const profile = profiles?.find(p => p.id === entry.user_id);
        consolidatedChanges.push({
          timestamp: entry.timestamp,
          customer_name: customerName,
          tour_name: tourName,
          operation_type: entry.operation_type,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
          details: entry.details,
        });
      });
    } else {
      // This is an update to an existing booking
      
      // If cancelled, show cancellation
      if (cancelEntry) {
        const profile = profiles?.find(p => p.id === cancelEntry.user_id);
        consolidatedChanges.push({
          timestamp: cancelEntry.timestamp,
          customer_name: customerName,
          tour_name: tourName,
          operation_type: 'CANCEL_BOOKING',
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
        });
      }
      
      // Consolidate activity updates
      const activityUpdates = entries.filter(e => e.operation_type === 'UPDATE_ACTIVITY_BOOKING' && e.id !== cancelEntry?.id);
      if (activityUpdates.length > 0) {
        const latestActivityUpdate = activityUpdates[0];
        const profile = profiles?.find(p => p.id === latestActivityUpdate.user_id);
        consolidatedChanges.push({
          timestamp: latestActivityUpdate.timestamp,
          customer_name: customerName,
          tour_name: tourName,
          operation_type: 'UPDATE_ACTIVITIES_CONSOLIDATED',
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
        });
      }
      
      // Show other updates separately
      const otherUpdates = entries.filter(e => 
        e.operation_type !== 'UPDATE_BOOKING' && 
        e.operation_type !== 'UPDATE' && 
        e.operation_type !== 'UPDATE_ACTIVITY_BOOKING' &&
        e.id !== cancelEntry?.id
      );
      
      otherUpdates.forEach(entry => {
        const profile = profiles?.find(p => p.id === entry.user_id);
        consolidatedChanges.push({
          timestamp: entry.timestamp,
          customer_name: customerName,
          tour_name: tourName,
          operation_type: entry.operation_type,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
          details: entry.details,
        });
      });
    }
  });

  // Sort by timestamp descending
  consolidatedChanges.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Helper function to format operation type
  const formatOperationType = (type: string, details?: any): string => {
    const typeMap: Record<string, string> = {
      'CREATE': 'New Booking',
      'CREATE_BOOKING': 'New Booking',
      'ADD_HOTEL_TO_BOOKING': 'Hotel Added',
      'REMOVE_HOTEL_FROM_BOOKING': 'Hotel Removed',
      'ADD_ACTIVITY_TO_BOOKING': 'Activity Added',
      'REMOVE_ACTIVITY_FROM_BOOKING': 'Activity Removed',
      'DELETE_BOOKING': 'Booking Deleted',
      'CANCEL_BOOKING': 'Booking Cancelled',
    };
    
    if (type === 'UPDATE_HOTEL_BOOKING' && details?.hotel_dates) {
      const changes = [];
      if (details.hotel_dates.old?.check_in !== details.hotel_dates.new?.check_in) {
        changes.push(`check-in changed`);
      }
      if (details.hotel_dates.old?.check_out !== details.hotel_dates.new?.check_out) {
        changes.push(`check-out changed`);
      }
      if (changes.length > 0) {
        return `Hotel Updated: ${changes.join(', ')}`;
      }
      return 'Hotel Updated';
    }
    
    if (type === 'UPDATE_ACTIVITY_BOOKING') {
      return 'Activity Updated';
    }
    
    if (type === 'UPDATE_ACTIVITIES_CONSOLIDATED') {
      return 'Activities Updated';
    }
    
    return typeMap[type] || type;
  };

  // Generate HTML
  let html = '<h2>Booking Changes Report</h2>';
  html += '<p style="color: #666;">Changes from the past 7 days across all tours</p>';
  html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
  html += '<thead><tr><th>Date & Time</th><th>Customer</th><th>Tour</th><th>Action</th><th>Changed By</th></tr></thead>';
  html += '<tbody>';

  for (const change of consolidatedChanges) {
    const date = new Date(change.timestamp).toLocaleDateString('en-AU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    html += '<tr>';
    html += `<td>${date}</td>`;
    html += `<td>${change.customer_name}</td>`;
    html += `<td>${change.tour_name}</td>`;
    html += `<td>${formatOperationType(change.operation_type, change.details)}</td>`;
    html += `<td>${change.user_name}</td>`;
    html += '</tr>';
  }

  html += '</tbody></table>';
  html += `<p style="color: #666; font-size: 14px;">Total changes: ${consolidatedChanges.length}</p>`;
  return html;
}

// Generate Activity Matrix Report HTML
async function generateActivityMatrixReport(supabase: any, tourId: string, tourName: string): Promise<string> {
  const { data: discrepancies } = await supabase
    .rpc('get_activity_allocation_discrepancies')
    .eq('tour_id', tourId);

  if (!discrepancies || discrepancies.length === 0) {
    return '<p>No activity allocation discrepancies found for this tour.</p>';
  }

  let html = `<h2>Activity Allocation Discrepancies - ${tourName}</h2>`;
  html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
  html += '<thead><tr><th>Guest Name</th><th>Activity</th><th>Passenger Count</th><th>Allocated</th><th>Issue Type</th></tr></thead>';
  html += '<tbody>';

  for (const item of discrepancies) {
    const guestName = `${item.lead_passenger_first_name || ''} ${item.lead_passenger_last_name || ''}`.trim();
    
    html += '<tr>';
    html += `<td>${guestName}</td>`;
    html += `<td>${item.activity_name}</td>`;
    html += `<td>${item.passenger_count}</td>`;
    html += `<td>${item.allocated_count}</td>`;
    html += `<td style="color: ${item.discrepancy_type === 'missing' ? '#d32f2f' : '#f57c00'};">${item.discrepancy_type}</td>`;
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

// Main report generation function
async function generateReport(supabase: any, reportType: string, tourId: string, tourName: string): Promise<string> {
  console.log(`Generating ${reportType} report`);
  
  switch (reportType) {
    case 'rooming_list':
      return await generateRoomingListReport(supabase, tourId, tourName);
    case 'passenger_list':
      return await generatePassengerListReport(supabase, tourId, tourName);
    case 'booking_changes':
      // Booking Changes Report is system-wide, not tour-specific
      return await generateBookingChangesReport(supabase);
    case 'activity_matrix':
      return await generateActivityMatrixReport(supabase, tourId, tourName);
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

    const { tour_id, report_types, recipient_emails, rule_id } = await req.json();

    console.log('Processing automated reports:', { tour_id, report_types, recipient_emails, rule_id });

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
    
    let emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #333;">Automated Report${isOnlyBookingChanges ? '' : ': ' + tour.name}</h1>
        ${!isOnlyBookingChanges ? `<p style="color: #666;">Tour Start Date: ${new Date(tour.start_date).toLocaleDateString()}</p>` : ''}
        <hr style="border: 1px solid #eee; margin: 20px 0;">
    `;

    // Generate each report
    for (const reportType of report_types) {
      const reportHtml = await generateReport(supabase, reportType, tour_id, tour.name);
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
      from: 'Australian Racing Tours <reports@australianracingtours.com.au>',
      to: recipient_emails,
      subject: isOnlyBookingChanges ? 'Automated Report: Booking Changes' : `Automated Report: ${tour.name}`,
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
