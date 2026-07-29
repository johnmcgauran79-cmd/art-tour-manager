import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Hotel, FileText, DollarSign, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPlaceholderBooking } from "@/lib/placeholderBookings";
import { SentEmailsReportModal } from "./SentEmailsReportModal";

export const OperationsQuickActions = () => {
  const navigate = useNavigate();
  const [sentEmailsOpen, setSentEmailsOpen] = useState(false);

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
    {
      icon: Mail,
      label: "Sent Emails Report",
      description: "All individual & bulk emails sent — opens, bounces, errors",
      count: 0,
      onClick: () => setSentEmailsOpen(true),
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
                  className="h-auto min-h-[88px] flex-col items-start p-4 hover:bg-brand-navy hover:text-brand-yellow transition-all relative whitespace-normal text-left w-full"
                >
                  {action.count > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 min-w-[24px] h-6 flex items-center justify-center rounded-full px-1.5 z-10 text-xs font-bold shadow-md"
                    >
                      {action.count}
                    </Badge>
                  )}
                  <div className="flex items-start gap-2 mb-2 w-full min-w-0">
                    <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                    <span className="font-semibold text-sm break-words leading-tight min-w-0 flex-1">{action.label}</span>
                  </div>
                  <span className="text-xs text-left opacity-80 break-words leading-snug w-full">
                    {action.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <SentEmailsReportModal
        open={sentEmailsOpen}
        onOpenChange={setSentEmailsOpen}
      />
    </div>
  );
};
