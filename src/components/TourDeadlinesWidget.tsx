
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, AlertTriangle } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useHotels } from "@/hooks/useHotels";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface Deadline {
  id: string;
  type: 'tour_start' | 'tour_end' | 'instalment' | 'final_payment' | 'hotel_checkin' | 'hotel_checkout' | 'initial_cutoff' | 'final_cutoff';
  title: string;
  date: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  hotelName?: string;
  hotelId?: string;
}

interface TourDeadlinesWidgetProps {
  tourId: string;
  onNavigate?: (destination: { type: 'tab' | 'hotel'; value: string; hotelId?: string }) => void;
}

export const TourDeadlinesWidget = ({ tourId, onNavigate }: TourDeadlinesWidgetProps) => {
  const { data: tours } = useTours();
  const { data: hotels } = useHotels(tourId);

  const tour = tours?.find(t => t.id === tourId);

  const getDeadlines = (): Deadline[] => {
    const deadlines: Deadline[] = [];
    const today = new Date();

    if (!tour) return deadlines;

    // Tour start date
    const startDate = new Date(tour.start_date);
    const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    deadlines.push({
      id: `tour-start-${tour.id}`,
      type: 'tour_start',
      title: 'Tour Departure',
      date: tour.start_date,
      description: 'Tour begins',
      priority: daysUntilStart <= 7 ? 'high' : daysUntilStart <= 14 ? 'medium' : 'low',
    });

    // Tour end date
    const endDate = new Date(tour.end_date);
    const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    deadlines.push({
      id: `tour-end-${tour.id}`,
      type: 'tour_end',
      title: 'Tour Return',
      date: tour.end_date,
      description: 'Tour ends',
      priority: daysUntilEnd <= 7 ? 'high' : daysUntilEnd <= 14 ? 'medium' : 'low',
    });

    // Instalment date
    if (tour.instalment_date) {
      const instalmentDate = new Date(tour.instalment_date);
      const daysUntilInstalment = Math.ceil((instalmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      deadlines.push({
        id: `instalment-${tour.id}`,
        type: 'instalment',
        title: 'Instalment Payment Due',
        date: tour.instalment_date,
        description: `$${tour.instalment_amount}`,
        priority: daysUntilInstalment <= 3 ? 'high' : daysUntilInstalment <= 7 ? 'medium' : 'low',
      });
    }

    // Final payment date
    if (tour.final_payment_date) {
      const finalDate = new Date(tour.final_payment_date);
      const daysUntilFinal = Math.ceil((finalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      deadlines.push({
        id: `final-payment-${tour.id}`,
        type: 'final_payment',
        title: 'Final Payment Due',
        date: tour.final_payment_date,
        description: 'Balance payment',
        priority: daysUntilFinal <= 3 ? 'high' : daysUntilFinal <= 7 ? 'medium' : 'low',
      });
    }

    // Hotel dates
    hotels?.forEach(hotel => {
      // Hotel check-in date
      if (hotel.default_check_in) {
        const checkinDate = new Date(hotel.default_check_in);
        const daysUntilCheckin = Math.ceil((checkinDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        deadlines.push({
          id: `hotel-checkin-${hotel.id}`,
          type: 'hotel_checkin',
          title: 'Hotel Check-in',
          date: hotel.default_check_in,
          description: hotel.name,
          priority: daysUntilCheckin <= 7 ? 'high' : daysUntilCheckin <= 14 ? 'medium' : 'low',
          hotelName: hotel.name,
          hotelId: hotel.id,
        });
      }

      // Hotel check-out date
      if (hotel.default_check_out) {
        const checkoutDate = new Date(hotel.default_check_out);
        const daysUntilCheckout = Math.ceil((checkoutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        deadlines.push({
          id: `hotel-checkout-${hotel.id}`,
          type: 'hotel_checkout',
          title: 'Hotel Check-out',
          date: hotel.default_check_out,
          description: hotel.name,
          priority: daysUntilCheckout <= 7 ? 'high' : daysUntilCheckout <= 14 ? 'medium' : 'low',
          hotelName: hotel.name,
          hotelId: hotel.id,
        });
      }

      // Initial rooms cutoff date
      if ((hotel as any).initial_rooms_cutoff_date) {
        const initialCutoffDate = new Date((hotel as any).initial_rooms_cutoff_date);
        const daysUntilInitialCutoff = Math.ceil((initialCutoffDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        deadlines.push({
          id: `initial-cutoff-${hotel.id}`,
          type: 'initial_cutoff',
          title: 'Initial Rooms Cutoff',
          date: (hotel as any).initial_rooms_cutoff_date,
          description: hotel.name,
          priority: daysUntilInitialCutoff <= 3 ? 'high' : daysUntilInitialCutoff <= 7 ? 'medium' : 'low',
          hotelName: hotel.name,
          hotelId: hotel.id,
        });
      }

      // Final rooms cutoff date
      if ((hotel as any).final_rooms_cutoff_date) {
        const finalCutoffDate = new Date((hotel as any).final_rooms_cutoff_date);
        const daysUntilFinalCutoff = Math.ceil((finalCutoffDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        deadlines.push({
          id: `final-cutoff-${hotel.id}`,
          type: 'final_cutoff',
          title: 'Final Rooms Cutoff',
          date: (hotel as any).final_rooms_cutoff_date,
          description: hotel.name,
          priority: daysUntilFinalCutoff <= 3 ? 'high' : daysUntilFinalCutoff <= 7 ? 'medium' : 'low',
          hotelName: hotel.name,
          hotelId: hotel.id,
        });
      }
    });

    // Sort by date (earliest first)
    return deadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const deadlines = getDeadlines();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDaysUntil = (date: string) => {
    const today = new Date();
    const targetDate = new Date(date);
    const daysUntil = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil < 0) return 'Past';
    return `${daysUntil} days`;
  };

  const handleDeadlineClick = (deadline: Deadline) => {
    if (!onNavigate) return;

    switch (deadline.type) {
      case 'tour_start':
      case 'tour_end':
      case 'instalment':
      case 'final_payment':
        // Navigate to overview tab for tour-related dates
        onNavigate({ type: 'tab', value: 'overview' });
        break;
      case 'hotel_checkin':
      case 'hotel_checkout':
      case 'initial_cutoff':
      case 'final_cutoff':
        // Navigate to hotels tab for hotel-related dates
        onNavigate({ type: 'tab', value: 'hotels', hotelId: deadline.hotelId });
        break;
      default:
        break;
    }
  };

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-brand-navy" />
          <CardTitle className="text-brand-navy">Tour Deadlines & Important Dates</CardTitle>
          <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
            {deadlines.length} deadlines
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No upcoming deadlines for this tour</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deadline Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Days Remaining</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deadlines.map((deadline) => (
                  <TableRow 
                    key={deadline.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleDeadlineClick(deadline)}
                  >
                    <TableCell className="font-medium">{deadline.title}</TableCell>
                    <TableCell>{deadline.description}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getPriorityColor(deadline.priority)}`}
                      >
                        {getDaysUntil(deadline.date)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateToDDMMYYYY(deadline.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
