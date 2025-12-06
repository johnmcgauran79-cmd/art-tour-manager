import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Hotel, AlertCircle, Activity, Grid3X3, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const OperationsQuickActions = () => {
  const navigate = useNavigate();

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

  // Weekly Booking Changes count - use the same edge function as the report for consistency
  const { data: weeklyChangesCount = 0 } = useQuery({
    queryKey: ['weekly-changes-count'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-booking-changes-report', {
        body: { 
          days_back: 7,
          format: 'json'
        }
      });

      if (error) {
        console.error('Error fetching booking changes count:', error);
        return 0;
      }

      return data.count || 0;
    },
  });

  const checkActions = [
    {
      icon: AlertCircle,
      label: "Bedding Type Review",
      description: "Review pax/bedding mismatches",
      count: beddingIssuesCount,
      onClick: () => navigate("/operations/bedding-review"),
    },
    {
      icon: Grid3X3,
      label: "Non-standard Activity Bookings",
      description: "Review all activity allocations",
      count: activityMatrixIssuesCount,
      onClick: () => navigate("/operations/activity-bookings"),
    },
    {
      icon: Activity,
      label: "Activity Allocation Check",
      description: "Find missing activity allocations",
      count: activityIssuesCount,
      onClick: () => navigate("/operations/activity-allocations"),
    },
    {
      icon: Hotel,
      label: "Hotel Allocation Check",
      description: "Find missing hotel allocations",
      count: hotelIssuesCount,
      onClick: () => navigate("/operations/hotel-allocations"),
    },
    {
      icon: FileText,
      label: "Booking Changes Report",
      description: "Review new bookings & changes (7 days)",
      count: weeklyChangesCount,
      onClick: () => navigate("/operations/booking-changes"),
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
    </div>
  );
};
