
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
  const today = new Date();
  
  const bookingsThisMonth = bookings?.filter(booking => {
    const bookingDate = new Date(booking.created_at);
    return bookingDate.getMonth() === currentMonth && 
           bookingDate.getFullYear() === currentYear &&
           booking.status !== 'cancelled';
  }).length || 0;

  // Active tours are not past and have start date in the future
  const activeTours = tours?.filter(tour => {
    const startDate = new Date(tour.start_date);
    return tour.status !== 'past' && startDate > today;
  }).length || 0;

  const totalPassengers = bookings?.filter(b => b.status !== 'cancelled')
    .reduce((sum, booking) => sum + booking.passenger_count, 0) || 0;

  // Calculate estimated revenue from bookings this month using the new revenue field
  const estimatedRevenue = bookings?.filter(booking => {
    const bookingDate = new Date(booking.created_at);
    return bookingDate.getMonth() === currentMonth && 
           bookingDate.getFullYear() === currentYear &&
           booking.status !== 'cancelled';
  }).reduce((sum, booking) => sum + (booking.revenue || 0), 0) || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bookings This Month</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{bookingsThisMonth}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estimated Monthly Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${estimatedRevenue.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Active Tours</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeTours}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Passengers</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPassengers}</div>
        </CardContent>
      </Card>
    </div>
  );
};
