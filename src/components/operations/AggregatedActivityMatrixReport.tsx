import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { AlertTriangle, Grid3X3, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AggregatedActivityMatrixReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DiscrepancyData {
  tourId: string;
  tourName: string;
  tourStartDate: string;
  bookingId: string;
  leadPassenger: string;
  passengerCount: number;
  groupName: string;
  status: string;
  activityId: string;
  activityName: string;
  activityDate: string;
  allocatedCount: number;
  discrepancyType: 'missing' | 'mismatch';
}

export const AggregatedActivityMatrixReport = ({ 
  open, 
  onOpenChange 
}: AggregatedActivityMatrixReportProps) => {
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fetchDiscrepancies();
    }
  }, [open]);

  const fetchDiscrepancies = async () => {
    setLoading(true);
    try {
      // Fetch all active tours with their activities
      const { data: tours, error: toursError } = await supabase
        .from('tours')
        .select('id, name, start_date, end_date')
        .not('status', 'in', '(archived,cancelled)')
        .order('start_date', { ascending: true });

      if (toursError) throw toursError;

      const allDiscrepancies: DiscrepancyData[] = [];

      for (const tour of tours || []) {
        // Fetch activities for this tour
        const { data: activities, error: activitiesError } = await supabase
          .from('activities')
          .select('id, name, activity_date')
          .eq('tour_id', tour.id)
          .order('activity_date', { ascending: true });

        if (activitiesError) throw activitiesError;

        if (!activities || activities.length === 0) continue;

        // Fetch bookings for this tour (excluding cancelled and waitlisted)
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            passenger_count,
            group_name,
            status,
            lead_passenger_id,
            customers!bookings_lead_passenger_id_fkey(first_name, last_name)
          `)
          .eq('tour_id', tour.id)
          .not('status', 'in', '(cancelled,waitlisted)');

        if (bookingsError) throw bookingsError;

        if (!bookings || bookings.length === 0) continue;

        // Fetch activity allocations for these bookings
        const bookingIds = bookings.map(b => b.id);
        const activityIds = activities.map(a => a.id);

        const { data: activityBookings, error: abError } = await supabase
          .from('activity_bookings')
          .select('booking_id, activity_id, passengers_attending')
          .in('booking_id', bookingIds)
          .in('activity_id', activityIds);

        if (abError) throw abError;

        // Check for discrepancies
        for (const booking of bookings) {
          const customer = booking.customers as any;
          const leadPassenger = customer 
            ? `${customer.first_name} ${customer.last_name}`
            : 'Unknown';

          for (const activity of activities) {
            const allocation = activityBookings?.find(
              ab => ab.booking_id === booking.id && ab.activity_id === activity.id
            );

            const allocatedCount = allocation?.passengers_attending || 0;

            if (allocatedCount === 0) {
              // Missing allocation
              allDiscrepancies.push({
                tourId: tour.id,
                tourName: tour.name,
                tourStartDate: tour.start_date,
                bookingId: booking.id,
                leadPassenger,
                passengerCount: booking.passenger_count,
                groupName: booking.group_name || '',
                status: booking.status,
                activityId: activity.id,
                activityName: activity.name,
                activityDate: activity.activity_date || '',
                allocatedCount: 0,
                discrepancyType: 'missing'
              });
            } else if (allocatedCount !== booking.passenger_count) {
              // Mismatch
              allDiscrepancies.push({
                tourId: tour.id,
                tourName: tour.name,
                tourStartDate: tour.start_date,
                bookingId: booking.id,
                leadPassenger,
                passengerCount: booking.passenger_count,
                groupName: booking.group_name || '',
                status: booking.status,
                activityId: activity.id,
                activityName: activity.name,
                activityDate: activity.activity_date || '',
                allocatedCount,
                discrepancyType: 'mismatch'
              });
            }
          }
        }
      }

      setDiscrepancies(allDiscrepancies);
    } catch (error) {
      console.error('Error fetching activity discrepancies:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (type: 'missing' | 'mismatch') => {
    switch (type) {
      case 'missing':
        return 'bg-destructive/10 text-destructive hover:bg-destructive/20';
      case 'mismatch':
        return 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20';
    }
  };

  const handleViewBooking = (tourId: string, bookingId: string) => {
    navigate(`/tours/${tourId}?tab=bookings&booking=${bookingId}`);
    onOpenChange(false);
  };

  const groupedByTour = discrepancies.reduce((acc, item) => {
    if (!acc[item.tourId]) {
      acc[item.tourId] = {
        tourName: item.tourName,
        tourStartDate: item.tourStartDate,
        discrepancies: []
      };
    }
    acc[item.tourId].discrepancies.push(item);
    return acc;
  }, {} as Record<string, { tourName: string; tourStartDate: string; discrepancies: DiscrepancyData[] }>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Grid3X3 className="h-6 w-6 text-brand-navy" />
            Activity Allocation Matrix - All Tours
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          </div>
        ) : discrepancies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg font-semibold text-green-600">All Clear! ✓</p>
            <p className="text-muted-foreground mt-2">
              No activity allocation discrepancies found across all active tours.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">
                    {discrepancies.length} Discrepancies Found
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Activity allocations don't match booking passenger counts across {Object.keys(groupedByTour).length} tour(s).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-destructive"></div>
                <span>Missing Allocation (0 pax)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-500"></div>
                <span>Mismatch (incorrect pax count)</span>
              </div>
            </div>

            {Object.entries(groupedByTour).map(([tourId, tourData]) => (
              <div key={tourId} className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-4">
                  <h3 className="font-semibold text-lg">{tourData.tourName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDateToDDMMYYYY(tourData.tourStartDate)} • {tourData.discrepancies.length} discrepancies
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead Passenger</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead className="text-center">Booking Pax</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Allocated</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tourData.discrepancies.map((disc, idx) => (
                      <TableRow key={`${disc.bookingId}-${disc.activityId}-${idx}`}>
                        <TableCell className="font-medium">{disc.leadPassenger}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {disc.groupName || '-'}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {disc.passengerCount}
                        </TableCell>
                        <TableCell>{disc.activityName}</TableCell>
                        <TableCell className="text-sm">
                          {disc.activityDate ? formatDateToDDMMYYYY(disc.activityDate) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getStatusColor(disc.discrepancyType)}>
                            {disc.allocatedCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(disc.discrepancyType)}>
                            {disc.discrepancyType === 'missing' ? 'Missing' : 'Mismatch'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewBooking(disc.tourId, disc.bookingId)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
