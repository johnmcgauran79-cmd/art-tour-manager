import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateToAustralian } from "@/lib/utils";
import { Save, Users } from "lucide-react";

interface Hotel {
  id: string;
  name: string;
}

interface BulkRoomingEditModalProps {
  hotel: Hotel | null;
  tourId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RoomingData {
  hotel_booking_id: string;
  lead_passenger: string;
  additional_passengers: string[];
  check_in_date: string;
  check_out_date: string;
  bedding: string;
  room_type: string;
}

export const BulkRoomingEditModal = ({ hotel, tourId, open, onOpenChange }: BulkRoomingEditModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedData, setEditedData] = useState<RoomingData[]>([]);

  // Fetch hotel bookings for this specific hotel and tour
  const { data: hotelBookingsData = [], isLoading } = useQuery({
    queryKey: ['bulk-hotel-bookings', hotel?.id, tourId],
    queryFn: async () => {
      if (!hotel?.id) return [];
      
      const { data, error } = await supabase
        .from('hotel_bookings')
        .select(`
          id,
          check_in_date,
          check_out_date,
          bedding,
          room_type,
          bookings!inner (
            id,
            tour_id,
            passenger_2_name,
            passenger_3_name,
            status,
            customers (first_name, last_name)
          )
        `)
        .eq('hotel_id', hotel.id)
        .eq('allocated', true)
        .eq('bookings.tour_id', tourId)
        .neq('bookings.status', 'cancelled')
        .order('id', { ascending: true });
      
      if (error) {
        console.error('Error fetching hotel bookings for bulk edit:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!hotel?.id && !!tourId && open,
  });

  // Transform data for editing
  useEffect(() => {
    if (hotelBookingsData.length > 0) {
      const transformedData: RoomingData[] = hotelBookingsData.map((hotelBooking) => {
        const booking = hotelBooking.bookings;
        const additionalPassengers = [
          booking.passenger_2_name,
          booking.passenger_3_name
        ].filter(Boolean);

        return {
          hotel_booking_id: hotelBooking.id,
          lead_passenger: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim(),
          additional_passengers: additionalPassengers,
          check_in_date: hotelBooking.check_in_date || '',
          check_out_date: hotelBooking.check_out_date || '',
          bedding: hotelBooking.bedding || 'double',
          room_type: hotelBooking.room_type || '',
        };
      });
      setEditedData(transformedData);
    }
  }, [hotelBookingsData]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedBookings: RoomingData[]) => {
      const updates = updatedBookings.map(booking => ({
        id: booking.hotel_booking_id,
        check_in_date: booking.check_in_date || null,
        check_out_date: booking.check_out_date || null,
        bedding: booking.bedding as 'single' | 'double' | 'twin',
        room_type: booking.room_type,
        nights: booking.check_in_date && booking.check_out_date 
          ? Math.ceil((new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / (1000 * 60 * 60 * 24))
          : null
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('hotel_bookings')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Room details updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['bulk-hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings-for-rooming'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update room details",
        variant: "destructive",
      });
      console.error('Error updating hotel bookings:', error);
    },
  });

  const handleFieldChange = (index: number, field: keyof RoomingData, value: string) => {
    setEditedData(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleSave = () => {
    updateMutation.mutate(editedData);
  };

  // Calculate totals
  const totalRoomNights = editedData.reduce((total, room) => {
    if (room.check_in_date && room.check_out_date) {
      const nights = Math.ceil((new Date(room.check_out_date).getTime() - new Date(room.check_in_date).getTime()) / (1000 * 60 * 60 * 24));
      return total + (nights > 0 ? nights : 0);
    }
    return total;
  }, 0);

  const beddingCounts = editedData.reduce((counts, room) => {
    const bedding = room.bedding || 'double';
    counts[bedding] = (counts[bedding] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  if (!hotel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bulk Edit Rooming - {hotel.name}
            </DialogTitle>
            <div className="flex gap-2">
              <Button 
                onClick={handleSave} 
                disabled={updateMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p><strong>Hotel:</strong> {hotel.name}</p>
            <p><strong>Total Rooms:</strong> {editedData.length}</p>
            <p><strong>Total Room Nights:</strong> {totalRoomNights}</p>
            <p><strong>Bedding Types:</strong> Single: {beddingCounts.single || 0}, Twin: {beddingCounts.twin || 0}, Double: {beddingCounts.double || 0}</p>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading room data...</p>
          ) : editedData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No room allocations found for this hotel.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Passengers</TableHead>
                    <TableHead className="w-40">Check In</TableHead>
                    <TableHead className="w-40">Check Out</TableHead>
                    <TableHead className="w-32">Bedding</TableHead>
                    <TableHead className="w-48">Room Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editedData.map((room, index) => (
                    <TableRow key={room.hotel_booking_id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{room.lead_passenger}</div>
                          {room.additional_passengers.map((passenger, i) => (
                            <div key={i} className="text-sm text-muted-foreground">
                              {passenger}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={room.check_in_date}
                          onChange={(e) => handleFieldChange(index, 'check_in_date', e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={room.check_out_date}
                          onChange={(e) => handleFieldChange(index, 'check_out_date', e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={room.bedding}
                          onValueChange={(value) => handleFieldChange(index, 'bedding', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="double">Double</SelectItem>
                            <SelectItem value="twin">Twin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={room.room_type}
                          onChange={(e) => handleFieldChange(index, 'room_type', e.target.value)}
                          placeholder="Room type"
                          className="w-full"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};