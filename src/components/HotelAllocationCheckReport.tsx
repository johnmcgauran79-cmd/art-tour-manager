import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, ExternalLink, Hotel } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface HotelAllocationCheckReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HotelAllocationCheckReport = ({ open, onOpenChange }: HotelAllocationCheckReportProps) => {
  const navigate = useNavigate();

  const { data: missingAllocations, isLoading } = useQuery({
    queryKey: ['hotel-allocation-check-report'],
    queryFn: async () => {
      // Get all bookings with accommodation required
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          passenger_count,
          status,
          tour_id,
          accommodation_required,
          lead_passenger_id,
          customers!bookings_lead_passenger_id_fkey (
            first_name,
            last_name
          ),
          tours!bookings_tour_id_fkey (
            id,
            name,
            start_date
          )
        `)
        .eq('accommodation_required', true)
        .neq('status', 'cancelled')
        .order('tours(start_date)', { ascending: true });

      if (bookingsError) throw bookingsError;

      // Get all hotel bookings
      const { data: hotelBookings, error: hotelBookingsError } = await supabase
        .from('hotel_bookings')
        .select('booking_id');

      if (hotelBookingsError) throw hotelBookingsError;

      // Create a set of booking IDs that have hotel allocations
      const bookingsWithHotels = new Set(hotelBookings.map(hb => hb.booking_id));

      // Get tour hotel counts to identify tours that have hotels configured
      const { data: hotels, error: hotelsError } = await supabase
        .from('hotels')
        .select('tour_id, id, name');

      if (hotelsError) throw hotelsError;

      const tourHotels = hotels.reduce((acc, hotel) => {
        if (!acc[hotel.tour_id]) {
          acc[hotel.tour_id] = [];
        }
        acc[hotel.tour_id].push({ id: hotel.id, name: hotel.name });
        return acc;
      }, {} as Record<string, Array<{ id: string; name: string }>>);

      // Find bookings with missing hotel allocations
      const issues = bookings
        .filter(booking => !bookingsWithHotels.has(booking.id))
        .map(booking => ({
          bookingId: booking.id,
          tourId: booking.tour_id,
          tourName: booking.tours?.name || 'Unknown Tour',
          tourDate: booking.tours?.start_date || '',
          passengerName: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim(),
          passengerCount: booking.passenger_count,
          status: booking.status,
          hasHotelsConfigured: (tourHotels[booking.tour_id]?.length || 0) > 0,
          tourHotels: tourHotels[booking.tour_id] || []
        }));

      return issues;
    },
    enabled: open
  });

  const handleFixAllocations = async () => {
    if (!missingAllocations || missingAllocations.length === 0) return;

    try {
      // Only fix bookings where the tour has hotels configured
      const fixableBookings = missingAllocations.filter(b => b.hasHotelsConfigured);
      
      if (fixableBookings.length === 0) {
        toast.error('No bookings can be auto-fixed. Tours need hotels configured first.');
        return;
      }

      const allocationsToCreate = [];
      
      for (const issue of fixableBookings) {
        // Use the first hotel for the tour
        const hotel = issue.tourHotels[0];
        if (hotel) {
          // Get hotel details for default dates
          const { data: hotelDetails } = await supabase
            .from('hotels')
            .select('default_check_in, default_check_out')
            .eq('id', hotel.id)
            .single();

          allocationsToCreate.push({
            booking_id: issue.bookingId,
            hotel_id: hotel.id,
            allocated: true,
            required: true,
            check_in_date: hotelDetails?.default_check_in,
            check_out_date: hotelDetails?.default_check_out,
            bedding: issue.passengerCount === 1 ? 'single' : 'double'
          });
        }
      }

      if (allocationsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('hotel_bookings')
          .insert(allocationsToCreate);

        if (insertError) throw insertError;

        toast.success(`Fixed ${allocationsToCreate.length} bookings with missing hotel allocations`);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error fixing allocations:', error);
      toast.error('Failed to fix hotel allocations');
    }
  };

  const handleViewBooking = (tourId: string, bookingId: string) => {
    navigate(`/tours/${tourId}?tab=bookings&bookingId=${bookingId}`);
    onOpenChange(false);
  };

  const fixableCount = missingAllocations?.filter(b => b.hasHotelsConfigured).length || 0;
  const unfixableCount = missingAllocations?.filter(b => !b.hasHotelsConfigured).length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hotel className="h-5 w-5 text-brand-navy" />
            Hotel Allocation Check
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading hotel allocations...
          </div>
        ) : missingAllocations && missingAllocations.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900">
                Found <strong>{missingAllocations.length}</strong> booking(s) requiring accommodation but missing hotel allocations
              </p>
              {fixableCount > 0 && unfixableCount > 0 && (
                <p className="text-xs text-amber-700 mt-2">
                  • {fixableCount} can be auto-fixed • {unfixableCount} need hotels configured first
                </p>
              )}
            </div>

            <div className="space-y-3">
              {missingAllocations.map((issue) => (
                <Card key={issue.bookingId} className={`p-4 ${issue.hasHotelsConfigured ? 'border-amber-200' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="font-semibold text-brand-navy">
                        {issue.tourName}
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Passenger:</span>
                          <span className="font-medium">{issue.passengerName}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {issue.passengerCount} pax
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {issue.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Issue:</span>
                          {issue.hasHotelsConfigured ? (
                            <span className="text-amber-700">
                              No hotel allocated (tour has {issue.tourHotels.length} hotel{issue.tourHotels.length !== 1 ? 's' : ''})
                            </span>
                          ) : (
                            <span className="text-red-700 font-medium">
                              Tour has no hotels configured yet
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Tour Date: {new Date(issue.tourDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewBooking(issue.tourId, issue.bookingId)}
                      className="shrink-0"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              {fixableCount > 0 && (
                <Button 
                  onClick={handleFixAllocations}
                  className="flex-1"
                >
                  Fix {fixableCount} Allocation{fixableCount !== 1 ? 's' : ''}
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <h3 className="font-semibold text-lg mb-2">All Clear!</h3>
              <p className="text-muted-foreground">
                All bookings requiring accommodation have hotel allocations.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
