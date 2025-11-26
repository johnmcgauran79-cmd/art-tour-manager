import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
  onClose?: () => void;
}

export const WeeklyBookingChangesReport = ({ onClose }: WeeklyBookingChangesReportProps) => {
  const [period, setPeriod] = useState<string>("7");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();

  const { data: changes, isLoading } = useQuery({
    queryKey: ['weekly-booking-changes', period, customStartDate, customEndDate],
    queryFn: async () => {
      let startDate: Date;
      
      if (period === "custom") {
        if (!customStartDate || !customEndDate) return [];
        startDate = customStartDate;
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
      }

      const endDate = period === "custom" && customEndDate ? customEndDate : new Date();

      const { data: auditData, error } = await supabase
        .from('audit_log')
        .select('id, timestamp, operation_type, record_id, user_id, details')
        .eq('table_name', 'bookings')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
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
        
        const customerName = booking?.customers 
          ? `${booking.customers.first_name} ${booking.customers.last_name}`
          : 'Unknown';
        const tourName = booking?.tours?.name || 'Unknown Tour';

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
          entries.forEach(entry => {
            if ((entry.operation_type === 'UPDATE_HOTEL_BOOKING' || entry.operation_type === 'UPDATE_ACTIVITY_BOOKING') 
                && entry.id !== cancelEntry?.id) {
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
            }
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
          entries.forEach(entry => {
            // Skip generic UPDATE_BOOKING, UPDATE, and the cancellation entry
            if (entry.operation_type === 'UPDATE_BOOKING' || entry.operation_type === 'UPDATE' || entry.id === cancelEntry?.id) return;
            
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
      return consolidatedChanges.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
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

  const getPeriodLabel = () => {
    if (period === "custom") {
      if (customStartDate && customEndDate) {
        return `${format(customStartDate, "dd/MM/yyyy")} - ${format(customEndDate, "dd/MM/yyyy")}`;
      }
      return "Custom Period";
    }
    return `Last ${period} Days`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Booking Changes ({getPeriodLabel()})</h3>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="flex gap-2 mb-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="14">Last 14 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="custom">Custom Period</SelectItem>
          </SelectContent>
        </Select>

        {period === "custom" && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !customStartDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {customStartDate ? format(customStartDate, "dd/MM/yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customStartDate}
                  onSelect={setCustomStartDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !customEndDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {customEndDate ? format(customEndDate, "dd/MM/yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customEndDate}
                  onSelect={setCustomEndDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </>
        )}
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
