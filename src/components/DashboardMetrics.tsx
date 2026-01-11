import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, DollarSign, TrendingUp } from "lucide-react";
import { StatsSkeleton } from "@/components/ui/skeleton";
import { useTours } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";

interface DashboardMetricsProps {
  onRevenueClick?: () => void;
}

export const DashboardMetrics = ({ onRevenueClick }: DashboardMetricsProps) => {
  const navigate = useNavigate();
  const { data: tours, isLoading: toursLoading } = useTours();
  const { data: bookings, isLoading: bookingsLoading } = useBookings();

  // Show skeleton while loading
  if (toursLoading || bookingsLoading) {
    return <StatsSkeleton />;
  }

  // Calculate metrics
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
  
  const bookingsThisMonth = bookings?.filter(booking => {
    const bookingDate = new Date(booking.created_at);
    return bookingDate.getMonth() === currentMonth && 
           bookingDate.getFullYear() === currentYear &&
           booking.status !== 'cancelled';
  }).length || 0;

  // Active tours are not past and have end date in the future or today
  const activeTours = tours?.filter(tour => {
    const endDate = new Date(tour.end_date);
    endDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    return tour.status !== 'past' && endDate >= today;
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
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate('/?tab=bookings')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bookings This Month</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{bookingsThisMonth}</div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={onRevenueClick}
      >
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

      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate('/?tab=tours')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Active Tours</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeTours}</div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate('/?tab=contacts')}
      >
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
