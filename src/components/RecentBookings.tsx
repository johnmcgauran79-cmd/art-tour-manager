
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Calendar } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "deposited": return "bg-blue-100 text-blue-800";
    case "invoiced": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

interface RecentBookingsProps {
  onAddBooking: () => void;
}

export const RecentBookings = ({ onAddBooking }: RecentBookingsProps) => {
  const { data: bookings, isLoading } = useBookings();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading recent bookings...</div>
        </CardContent>
      </Card>
    );
  }

  const recentBookings = (bookings || []).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Recent Bookings
          <div className="flex items-center gap-2">
            <Button onClick={onAddBooking} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Booking
            </Button>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>
          Latest 5 bookings in the system
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No bookings found. Create your first booking to get started!
          </div>
        ) : (
          <div className="space-y-4">
            {recentBookings.map((booking) => (
              <div key={booking.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">
                        {booking.customers?.first_name} {booking.customers?.last_name}
                      </h3>
                      <Badge className={getStatusColor(booking.status || 'pending')}>
                        {(booking.status || 'pending').replace("_", " ")}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.passenger_count} passengers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.tours?.name}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {booking.group_name && `Group: ${booking.group_name}`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
