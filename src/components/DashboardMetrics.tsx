
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Building, MapPin, DollarSign, TrendingUp } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";

export const DashboardMetrics = () => {
  const { data: tours } = useTours();
  const { data: bookings } = useBookings();

  // Calculate metrics
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const bookingsThisMonth = bookings?.filter(booking => {
    const bookingDate = new Date(booking.created_at);
    return bookingDate.getMonth() === currentMonth && 
           bookingDate.getFullYear() === currentYear &&
           booking.status !== 'cancelled';
  }).length || 0;

  const activeTours = tours?.filter(tour => 
    tour.status === 'available' || tour.status === 'pending'
  ).length || 0;

  const totalPassengers = bookings?.filter(b => b.status !== 'cancelled')
    .reduce((sum, booking) => sum + booking.passenger_count, 0) || 0;

  // Calculate estimated revenue (using average of double price across tours)
  const estimatedRevenue = tours?.reduce((sum, tour) => {
    const tourBookings = bookings?.filter(b => b.tour_id === tour.id && b.status !== 'cancelled') || [];
    const tourPassengers = tourBookings.reduce((pSum, booking) => pSum + booking.passenger_count, 0);
    const avgPrice = tour.price_double || tour.price_single || 0;
    return sum + (tourPassengers * avgPrice);
  }, 0) || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bookings This Month</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{bookingsThisMonth}</div>
          <p className="text-xs text-muted-foreground">
            New bookings in {new Date().toLocaleDateString('en-US', { month: 'long' })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estimated Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${estimatedRevenue.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            From current bookings
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Tours</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeTours}</div>
          <p className="text-xs text-muted-foreground">
            Available and pending tours
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Passengers</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPassengers}</div>
          <p className="text-xs text-muted-foreground">
            Across all active bookings
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
