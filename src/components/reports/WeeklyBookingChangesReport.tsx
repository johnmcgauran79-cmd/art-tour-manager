import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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
      console.log('Fetching booking changes from edge function...');
      
      const { data, error } = await supabase.functions.invoke('generate-booking-changes-report', {
        body: { 
          days_back: parseInt(period),
          format: 'json'
        }
      });

      if (error) {
        console.error('Error fetching booking changes:', error);
        toast.error('Failed to load booking changes report');
        throw error;
      }

      console.log('Received booking changes data:', data);
      return data.changes as WeeklyChange[];
    },
  });

  // Call onDataChange whenever changes or period updates
  useEffect(() => {
    if (onDataChange && changes) {
      onDataChange(changes, period);
    }
  }, [changes, period, onDataChange]);

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
