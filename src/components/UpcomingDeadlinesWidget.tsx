
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, AlertTriangle, DollarSign, Calendar } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface Deadline {
  id: string;
  type: 'payment' | 'tour_start' | 'instalment' | 'final_payment';
  title: string;
  date: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  tourName?: string;
  tourId?: string;
}

export const UpcomingDeadlinesWidget = () => {
  const { data: tours } = useTours();
  const { data: bookings } = useBookings();

  const getDeadlines = (): Deadline[] => {
    const deadlines: Deadline[] = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    // Tour start dates
    tours?.forEach(tour => {
      const startDate = new Date(tour.start_date);
      if (startDate >= today && startDate <= thirtyDaysFromNow) {
        const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        deadlines.push({
          id: `tour-start-${tour.id}`,
          type: 'tour_start',
          title: 'Tour Starting',
          date: tour.start_date,
          description: tour.name,
          priority: daysUntil <= 7 ? 'high' : daysUntil <= 14 ? 'medium' : 'low',
          tourName: tour.name,
          tourId: tour.id,
        });
      }

      // Instalment dates
      if (tour.instalment_date) {
        const instalmentDate = new Date(tour.instalment_date);
        if (instalmentDate >= today && instalmentDate <= thirtyDaysFromNow) {
          const daysUntil = Math.ceil((instalmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          deadlines.push({
            id: `instalment-${tour.id}`,
            type: 'instalment',
            title: 'Instalment Due',
            date: tour.instalment_date,
            description: `${tour.name} - $${tour.instalment_amount}`,
            priority: daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
            tourName: tour.name,
            tourId: tour.id,
          });
        }
      }

      // Final payment dates
      if (tour.final_payment_date) {
        const finalDate = new Date(tour.final_payment_date);
        if (finalDate >= today && finalDate <= thirtyDaysFromNow) {
          const daysUntil = Math.ceil((finalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          deadlines.push({
            id: `final-payment-${tour.id}`,
            type: 'final_payment',
            title: 'Final Payment Due',
            date: tour.final_payment_date,
            description: tour.name,
            priority: daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
            tourName: tour.name,
            tourId: tour.id,
          });
        }
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
    if (daysUntil < 0) return 'Overdue';
    return `${daysUntil} days`;
  };

  const handleRowClick = (deadline: Deadline) => {
    if (deadline.tourId) {
      // Navigate to tours tab and potentially open tour details
      // For now, we'll dispatch a custom event to navigate to tours
      window.dispatchEvent(new CustomEvent('navigate-to-tours', { detail: { tourId: deadline.tourId } }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Upcoming Deadlines
        </CardTitle>
        <CardDescription>
          Important dates and payment deadlines in the next 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No upcoming deadlines in the next 30 days</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Tour Name</TableHead>
                <TableHead>Days Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deadlines.slice(0, 8).map((deadline) => (
                <TableRow
                  key={deadline.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleRowClick(deadline)}
                >
                  <TableCell className="font-medium">{deadline.title}</TableCell>
                  <TableCell>{formatDateToDDMMYYYY(deadline.date)}</TableCell>
                  <TableCell>{deadline.tourName || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getPriorityColor(deadline.priority)}`}
                    >
                      {getDaysUntil(deadline.date)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {deadlines.length > 8 && (
          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              +{deadlines.length - 8} more deadlines
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
