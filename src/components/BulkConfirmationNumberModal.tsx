import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Hash } from "lucide-react";

interface Hotel {
  id: string;
  name: string;
}

interface BulkConfirmationNumberModalProps {
  hotel: Hotel | null;
  tourId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConfirmationRow {
  hotel_booking_id: string;
  lead_passenger: string;
  additional_passengers: string[];
  confirmation_number: string;
}

export const BulkConfirmationNumberModal = ({ hotel, tourId, open, onOpenChange }: BulkConfirmationNumberModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedData, setEditedData] = useState<ConfirmationRow[]>([]);

  const { data: hotelBookingsData = [], isLoading } = useQuery({
    queryKey: ['bulk-confirmation-numbers', hotel?.id, tourId],
    queryFn: async () => {
      if (!hotel?.id) return [];

      const { data, error } = await supabase
        .from('hotel_bookings')
        .select(`
          id,
          confirmation_number,
          bookings!inner (
            id,
            tour_id,
            passenger_2_name,
            passenger_3_name,
            status,
            customers!lead_passenger_id (first_name, last_name)
          )
        `)
        .eq('hotel_id', hotel.id)
        .eq('allocated', true)
        .is('cancelled_at', null)
        .eq('bookings.tour_id', tourId)
        .not('bookings.status', 'in', '("cancelled","waitlisted")')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching hotel bookings for confirmation numbers:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!hotel?.id && !!tourId && open,
  });

  useEffect(() => {
    const transformed: ConfirmationRow[] = (hotelBookingsData as any[]).map((hotelBooking) => {
      const booking = hotelBooking.bookings;
      const additionalPassengers = [
        booking.passenger_2_name,
        booking.passenger_3_name,
      ].filter(Boolean);

      return {
        hotel_booking_id: hotelBooking.id,
        lead_passenger: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim(),
        additional_passengers: additionalPassengers,
        confirmation_number: hotelBooking.confirmation_number || '',
      };
    });
    setEditedData(transformed);
  }, [hotelBookingsData]);

  const updateMutation = useMutation({
    mutationFn: async (rows: ConfirmationRow[]) => {
      for (const row of rows) {
        const { error } = await supabase
          .from('hotel_bookings')
          .update({ confirmation_number: row.confirmation_number.trim() || null })
          .eq('id', row.hotel_booking_id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Confirmation numbers updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['bulk-confirmation-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update confirmation numbers",
        variant: "destructive",
      });
      console.error('Error updating confirmation numbers:', error);
    },
  });

  const handleFieldChange = (index: number, value: string) => {
    setEditedData((prev) => prev.map((item, i) => (i === index ? { ...item, confirmation_number: value } : item)));
  };

  const handleSave = () => {
    updateMutation.mutate(editedData);
  };

  if (!hotel) return null;

  const filledCount = editedData.filter((r) => r.confirmation_number.trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Bulk Confirmation Numbers - {hotel.name}
            </DialogTitle>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || isLoading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p><strong>Hotel:</strong> {hotel.name}</p>
            <p><strong>Bookings:</strong> {editedData.length} &nbsp;|&nbsp; <strong>With confirmation number:</strong> {filledCount}</p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading bookings...</p>
          ) : editedData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No bookings allocated to this hotel.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Passenger</TableHead>
                  <TableHead>Additional Passengers</TableHead>
                  <TableHead className="w-[260px]">Confirmation Number</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editedData.map((row, index) => (
                  <TableRow key={row.hotel_booking_id}>
                    <TableCell className="font-medium">{row.lead_passenger || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.additional_passengers.length > 0 ? row.additional_passengers.join(', ') : '—'}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.confirmation_number}
                        onChange={(e) => handleFieldChange(index, e.target.value)}
                        placeholder="Enter confirmation number"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};