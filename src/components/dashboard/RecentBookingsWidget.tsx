import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, ArrowRight } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { format } from "date-fns";

export const RecentBookingsWidget = () => {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { data: bookings, isLoading } = useBookings();

  const handleBookingClick = (bookingId: string) => {
    navigate(`/bookings/${bookingId}`);
  };

  const handleViewAll = () => {
    setSearchParams({ tab: 'bookings' });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  // Sort by created_at descending and take last 10
  const recentBookings = (bookings || [])
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 10);

  return (
    <div className="w-full md:w-1/3">
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Bookings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentBookings.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No bookings yet
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    onClick={() => handleBookingClick(booking.id)}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 flex-shrink-0">
                          {booking.created_at ? format(new Date(booking.created_at), 'd-MMM') : '-'}
                        </span>
                        <span className="font-medium truncate">
                          {booking.customers?.first_name} {booking.customers?.last_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground w-14 flex-shrink-0"></span>
                        <span className="text-sm text-muted-foreground truncate">
                          {booking.tours?.name || 'No Tour'}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <Users className="h-3 w-3" />
                          {booking.passenger_count}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button
                variant="ghost"
                className="w-full mt-2 text-brand-navy hover:text-brand-navy/80"
                onClick={handleViewAll}
              >
                View All Bookings
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
