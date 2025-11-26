import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Hotel, AlertCircle, Activity, Grid3X3, FileText } from "lucide-react";
import { BookingValidationReport } from "@/components/BookingValidationReport";
import { ActivityCheckReport } from "@/components/ActivityCheckReport";
import { HotelAllocationCheckReport } from "@/components/HotelAllocationCheckReport";
import { AggregatedActivityMatrixReport } from "@/components/operations/AggregatedActivityMatrixReport";
import { WeeklyBookingChangesReport } from "@/components/reports/WeeklyBookingChangesReport";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const OperationsQuickActions = () => {
  const [showValidationReport, setShowValidationReport] = useState(false);
  const [showActivityCheck, setShowActivityCheck] = useState(false);
  const [showHotelCheck, setShowHotelCheck] = useState(false);
  const [showActivityMatrix, setShowActivityMatrix] = useState(false);
  const [showWeeklyChanges, setShowWeeklyChanges] = useState(false);

  // Bedding Type Review count
  const { data: beddingIssuesCount = 0 } = useQuery({
    queryKey: ['bedding-issues-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          passenger_count,
          status,
          hotel_bookings (bedding, allocated)
        `)
        .neq('status', 'cancelled');

      if (error) throw error;

      const mismatches = data?.filter(booking => {
        const allocatedHotels = booking.hotel_bookings?.filter(hb => hb.allocated) || [];
        if (allocatedHotels.length === 0) return false;

        if (booking.passenger_count === 1) {
          return allocatedHotels.some(hb => hb.bedding !== 'single');
        } else if (booking.passenger_count >= 2) {
          return allocatedHotels.some(hb => hb.bedding === 'single');
        }
        return false;
      });

      return mismatches?.length || 0;
    },
  });

  // Activity Allocation Check count
  const { data: activityIssuesCount = 0 } = useQuery({
    queryKey: ['activity-issues-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_missing_activity_allocations');
      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Hotel Allocation Check count
  const { data: hotelIssuesCount = 0 } = useQuery({
    queryKey: ['hotel-issues-count'],
    queryFn: async () => {
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, tour_id')
        .eq('accommodation_required', true)
        .neq('status', 'cancelled')
        .neq('status', 'waitlisted');

      if (bookingsError) throw bookingsError;

      const { data: hotelBookings, error: hotelBookingsError } = await supabase
        .from('hotel_bookings')
        .select('booking_id');

      if (hotelBookingsError) throw hotelBookingsError;

      const bookingsWithHotels = new Set(hotelBookings.map(hb => hb.booking_id));
      const issues = bookings.filter(booking => !bookingsWithHotels.has(booking.id));

      return issues.length;
    },
  });

  // Non-standard Activity Bookings count
  const { data: activityMatrixIssuesCount = 0 } = useQuery({
    queryKey: ['activity-matrix-issues-count'],
    queryFn: async () => {
      const { data: tours, error: toursError } = await supabase
        .from('tours')
        .select('id')
        .neq('status', 'archived');

      if (toursError) throw toursError;

      const bookingsWithIssues = new Set<string>();

      for (const tour of tours || []) {
        const { data: activities } = await supabase
          .from('activities')
          .select('id')
          .eq('tour_id', tour.id);

        if (!activities || activities.length === 0) continue;

        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, passenger_count')
          .eq('tour_id', tour.id)
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted');

        if (!bookings || bookings.length === 0) continue;

        const bookingIds = bookings.map(b => b.id);
        const activityIds = activities.map(a => a.id);

        const { data: activityBookings } = await supabase
          .from('activity_bookings')
          .select('booking_id, activity_id, passengers_attending')
          .in('booking_id', bookingIds)
          .in('activity_id', activityIds);

        for (const booking of bookings) {
          for (const activity of activities) {
            const allocation = activityBookings?.find(
              ab => ab.booking_id === booking.id && ab.activity_id === activity.id
            );

            if (!allocation || allocation.passengers_attending !== booking.passenger_count) {
              bookingsWithIssues.add(booking.id);
              break; // Stop checking activities for this booking once we found an issue
            }
          }
        }
      }

      return bookingsWithIssues.size;
    },
  });

  // Weekly Booking Changes count
  const { data: weeklyChangesCount = 0 } = useQuery({
    queryKey: ['weekly-changes-count'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, operation_type, record_id, details')
        .eq('table_name', 'bookings')
        .gte('timestamp', sevenDaysAgo.toISOString());

      if (error) throw error;

      // Group operations by booking_id (same logic as report)
      const bookingGroups = new Map<string, typeof data>();
      data?.forEach(entry => {
        const bookingId = entry.record_id;
        if (!bookingId) return;
        
        if (!bookingGroups.has(bookingId)) {
          bookingGroups.set(bookingId, []);
        }
        bookingGroups.get(bookingId)!.push(entry);
      });

      let count = 0;
      
      // Count entries using same consolidation logic as report
      bookingGroups.forEach((entries) => {
        const createEntry = entries.find(e => e.operation_type === 'CREATE_BOOKING' || e.operation_type === 'CREATE');
        
        if (createEntry) {
          // Count the new booking
          count++;
          
          // Check if cancelled
          const wasCancelled = entries.some(e => {
            const details = e.details as any;
            return details?.new_status === 'cancelled';
          });
          if (wasCancelled) count++;
          
          // Also count any UPDATE operations
          entries.forEach(entry => {
            if (entry.operation_type === 'UPDATE_HOTEL_BOOKING' || entry.operation_type === 'UPDATE_ACTIVITY_BOOKING') {
              count++;
            }
          });
        } else {
          // Check if cancelled
          const wasCancelled = entries.some(e => {
            const details = e.details as any;
            return details?.new_status === 'cancelled';
          });
          if (wasCancelled) count++;
          
          // Count individual changes (excluding generic updates)
          entries.forEach(entry => {
            if (entry.operation_type !== 'UPDATE_BOOKING' && entry.operation_type !== 'UPDATE') {
              count++;
            }
          });
        }
      });

      return count;
    },
  });

  const checkActions = [
    {
      icon: AlertCircle,
      label: "Bedding Type Review",
      description: "Review pax/bedding mismatches",
      count: beddingIssuesCount,
      onClick: () => {
        setShowValidationReport(true);
      },
    },
    {
      icon: Grid3X3,
      label: "Non-standard Activity Bookings",
      description: "Review all activity allocations",
      count: activityMatrixIssuesCount,
      onClick: () => {
        setShowActivityMatrix(true);
      },
    },
    {
      icon: Activity,
      label: "Activity Allocation Check",
      description: "Find missing activity allocations",
      count: activityIssuesCount,
      onClick: () => {
        setShowActivityCheck(true);
      },
    },
    {
      icon: Hotel,
      label: "Hotel Allocation Check",
      description: "Find missing hotel allocations",
      count: hotelIssuesCount,
      onClick: () => {
        setShowHotelCheck(true);
      },
    },
    {
      icon: FileText,
      label: "Weekly Booking Changes",
      description: "Review new bookings & changes (7 days)",
      count: weeklyChangesCount,
      onClick: () => {
        setShowWeeklyChanges(true);
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Reviews & Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {checkActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  onClick={action.onClick}
                  variant="outline"
                  className="h-auto flex-col items-start p-4 hover:bg-brand-navy hover:text-brand-yellow transition-all relative"
                >
                  {action.count > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center rounded-full p-0"
                    >
                      {action.count}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2 mb-2 w-full">
                    <Icon className="h-5 w-5" />
                    <span className="font-semibold text-sm">{action.label}</span>
                  </div>
                  <span className="text-xs text-left opacity-80">
                    {action.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <BookingValidationReport 
        open={showValidationReport} 
        onOpenChange={setShowValidationReport} 
      />

      <ActivityCheckReport 
        open={showActivityCheck} 
        onOpenChange={setShowActivityCheck} 
      />
      
      <HotelAllocationCheckReport 
        open={showHotelCheck} 
        onOpenChange={setShowHotelCheck} 
      />

      <AggregatedActivityMatrixReport 
        open={showActivityMatrix} 
        onOpenChange={setShowActivityMatrix} 
      />

      <Dialog open={showWeeklyChanges} onOpenChange={setShowWeeklyChanges}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <WeeklyBookingChangesReport onClose={() => setShowWeeklyChanges(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
