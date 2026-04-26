import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklyChange {
  id: string;
  timestamp: string;
  operation_type: string;
  booking_id: string;
  customer_name: string;
  tour_name: string;
  user_name: string;
  details?: any;
}

// Format operation type for display
function formatOperationType(type: string, details?: any): string {
  const typeMap: Record<string, string> = {
    'CREATE': 'New Booking',
    'CREATE_BOOKING': 'New Booking',
    'ADD_HOTEL_TO_BOOKING': 'Hotel Added',
    'REMOVE_HOTEL_FROM_BOOKING': 'Hotel Removed',
    'ADD_ACTIVITY_TO_BOOKING': 'Activity Added', // Will be overridden below if activity_name is present
    'REMOVE_ACTIVITY_FROM_BOOKING': 'Activity Removed',
    'DELETE_BOOKING': 'Booking Deleted',
    'CANCEL_BOOKING': 'Booking Cancelled',
  };
  
  if (type === 'NEW_ACTIVITY_ADDED_TO_TOUR') {
    const activityName = details?.activity_name || 'Activity';
    const count = details?.bookings_affected || 0;
    return `New Activity Added: "${activityName}" (${count} bookings allocated)`;
  }

  if (type === 'ACTIVITY_REMOVED_FROM_TOUR') {
    const activityName = details?.activity_name || 'Activity';
    const count = details?.bookings_affected || 0;
    return `Activity Removed from Tour: "${activityName}" (${count} bookings affected)`;
  }
  
  if (type === 'UPDATE_HOTEL_BOOKING_DATES' || (type === 'UPDATE_HOTEL_BOOKING' && details?.hotel_dates)) {
    const changes = [];
    if (details?.hotel_dates?.old?.check_in !== details?.hotel_dates?.new?.check_in) {
      changes.push(`check-in changed`);
    }
    if (details?.hotel_dates?.old?.check_out !== details?.hotel_dates?.new?.check_out) {
      changes.push(`check-out changed`);
    }
    if (changes.length > 0) {
      return `Hotel Date Change: ${changes.join(', ')}`;
    }
    return 'Hotel Date Change';
  }
  
  if (type === 'UPDATE_HOTEL_BOOKING_ROOM' || (type === 'UPDATE_HOTEL_BOOKING' && (details?.bedding || details?.room_requests) && !details?.hotel_dates)) {
    const changes = [];
    if (details?.bedding) {
      changes.push(`bedding: ${details.bedding.old || '(none)'} → ${details.bedding.new || '(none)'}`);
    }
    if (details?.room_requests) {
      const oldVal = details.room_requests.old?.trim() || '(none)';
      const newVal = details.room_requests.new?.trim() || '(none)';
      changes.push(`room requests: "${oldVal}" → "${newVal}"`);
    }
    if (changes.length > 0) {
      return `Hotel Room/Bedding Change: ${changes.join(', ')}`;
    }
    return 'Hotel Room/Bedding Change';
  }
  
  if (type === 'UPDATE_ACTIVITY_BOOKING') {
    const activityName = details?.activity_name;
    return activityName ? `Activity Updated: ${activityName}` : 'Activity Updated';
  }
  
  if (type === 'ADD_ACTIVITY_TO_BOOKING') {
    const activityName = details?.activity_name;
    return activityName ? `Activity Added: ${activityName}` : 'Activity Added';
  }
  
  if (type === 'UPDATE_ACTIVITIES_CONSOLIDATED') {
    const activityNames = details?.activity_names;
    if (activityNames && activityNames.length > 0) {
      return `Activities Updated: ${activityNames.join(', ')}`;
    }
    return 'Activities Updated';
  }
  
  return typeMap[type] || type;
}

// Generate Booking Changes Report data
async function generateBookingChangesData(supabase: any, daysBack: number = 7): Promise<WeeklyChange[]> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - daysBack);

  const { data: auditDataRaw, error } = await supabase
    .from('audit_log')
    .select('id, timestamp, operation_type, record_id, user_id, details')
    .eq('table_name', 'bookings')
    .neq('operation_type', 'KEAP_SYNC_TAG')
    .gte('timestamp', daysAgo.toISOString())
    .order('timestamp', { ascending: false });

  if (error) throw error;
  const auditData = auditDataRaw as any[] | null;

  // Get unique booking IDs
  const bookingIds = [...new Set(auditData?.map(entry => entry.record_id).filter(Boolean) || [])];
  
  // Fetch booking and customer details (include cancelled bookings)
  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select(`
      id,
      tour_id,
      status,
      tours (name),
      customers!lead_passenger_id (first_name, last_name)
    `)
    .in('id', bookingIds);
  const bookings = bookingsRaw as any[] | null;

  // Fetch user profiles
  const userIds = [...new Set(auditData?.map(entry => entry.user_id) || [])];
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', userIds);
  const profiles = profilesRaw as any[] | null;

  // Fetch activity names for activity-related entries (both adds and updates)
  const activityIds = [...new Set(
    auditData
      ?.filter(e => 
        (e.operation_type === 'ADD_ACTIVITY_TO_BOOKING' && e.details?.activity_id) ||
        (e.operation_type === 'REMOVE_ACTIVITY_FROM_BOOKING' && e.details?.activity_id) ||
        (e.operation_type === 'UPDATE_ACTIVITY_BOOKING' && e.details?.passengers_attending?.activity_id)
      )
      .map(e => {
        if (e.operation_type === 'ADD_ACTIVITY_TO_BOOKING' || e.operation_type === 'REMOVE_ACTIVITY_FROM_BOOKING') {
          return e.details.activity_id;
        }
        return e.details?.passengers_attending?.activity_id;
      })
      .filter(Boolean) || []
  )];
  
  const { data: activitiesRaw } = activityIds.length > 0 ? await supabase
    .from('activities')
    .select('id, name, tour_id')
    .in('id', activityIds) : { data: [] };
  const activities = activitiesRaw as any[] | null;

  // First, identify new bookings created in this period - we need this BEFORE bulk activity detection
  const newBookingIds = new Set<string>();
  auditData?.forEach(entry => {
    if (entry.operation_type === 'CREATE_BOOKING' || entry.operation_type === 'CREATE') {
      newBookingIds.add(entry.record_id);
    }
  });

  // Detect bulk activity additions (when a new activity is added to a tour with existing bookings)
  // EXCLUDE activity additions for new bookings - those are part of booking creation, not bulk activity adds
  const activityAdditions = auditData?.filter(e => 
    e.operation_type === 'ADD_ACTIVITY_TO_BOOKING' && !newBookingIds.has(e.record_id)
  ) || [];
  const bulkActivityAdditions = new Map<string, { activityId: string; tourId: string; activityName: string; tourName: string; entries: any[]; firstEntry: any }>();
  
  activityAdditions.forEach(entry => {
    const activityId = entry.details?.activity_id;
    if (!activityId) return;
    
    if (!bulkActivityAdditions.has(activityId)) {
      const activity = activities?.find(a => a.id === activityId);
      const booking = bookings?.find(b => b.id === entry.record_id);
      bulkActivityAdditions.set(activityId, {
        activityId,
        tourId: activity?.tour_id || booking?.tour_id,
        activityName: activity?.name || 'Unknown Activity',
        tourName: booking?.tours?.name || 'Unknown Tour',
        entries: [],
        firstEntry: entry
      });
    }
    bulkActivityAdditions.get(activityId)!.entries.push(entry);
  });

  // Identify which activity additions are bulk (more than 1 booking allocated at once = new activity added to tour)
  const bulkActivityEntryIds = new Set<string>();
  const consolidatedActivityChanges: WeeklyChange[] = [];
  
  bulkActivityAdditions.forEach((data) => {
    if (data.entries.length > 1) {
      // This is a bulk addition - mark all entries to skip individual processing
      data.entries.forEach(e => bulkActivityEntryIds.add(e.id));
      
      // Add one consolidated entry
      const profile = profiles?.find(p => p.id === data.firstEntry.user_id);
      consolidatedActivityChanges.push({
        id: data.firstEntry.id,
        timestamp: data.firstEntry.timestamp,
        operation_type: 'NEW_ACTIVITY_ADDED_TO_TOUR',
        booking_id: data.firstEntry.record_id,
        customer_name: `${data.entries.length} bookings`,
        tour_name: data.tourName,
        user_name: profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
          : 'System',
        details: { activity_name: data.activityName, bookings_affected: data.entries.length }
      });
    }
  });

  // Detect bulk activity removals (when an activity is deleted from a tour, cascading to all bookings)
  // This is a tour-level change, not a per-booking change.
  const activityRemovals = auditData?.filter(e =>
    e.operation_type === 'REMOVE_ACTIVITY_FROM_BOOKING'
  ) || [];
  const bulkActivityRemovals = new Map<string, { activityId: string; tourId: string; activityName: string; tourName: string; entries: any[]; firstEntry: any }>();

  activityRemovals.forEach(entry => {
    const activityId = entry.details?.activity_id;
    if (!activityId) return;

    if (!bulkActivityRemovals.has(activityId)) {
      const activity = activities?.find(a => a.id === activityId);
      const booking = bookings?.find(b => b.id === entry.record_id);
      bulkActivityRemovals.set(activityId, {
        activityId,
        tourId: activity?.tour_id || booking?.tour_id,
        activityName: activity?.name || entry.details?.activity_name || 'Unknown Activity',
        tourName: booking?.tours?.name || 'Unknown Tour',
        entries: [],
        firstEntry: entry,
      });
    }
    bulkActivityRemovals.get(activityId)!.entries.push(entry);
  });

  bulkActivityRemovals.forEach((data) => {
    if (data.entries.length > 1) {
      // Bulk removal — mark all entries to skip individual processing
      data.entries.forEach(e => bulkActivityEntryIds.add(e.id));

      const profile = profiles?.find(p => p.id === data.firstEntry.user_id);
      consolidatedActivityChanges.push({
        id: data.firstEntry.id,
        timestamp: data.firstEntry.timestamp,
        operation_type: 'ACTIVITY_REMOVED_FROM_TOUR',
        booking_id: data.firstEntry.record_id,
        customer_name: `${data.entries.length} bookings`,
        tour_name: data.tourName,
        user_name: profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
          : 'System',
        details: { activity_name: data.activityName, bookings_affected: data.entries.length },
      });
    }
  });

  // Group operations by booking_id to consolidate new bookings
  const bookingGroups = new Map<string, typeof auditData>();
  auditData?.forEach(entry => {
    const bookingId = entry.record_id;
    if (!bookingId) return;
    
    // Skip bulk activity additions - they're handled separately
    if (bulkActivityEntryIds.has(entry.id)) return;
    
    // Skip activity additions for new bookings - they're part of booking creation
    if (entry.operation_type === 'ADD_ACTIVITY_TO_BOOKING' && newBookingIds.has(bookingId)) return;
    
    // Skip hotel additions for new bookings - they're part of booking creation
    if (entry.operation_type === 'ADD_HOTEL_TO_BOOKING' && newBookingIds.has(bookingId)) return;
    
    if (!bookingGroups.has(bookingId)) {
      bookingGroups.set(bookingId, []);
    }
    bookingGroups.get(bookingId)!.push(entry);
  });

  const consolidatedChanges: WeeklyChange[] = [...consolidatedActivityChanges];

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
      const details = e.details as any;
      return details?.status?.old && details?.status?.new === 'cancelled';
    }) : null;
    
    if (createEntry) {
      // Show the new booking entry
      const profile = profiles?.find(p => p.id === createEntry.user_id);
      consolidatedChanges.push({
        id: createEntry.id,
        timestamp: createEntry.timestamp,
        operation_type: 'CREATE_BOOKING',
        booking_id: bookingId,
        customer_name: customerName,
        tour_name: tourName,
        user_name: profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
          : 'System',
        details: createEntry.details
      });
      
      // If cancelled, show cancellation
      if (cancelEntry) {
        const profile = profiles?.find(p => p.id === cancelEntry.user_id);
        consolidatedChanges.push({
          id: cancelEntry.id,
          timestamp: cancelEntry.timestamp,
          operation_type: 'CANCEL_BOOKING',
          booking_id: bookingId,
          customer_name: customerName,
          tour_name: tourName,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
          details: cancelEntry.details
        });
      }
      
      // Consolidate activity updates into a single entry
      const activityUpdates = entries.filter(e => e.operation_type === 'UPDATE_ACTIVITY_BOOKING' && e.id !== cancelEntry?.id);
      if (activityUpdates.length > 0) {
        const latestActivityUpdate = activityUpdates[0];
        const profile = profiles?.find(p => p.id === latestActivityUpdate.user_id);
        // Collect all activity names for the consolidated entry
        const activityNames = [...new Set(activityUpdates
          .map(e => {
            const activityId = e.details?.passengers_attending?.activity_id || e.details?.activity_id;
            const activity = activities?.find(a => a.id === activityId);
            return activity?.name;
          })
          .filter(Boolean)
        )];
        consolidatedChanges.push({
          id: latestActivityUpdate.id,
          timestamp: latestActivityUpdate.timestamp,
          operation_type: 'UPDATE_ACTIVITIES_CONSOLIDATED',
          booking_id: bookingId,
          customer_name: customerName,
          tour_name: tourName,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
          details: { ...latestActivityUpdate.details, activity_names: activityNames }
        });
      }
      
      // Show hotel updates separately - split into date vs room/bedding changes
      const hotelUpdates = entries.filter(e => e.operation_type === 'UPDATE_HOTEL_BOOKING' && e.id !== cancelEntry?.id);
      hotelUpdates.forEach(entry => {
        const profile = profiles?.find(p => p.id === entry.user_id);
        // Determine the specific subtype
        const hasDateChange = !!entry.details?.hotel_dates;
        const hasRoomChange = !!entry.details?.bedding || !!entry.details?.room_requests;
        const opType = hasDateChange ? 'UPDATE_HOTEL_BOOKING_DATES' : (hasRoomChange ? 'UPDATE_HOTEL_BOOKING_ROOM' : 'UPDATE_HOTEL_BOOKING');
        consolidatedChanges.push({
          id: entry.id,
          timestamp: entry.timestamp,
          operation_type: opType,
          booking_id: bookingId,
          customer_name: customerName,
          tour_name: tourName,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
          details: entry.details
        });
      });
    } else {
      // This is an update to an existing booking
      
      // If cancelled, show ONLY the cancellation - skip all other entries (hotel removals, activity updates, etc.)
      if (cancelEntry) {
        const profile = profiles?.find(p => p.id === cancelEntry.user_id);
        consolidatedChanges.push({
          id: cancelEntry.id,
          timestamp: cancelEntry.timestamp,
          operation_type: 'CANCEL_BOOKING',
          booking_id: bookingId,
          customer_name: customerName,
          tour_name: tourName,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
          details: cancelEntry.details
        });
        // Skip all other entries for cancelled bookings
        return;
      }
      
      // Consolidate activity updates into a single entry
      const activityUpdates = entries.filter(e => e.operation_type === 'UPDATE_ACTIVITY_BOOKING');
      if (activityUpdates.length > 0) {
        const latestActivityUpdate = activityUpdates[0];
        const profile = profiles?.find(p => p.id === latestActivityUpdate.user_id);
        // Collect all activity names for the consolidated entry
        const activityNames = [...new Set(activityUpdates
          .map(e => {
            const activityId = e.details?.passengers_attending?.activity_id || e.details?.activity_id;
            const activity = activities?.find(a => a.id === activityId);
            return activity?.name;
          })
          .filter(Boolean)
        )];
        consolidatedChanges.push({
          id: latestActivityUpdate.id,
          timestamp: latestActivityUpdate.timestamp,
          operation_type: 'UPDATE_ACTIVITIES_CONSOLIDATED',
          booking_id: bookingId,
          customer_name: customerName,
          tour_name: tourName,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
          details: { ...latestActivityUpdate.details, activity_names: activityNames }
        });
      }
      
      // Show other updates separately (but not individual ADD_ACTIVITY entries for single adds - they go through)
      const otherUpdates = entries.filter(e => 
        e.operation_type !== 'UPDATE_BOOKING' && 
        e.operation_type !== 'UPDATE' && 
        e.operation_type !== 'UPDATE_ACTIVITY_BOOKING' &&
        e.id !== cancelEntry?.id
      );
      
      otherUpdates.forEach(entry => {
        const profile = profiles?.find(p => p.id === entry.user_id);
        
        // Enrich ADD_ACTIVITY_TO_BOOKING with activity name
        let enrichedDetails = entry.details;
        if (entry.operation_type === 'ADD_ACTIVITY_TO_BOOKING' && entry.details?.activity_id) {
          const activity = activities?.find(a => a.id === entry.details.activity_id);
          if (activity) {
            enrichedDetails = { ...entry.details, activity_name: activity.name };
          }
        }
        
        // Reclassify UPDATE_HOTEL_BOOKING into specific subtypes
        let opType = entry.operation_type;
        if (opType === 'UPDATE_HOTEL_BOOKING') {
          const hasDateChange = !!entry.details?.hotel_dates;
          const hasRoomChange = !!entry.details?.bedding || !!entry.details?.room_requests;
          opType = hasDateChange ? 'UPDATE_HOTEL_BOOKING_DATES' : (hasRoomChange ? 'UPDATE_HOTEL_BOOKING_ROOM' : 'UPDATE_HOTEL_BOOKING');
        }
        
        consolidatedChanges.push({
          id: entry.id,
          timestamp: entry.timestamp,
          operation_type: opType,
          booking_id: bookingId,
          customer_name: customerName,
          tour_name: tourName,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
            : 'System',
          details: enrichedDetails
        });
      });
    }
  });

  // Sort by timestamp descending
  return consolidatedChanges.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// Categorize a change into one of three groups
function categorizeChange(type: string): 'new' | 'cancelled' | 'changes' {
  if (type === 'CREATE_BOOKING' || type === 'CREATE') return 'new';
  if (
    type === 'CANCEL_BOOKING' ||
    type === 'DELETE_BOOKING' ||
    type === 'REMOVE_HOTEL_FROM_BOOKING' ||
    type === 'REMOVE_ACTIVITY_FROM_BOOKING'
  ) return 'cancelled';
  return 'changes';
}

// Generate HTML version of the report
function generateBookingChangesHTML(changes: WeeklyChange[], daysBack: number = 7): string {
  if (!changes || changes.length === 0) {
    return '<p>No booking changes in the past ' + daysBack + ' days.</p>';
  }

  const groups: Record<'new' | 'changes' | 'cancelled', WeeklyChange[]> = {
    new: [],
    changes: [],
    cancelled: [],
  };
  for (const c of changes) {
    groups[categorizeChange(c.operation_type)].push(c);
  }

  const sections: Array<{ key: 'new' | 'changes' | 'cancelled'; title: string; color: string }> = [
    { key: 'new', title: 'New Bookings', color: '#16a34a' },
    { key: 'changes', title: 'Booking Changes', color: '#1976d2' },
    { key: 'cancelled', title: 'Cancellations & Removals', color: '#dc2626' },
  ];

  let html = `<p style="color: #666;">Changes from the past ${daysBack} days across all tours</p>`;

  for (const section of sections) {
    const rows = groups[section.key];
    if (rows.length === 0) continue;

    html += `<h3 style="margin: 24px 0 8px 0; color: ${section.color}; border-left: 4px solid ${section.color}; padding-left: 10px;">${section.title} (${rows.length})</h3>`;
    html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 12px;">';
    html += '<thead><tr><th>Date & Time</th><th>Customer</th><th>Tour</th><th>Action</th><th>Changed By</th></tr></thead>';
    html += '<tbody>';

    for (const change of rows) {
      const date = new Date(change.timestamp).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
  }

  html += `<p style="color: #666; font-size: 14px;">Total changes: ${changes.length}</p>`;
  return html;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { days_back = 7, format = 'json' } = await req.json().catch(() => ({ days_back: 7, format: 'json' }));

    console.log('Generating Booking Changes Report:', { days_back, format });

    // Generate the report data
    const changes = await generateBookingChangesData(supabase, days_back);

    // Return based on requested format
    if (format === 'html') {
      const html = generateBookingChangesHTML(changes, days_back);
      return new Response(
        JSON.stringify({ html, count: changes.length }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Return JSON data for frontend
      return new Response(
        JSON.stringify({ changes, count: changes.length }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error: any) {
    console.error('Error generating booking changes report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
