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

  const now = new Date();
  const bookingsThisMonth = (bookings || []).filter((b) => {
    if (!b.created_at) return false;
    const d = new Date(b.created_at);
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear() &&
      b.status !== 'cancelled'
    );
  }).length;

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader
          className="pb-3 cursor-pointer hover:bg-muted/40 rounded-t-xl transition-colors"
          onClick={handleViewAll}
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Recent Bookings
            <span className="text-xs font-normal text-muted-foreground">
              ({bookingsThisMonth} this month)
            </span>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by created_at descending and take last 10
  const recentBookings = (bookings || [])
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 10);

  return (
    <Card className="h-full flex flex-col">
        <CardHeader
          className="pb-3 cursor-pointer hover:bg-muted/40 rounded-t-xl transition-colors"
          onClick={handleViewAll}
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Recent Bookings
            <span className="text-xs font-normal text-muted-foreground">
              ({bookingsThisMonth} this month)
            </span>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto space-y-2">
          {recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet</p>
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
                        <span className="text-sm font-medium truncate">
                          {booking.customers?.first_name} {booking.customers?.last_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground w-14 flex-shrink-0"></span>
                        <span className="text-xs text-muted-foreground truncate">
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
                size="sm"
                className="w-full mt-2"
                onClick={handleViewAll}
              >
                View All Bookings
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
    </Card>
  );
};
