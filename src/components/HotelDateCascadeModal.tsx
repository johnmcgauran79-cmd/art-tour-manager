import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface AffectedBooking {
  hotelBookingId: string;
  bookingId: string;
  customerName: string;
  groupName: string | null;
  passengerCount: number;
  currentCheckIn: string | null;
  currentCheckOut: string | null;
  matchesOldDefaults: boolean;
  proposedCheckIn: string;
  proposedCheckOut: string;
  hasCustomDates: boolean;
  status: string;
}

interface HotelDateCascadeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  hotelName: string;
  oldCheckIn: string;
  oldCheckOut: string;
  newCheckIn: string;
  newCheckOut: string;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
};

const calculateNights = (checkIn: string, checkOut: string) => {
  if (!checkIn || !checkOut) return null;
  return Math.floor(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );
};

export const HotelDateCascadeModal = ({
  open,
  onOpenChange,
  hotelId,
  hotelName,
  oldCheckIn,
  oldCheckOut,
  newCheckIn,
  newCheckOut,
}: HotelDateCascadeModalProps) => {
  const [affectedBookings, setAffectedBookings] = useState<AffectedBooking[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate offset in days between old and new dates
  const dayOffset = Math.round(
    (new Date(newCheckIn).getTime() - new Date(oldCheckIn).getTime()) / (1000 * 60 * 60 * 24)
  );

  useEffect(() => {
    if (open) {
      loadAffectedBookings();
    }
  }, [open, hotelId]);

  const loadAffectedBookings = async () => {
    setLoading(true);
    try {
      const { data: hotelBookings, error } = await supabase
        .from("hotel_bookings")
        .select(`
          id,
          booking_id,
          check_in_date,
          check_out_date,
          bookings!inner (
            id,
            group_name,
            passenger_count,
            status,
            lead_passenger_id,
            customers!lead_passenger_id (first_name, last_name)
          )
        `)
        .eq("hotel_id", hotelId);

      if (error) throw error;

      const bookings: AffectedBooking[] = (hotelBookings || []).map((hb: any) => {
        const booking = hb.bookings;
        const customer = booking?.customers;
        const matchesOldDefaults =
          hb.check_in_date === oldCheckIn && hb.check_out_date === oldCheckOut;
        const hasCustomDates = !matchesOldDefaults;

        // For bookings matching defaults, use new defaults directly
        // For custom dates, shift by the same offset
        let proposedCheckIn: string;
        let proposedCheckOut: string;

        if (matchesOldDefaults) {
          proposedCheckIn = newCheckIn;
          proposedCheckOut = newCheckOut;
        } else {
          // Shift custom dates by the same offset
          const currentIn = new Date(hb.check_in_date);
          const currentOut = new Date(hb.check_out_date);
          currentIn.setDate(currentIn.getDate() + dayOffset);
          currentOut.setDate(currentOut.getDate() + dayOffset);
          proposedCheckIn = currentIn.toISOString().split("T")[0];
          proposedCheckOut = currentOut.toISOString().split("T")[0];
        }

        return {
          hotelBookingId: hb.id,
          bookingId: booking.id,
          customerName: customer
            ? `${customer.first_name} ${customer.last_name}`
            : "Unknown",
          groupName: booking.group_name,
          passengerCount: booking.passenger_count,
          currentCheckIn: hb.check_in_date,
          currentCheckOut: hb.check_out_date,
          matchesOldDefaults,
          proposedCheckIn,
          proposedCheckOut,
          hasCustomDates,
          status: booking.status,
        };
      });

      setAffectedBookings(bookings);

      // Pre-select bookings that match old defaults (standard dates)
      const preSelected = new Set(
        bookings
          .filter((b) => b.matchesOldDefaults && b.status !== "cancelled")
          .map((b) => b.hotelBookingId)
      );
      setSelectedIds(preSelected);
    } catch (err: any) {
      console.error("Error loading affected bookings:", err);
      toast({
        title: "Error",
        description: "Failed to load affected bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = affectedBookings
      .filter((b) => b.status !== "cancelled")
      .map((b) => b.hotelBookingId);
    setSelectedIds(new Set(allIds));
  };

  const selectNone = () => setSelectedIds(new Set());

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      onOpenChange(false);
      return;
    }

    setProcessing(true);
    try {
      const selected = affectedBookings.filter((b) =>
        selectedIds.has(b.hotelBookingId)
      );

      // Update each selected hotel_booking
      for (const booking of selected) {
        const nights = calculateNights(
          booking.proposedCheckIn,
          booking.proposedCheckOut
        );

        const { error } = await supabase
          .from("hotel_bookings")
          .update({
            check_in_date: booking.proposedCheckIn,
            check_out_date: booking.proposedCheckOut,
            nights,
          })
          .eq("id", booking.hotelBookingId);

        if (error) {
          console.error("Error updating hotel booking:", booking.hotelBookingId, error);
        }
      }

      // Recalculate parent booking dates for affected bookings
      const uniqueBookingIds = [...new Set(selected.map((b) => b.bookingId))];
      for (const bookingId of uniqueBookingIds) {
        // Get all hotel bookings for this booking to recalculate
        const { data: allHotelBookings } = await supabase
          .from("hotel_bookings")
          .select("check_in_date, check_out_date, allocated")
          .eq("booking_id", bookingId);

        if (allHotelBookings && allHotelBookings.length > 0) {
          const allocated = allHotelBookings.filter((hb) => hb.allocated !== false);
          const checkIns = allocated
            .map((hb) => hb.check_in_date)
            .filter(Boolean)
            .sort();
          const checkOuts = allocated
            .map((hb) => hb.check_out_date)
            .filter(Boolean)
            .sort();

          if (checkIns.length > 0 && checkOuts.length > 0) {
            const earliest = checkIns[0];
            const latest = checkOuts[checkOuts.length - 1];
            const totalNights = calculateNights(earliest!, latest!);

            await supabase
              .from("bookings")
              .update({
                check_in_date: earliest,
                check_out_date: latest,
                total_nights: totalNights,
              })
              .eq("id", bookingId);
          }
        }
      }

      toast({
        title: "Dates Updated",
        description: `Updated ${selected.length} hotel booking(s) and recalculated booking dates.`,
      });

      queryClient.invalidateQueries({ queryKey: ["hotel-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error cascading hotel dates:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update booking dates",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const standardBookings = affectedBookings.filter((b) => !b.hasCustomDates);
  const customBookings = affectedBookings.filter((b) => b.hasCustomDates);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Booking Dates — {hotelName}</DialogTitle>
          <DialogDescription>
            Hotel dates changed. Select which bookings should be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm space-y-1 p-3 rounded-md bg-muted">
          <div className="flex items-center gap-2">
            <span className="font-medium">Check-in:</span>
            <span>{formatDate(oldCheckIn)}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-primary">{formatDate(newCheckIn)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Check-out:</span>
            <span>{formatDate(oldCheckOut)}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-primary">{formatDate(newCheckOut)}</span>
          </div>
          {dayOffset !== 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Dates shifted by {dayOffset > 0 ? "+" : ""}{dayOffset} day(s)
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : affectedBookings.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No bookings are allocated to this hotel.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={selectAll}>
                Select All
              </Button>
              <span>·</span>
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={selectNone}>
                Deselect All
              </Button>
              <span className="ml-auto text-muted-foreground">
                {selectedIds.size} of {affectedBookings.filter(b => b.status !== 'cancelled').length} selected
              </span>
            </div>

            {/* Standard bookings (matching old defaults) */}
            {standardBookings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Standard Dates (match hotel defaults)</h4>
                {standardBookings.map((b) => (
                  <BookingRow
                    key={b.hotelBookingId}
                    booking={b}
                    selected={selectedIds.has(b.hotelBookingId)}
                    onToggle={() => toggleSelection(b.hotelBookingId)}
                  />
                ))}
              </div>
            )}

            {/* Custom date bookings */}
            {customBookings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h4 className="text-sm font-medium">Custom Dates (extra nights / modified)</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  These bookings have dates different from the hotel defaults. They will be shifted
                  by {dayOffset > 0 ? "+" : ""}{dayOffset} day(s) to preserve extra nights.
                </p>
                {customBookings.map((b) => (
                  <BookingRow
                    key={b.hotelBookingId}
                    booking={b}
                    selected={selectedIds.has(b.hotelBookingId)}
                    onToggle={() => toggleSelection(b.hotelBookingId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Skip
          </Button>
          <Button onClick={handleApply} disabled={processing || selectedIds.size === 0}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update {selectedIds.size} Booking{selectedIds.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BookingRow = ({
  booking,
  selected,
  onToggle,
}: {
  booking: AffectedBooking;
  selected: boolean;
  onToggle: () => void;
}) => {
  const isCancelled = booking.status === "cancelled";

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-md border text-sm ${
        isCancelled ? "opacity-50" : ""
      }`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        disabled={isCancelled}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {booking.groupName || booking.customerName}
          </span>
          <span className="text-muted-foreground">({booking.passengerCount} pax)</span>
          {booking.hasCustomDates && (
            <Badge variant="outline" className="text-xs">Extra nights</Badge>
          )}
          {isCancelled && (
            <Badge variant="secondary" className="text-xs">Cancelled</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span>
            {formatDate(booking.currentCheckIn)} – {formatDate(booking.currentCheckOut)}
          </span>
          <ArrowRight className="h-3 w-3" />
          <span className="text-foreground font-medium">
            {formatDate(booking.proposedCheckIn)} – {formatDate(booking.proposedCheckOut)}
          </span>
        </div>
      </div>
    </div>
  );
};
