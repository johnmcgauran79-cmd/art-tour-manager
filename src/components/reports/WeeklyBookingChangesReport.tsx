import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

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

interface WeeklyBookingChangesReportProps {
  onDataChange?: (changes: WeeklyChange[], period: string) => void;
}

export const WeeklyBookingChangesReport = ({ onDataChange }: WeeklyBookingChangesReportProps = {}) => {
  const [period, setPeriod] = useState<string>("7");

  const { data: changes, isLoading } = useQuery({
    queryKey: ['weekly-booking-changes', period],
    queryFn: async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      const { data: auditData, error } = await supabase
        .from('audit_log')
        .select('id, timestamp, operation_type, record_id, user_id, details')
        .eq('table_name', 'bookings')
        .gte('timestamp', daysAgo.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Get unique booking IDs
      const bookingIds = [...new Set(auditData?.map(entry => entry.record_id).filter(Boolean) || [])];
      
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
      const userIds = [...new Set(auditData?.map(entry => entry.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

      // Group operations by booking_id to consolidate new bookings
      const bookingGroups = new Map<string, typeof auditData>();
      auditData?.forEach(entry => {
        const bookingId = entry.record_id;
        if (!bookingId) return;
        
        if (!bookingGroups.has(bookingId)) {
          bookingGroups.set(bookingId, []);
        }
        bookingGroups.get(bookingId)!.push(entry);
      });

      const consolidatedChanges: WeeklyChange[] = [];

      // Process each booking's operations
      bookingGroups.forEach((entries, bookingId) => {
        const booking = bookings?.find(b => b.id === bookingId);
        
        // Skip if booking no longer exists (was deleted)
        if (!booking) return;
        
        // Handle missing customer or tour data gracefully
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
          return details?.old_status && details?.new_status === 'cancelled';
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
          
          // Also show any UPDATE operations (actual changes after creation, excluding cancellation)
          // Consolidate activity updates into a single entry
          const activityUpdates = entries.filter(e => e.operation_type === 'UPDATE_ACTIVITY_BOOKING' && e.id !== cancelEntry?.id);
          const hotelUpdates = entries.filter(e => e.operation_type === 'UPDATE_HOTEL_BOOKING' && e.id !== cancelEntry?.id);
          
          // If there are activity updates, add one consolidated entry
          if (activityUpdates.length > 0) {
            const latestActivityUpdate = activityUpdates[0]; // Use the most recent one for timestamp and user
            const profile = profiles?.find(p => p.id === latestActivityUpdate.user_id);
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
              details: latestActivityUpdate.details
            });
          }
          
          // Show hotel updates separately
          hotelUpdates.forEach(entry => {
            const profile = profiles?.find(p => p.id === entry.user_id);
            consolidatedChanges.push({
              id: entry.id,
              timestamp: entry.timestamp,
              operation_type: entry.operation_type,
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
          
          // Show individual changes (excluding generic updates and cancellation)
          // Consolidate activity updates into a single entry
          const activityUpdates = entries.filter(e => e.operation_type === 'UPDATE_ACTIVITY_BOOKING' && e.id !== cancelEntry?.id);
          const otherUpdates = entries.filter(e => 
            e.operation_type !== 'UPDATE_BOOKING' && 
            e.operation_type !== 'UPDATE' && 
            e.operation_type !== 'UPDATE_ACTIVITY_BOOKING' &&
            e.id !== cancelEntry?.id
          );
          
          // If there are activity updates, add one consolidated entry
          if (activityUpdates.length > 0) {
            const latestActivityUpdate = activityUpdates[0]; // Use the most recent one for timestamp and user
            const profile = profiles?.find(p => p.id === latestActivityUpdate.user_id);
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
              details: latestActivityUpdate.details
            });
          }
          
          // Show other updates separately
          otherUpdates.forEach(entry => {
            const profile = profiles?.find(p => p.id === entry.user_id);
            consolidatedChanges.push({
              id: entry.id,
              timestamp: entry.timestamp,
              operation_type: entry.operation_type,
              booking_id: bookingId,
              customer_name: customerName,
              tour_name: tourName,
              user_name: profile 
                ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
                : 'System',
              details: entry.details
            });
          });
        }
      });

      // Sort by timestamp descending
      const sortedChanges = consolidatedChanges.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Call onDataChange if provided
      if (onDataChange) {
        onDataChange(sortedChanges, period);
      }
      
      return sortedChanges;
    },
  });

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
    
    // Handle hotel updates with details
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
    
    // Handle activity updates
    if (type === 'UPDATE_ACTIVITY_BOOKING') {
      return 'Activity Updated';
    }
    
    // Handle consolidated activity updates
    if (type === 'UPDATE_ACTIVITIES_CONSOLIDATED') {
      return 'Activities Updated';
    }
    
    return typeMap[type] || type;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Weekly Booking Changes</h3>
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      </div>
    );
  }

  if (!changes || changes.length === 0) {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Weekly Booking Changes</h3>
        <p className="text-muted-foreground text-center py-8">
          No booking changes in the past 7 days
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Booking Changes (Last {period} Days)</h3>
      </div>
      
      <div className="mb-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="14">Last 14 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Date & Time</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Tour</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Changed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((change) => (
              <TableRow key={change.id}>
                <TableCell className="font-medium text-sm">
                  {format(new Date(change.timestamp), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell className="text-sm">{change.customer_name}</TableCell>
                <TableCell className="text-sm">{change.tour_name}</TableCell>
                <TableCell className="text-sm">{formatOperationType(change.operation_type, change.details)}</TableCell>
                <TableCell className="text-sm">{change.user_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground mt-4">
        Total changes: {changes.length}
      </p>
    </div>
  );
};
