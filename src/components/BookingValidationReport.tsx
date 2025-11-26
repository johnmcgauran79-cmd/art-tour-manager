import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface BookingValidationReportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const BookingValidationReport = ({ open, onOpenChange }: BookingValidationReportProps = {}) => {
  const navigate = useNavigate();

  const { data: invalidBookings, isLoading, refetch } = useQuery({
    queryKey: ['booking-validation-report'],
    queryFn: async () => {
      // Fetch all bookings with hotel bookings and tour info
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          group_name,
          passenger_count,
          status,
          tour_id,
          tours (id, name),
          customers!lead_passenger_id (first_name, last_name),
          hotel_bookings (
            id,
            bedding,
            allocated,
            hotels (name)
          )
        `)
        .neq('status', 'cancelled');

      if (error) throw error;

      // Filter for mismatches
      const mismatches = data?.filter(booking => {
        const allocatedHotels = booking.hotel_bookings?.filter(hb => hb.allocated) || [];
        
        if (allocatedHotels.length === 0) return false;

        // Check for mismatch
        if (booking.passenger_count === 1) {
          // Single passenger should only have 'single' bedding
          return allocatedHotels.some(hb => hb.bedding !== 'single');
        } else if (booking.passenger_count >= 2) {
          // Multiple passengers should NOT have 'single' bedding
          return allocatedHotels.some(hb => hb.bedding === 'single');
        }
        return false;
      });

      return mismatches || [];
    },
    enabled: open !== false,
  });

  const getBeddingBadgeVariant = (bedding: string, passengerCount: number) => {
    if (passengerCount === 1 && bedding !== 'single') return 'destructive';
    if (passengerCount >= 2 && bedding === 'single') return 'destructive';
    return 'secondary';
  };

  const getIssueDescription = (booking: any) => {
    if (booking.passenger_count === 1) {
      return "Single passenger with non-single bedding";
    } else {
      return "Multiple passengers with single bedding";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Booking Validation Report
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Bookings with mismatched passenger counts and room types
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto max-h-[60vh]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : invalidBookings && invalidBookings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tour</TableHead>
                  <TableHead>Lead Passenger</TableHead>
                  <TableHead>Group Name</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Bedding</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invalidBookings.map((booking: any) => {
                  const allocatedHotels = booking.hotel_bookings?.filter((hb: any) => hb.allocated) || [];
                  const leadPassenger = booking.customers;
                  
                  return allocatedHotels.map((hb: any, index: number) => (
                    <TableRow key={`${booking.id}-${hb.id}`}>
                      {index === 0 && (
                        <>
                          <TableCell rowSpan={allocatedHotels.length}>
                            {booking.tours?.name || 'N/A'}
                          </TableCell>
                          <TableCell rowSpan={allocatedHotels.length}>
                            {leadPassenger ? `${leadPassenger.first_name} ${leadPassenger.last_name}` : 'N/A'}
                          </TableCell>
                          <TableCell rowSpan={allocatedHotels.length}>
                            {booking.group_name || '-'}
                          </TableCell>
                          <TableCell rowSpan={allocatedHotels.length}>
                            <Badge variant="outline">{booking.passenger_count}</Badge>
                          </TableCell>
                        </>
                      )}
                      <TableCell>{hb.hotels?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getBeddingBadgeVariant(hb.bedding, booking.passenger_count)}>
                          {hb.bedding}
                        </Badge>
                      </TableCell>
                      {index === 0 && (
                        <>
                          <TableCell rowSpan={allocatedHotels.length} className="text-destructive text-sm">
                            {getIssueDescription(booking)}
                          </TableCell>
                          <TableCell rowSpan={allocatedHotels.length}>
                            <Badge variant="secondary">{booking.status}</Badge>
                          </TableCell>
                          <TableCell rowSpan={allocatedHotels.length}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigate(`/bookings/${booking.id}/edit`);
                                onOpenChange(false);
                              }}
                            >
                              Fix
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg font-medium">No validation issues found</p>
              <p className="text-sm">All bookings have matching passenger counts and room types</p>
            </div>
          )}
        </div>

        {invalidBookings && invalidBookings.length > 0 && (
          <div className="border-t pt-4 text-sm text-muted-foreground">
            Found {invalidBookings.length} booking{invalidBookings.length !== 1 ? 's' : ''} with validation issues
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
