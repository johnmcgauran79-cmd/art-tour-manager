import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Hotel, Grid3X3, FileText, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const OperationsQuickActions = () => {
  const navigate = useNavigate();

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

  // Non-standard Activity Bookings count (respects acknowledgments)
  const { data: activityMatrixIssuesCount = 0 } = useQuery({
    queryKey: ['activity-matrix-issues-count'],
    queryFn: async () => {
      // Use the RPC to get discrepancies consistently with the report
      const [discResult, ackResult] = await Promise.all([
        supabase.rpc('get_activity_allocation_discrepancies'),
        supabase.from('activity_discrepancy_acknowledgments').select('booking_id, activity_id, snapshot_passenger_count, snapshot_allocated_count')
      ]);

      if (discResult.error) throw discResult.error;
      const allDiscrepancies = discResult.data || [];
      const acknowledgments = ackResult.data || [];

      // Filter out acknowledged items where snapshot still matches
      const unacknowledged = allDiscrepancies.filter((disc: any) => {
        const ack = acknowledgments.find(
          (a: any) => a.booking_id === disc.booking_id && a.activity_id === disc.activity_id
        );
        if (!ack) return true;
        return ack.snapshot_passenger_count !== disc.passenger_count ||
               ack.snapshot_allocated_count !== disc.allocated_count;
      });

      // Count unique bookings with unacknowledged discrepancies
      const bookingsWithIssues = new Set(unacknowledged.map((d: any) => d.booking_id));
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

  // Payment Status count
  const { data: paymentStatusCount = 0 } = useQuery({
    queryKey: ['payment-status-count'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-payment-status-report', {
        body: { format: 'json' }
      });

      if (error) {
        console.error('Error fetching payment status count:', error);
        return 0;
      }

      return data.count || 0;
    },
  });

  const checkActions = [
    {
      icon: Grid3X3,
      label: "Non-standard Activity Bookings",
      description: "Review all activity allocations",
      count: activityMatrixIssuesCount,
      onClick: () => navigate("/operations/activity-bookings"),
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
    {
      icon: DollarSign,
      label: "Payment Status",
      description: "Outstanding deposits, instalments & payments",
      count: paymentStatusCount,
      onClick: () => navigate("/operations/payment-status"),
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
