
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useHotels } from "@/hooks/useHotels";
import { useHotelBookings, useCreateHotelBooking, useUpdateHotelBooking, useRemoveHotelAllocation, useCleanupDuplicateHotelBookings } from "@/hooks/useHotelBookings";
import { useUpdateBooking } from "@/hooks/useBookings";

interface HotelAllocationSectionProps {
  tourId: string;
  bookingId: string;
  accommodationRequired: boolean;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  onUpdate?: () => void;
}

export const HotelAllocationSection = ({ 
  tourId, 
  bookingId, 
  accommodationRequired, 
  defaultCheckIn, 
  defaultCheckOut,
  onUpdate
}: HotelAllocationSectionProps) => {
  const { data: hotels = [] } = useHotels(tourId);
  const { data: hotelBookings = [], refetch: refetchHotelBookings } = useHotelBookings(bookingId);
  const createHotelBooking = useCreateHotelBooking();
  const updateHotelBooking = useUpdateHotelBooking();
  const removeHotelAllocation = useRemoveHotelAllocation();
  const cleanupDuplicates = useCleanupDuplicateHotelBookings();
  const updateBooking = useUpdateBooking();

  const [editingFields, setEditingFields] = useState<{[key: string]: any}>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<{[key: string]: boolean}>({});

  const updateBookingDates = async (bookingsToCheck = hotelBookings) => {
    console.log('Updating booking dates, hotel bookings:', bookingsToCheck);
    
    // Get all allocated hotel bookings
    const allocatedHotelBookings = bookingsToCheck.filter(hb => hb.allocated);
    console.log('Allocated hotel bookings:', allocatedHotelBookings);
    
    if (allocatedHotelBookings.length === 0) return;

    // Find earliest check-in and latest check-out using proper date comparison
    const validCheckInDates = allocatedHotelBookings
      .map(hb => hb.check_in_date)
      .filter(date => date !== null)
      .map(date => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());
    
    const validCheckOutDates = allocatedHotelBookings
      .map(hb => hb.check_out_date)
      .filter(date => date !== null)
      .map(date => new Date(date))
      .sort((a, b) => b.getTime() - a.getTime());

    if (validCheckInDates.length === 0 || validCheckOutDates.length === 0) return;

    const earliestCheckIn = validCheckInDates[0].toISOString().split('T')[0];
    const latestCheckOut = validCheckOutDates[0].toISOString().split('T')[0];

    console.log('Calculated dates - earliest check-in:', earliestCheckIn, 'latest check-out:', latestCheckOut);

    // Update the booking with new dates
    updateBooking.mutate({
      id: bookingId,
      check_in_date: earliestCheckIn,
      check_out_date: latestCheckOut,
    });
  };

  const handleHotelAllocation = (hotelId: string, allocated: boolean) => {
    const existingHotelBookings = hotelBookings.filter(hb => hb.hotel_id === hotelId);
    const hotel = hotels.find(h => h.id === hotelId);
    
    console.log(`Hotel allocation toggle: ${allocated ? 'allocating' : 'removing'} hotel ${hotelId} for booking ${bookingId}`);
    console.log('Existing hotel bookings for this hotel:', existingHotelBookings);
    
    if (!allocated) {
      // Use the safe removal hook that handles duplicates
      removeHotelAllocation.mutate({
        bookingId,
        hotelId,
      }, {
        onSuccess: async () => {
          onUpdate?.();
          // Refetch hotel bookings and then update booking dates
          const { data: updatedHotelBookings } = await refetchHotelBookings();
          if (updatedHotelBookings) {
            updateBookingDates(updatedHotelBookings);
          }
        }
      });
    } else if (allocated) {
      // Check if there are any existing bookings (allocated or not) before creating
      if (existingHotelBookings.length > 0) {
        // If there are existing bookings, just update the first one to allocated
        const bookingToUpdate = existingHotelBookings[0];
        console.log('Updating existing hotel booking to allocated:', bookingToUpdate.id);
        
        updateHotelBooking.mutate({
          id: bookingToUpdate.id,
          allocated: true,
          check_in_date: hotel?.default_check_in || defaultCheckIn,
          check_out_date: hotel?.default_check_out || defaultCheckOut,
          room_type: hotel?.default_room_type || bookingToUpdate.room_type,
          bedding: bookingToUpdate.bedding || 'double',
          required: true,
        }, {
          onSuccess: async () => {
            onUpdate?.();
            // If there were multiple existing bookings, clean them up
            if (existingHotelBookings.length > 1) {
              console.log(`Found ${existingHotelBookings.length} existing hotel bookings, cleaning up duplicates`);
              cleanupDuplicates.mutate({
                bookingId,
                hotelId,
                keepId: bookingToUpdate.id,
              });
            }
            // Refetch hotel bookings and then update booking dates
            const { data: updatedHotelBookings } = await refetchHotelBookings();
            if (updatedHotelBookings) {
              updateBookingDates(updatedHotelBookings);
            }
          }
        });
      } else {
        // Create new hotel booking
        console.log('Creating new hotel booking');
        createHotelBooking.mutate({
          booking_id: bookingId,
          hotel_id: hotelId,
          allocated: true,
          check_in_date: hotel?.default_check_in || defaultCheckIn,
          check_out_date: hotel?.default_check_out || defaultCheckOut,
          room_type: hotel?.default_room_type,
          bedding: 'double',
          required: true,
        }, {
          onSuccess: async () => {
            onUpdate?.();
            // Refetch hotel bookings and then update booking dates
            const { data: updatedHotelBookings } = await refetchHotelBookings();
            if (updatedHotelBookings) {
              updateBookingDates(updatedHotelBookings);
            }
          }
        });
      }
    }
  };

  const handleFieldChange = (hotelBookingId: string, field: string, value: any) => {
    const fieldKey = `${hotelBookingId}-${field}`;
    console.log(`Field change: ${field} = ${value} for booking ${hotelBookingId}`);
    setEditingFields(prev => ({ ...prev, [fieldKey]: value }));
    setHasUnsavedChanges(prev => ({ ...prev, [hotelBookingId]: true }));
  };

  const saveAllChanges = async (hotelBookingId: string) => {
    console.log('Saving changes for hotel booking:', hotelBookingId);
    
    // Collect all changes for this hotel booking
    const updates: any = {};
    
    Object.keys(editingFields).forEach(key => {
      if (key.startsWith(`${hotelBookingId}-`)) {
        const field = key.replace(`${hotelBookingId}-`, '');
        updates[field] = editingFields[key];
      }
    });

    console.log('Updates to apply:', updates);

    if (Object.keys(updates).length === 0) {
      console.log('No updates to apply');
      return;
    }

    try {
      await updateHotelBooking.mutateAsync({
        id: hotelBookingId,
        ...updates,
      });

      onUpdate?.();
      setHasUnsavedChanges(prev => ({ ...prev, [hotelBookingId]: false }));
      
      // Clear editing fields for this hotel booking
      setEditingFields(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(key => {
          if (key.startsWith(`${hotelBookingId}-`)) {
            delete newState[key];
          }
        });
        return newState;
      });
      
      // If check-in or check-out date was updated, sync booking dates
      if (updates.check_in_date || updates.check_out_date) {
        // Refetch hotel bookings and then update booking dates
        const { data: updatedHotelBookings } = await refetchHotelBookings();
        if (updatedHotelBookings) {
          updateBookingDates(updatedHotelBookings);
        }
      }
    } catch (error) {
      console.error('Failed to save hotel booking changes:', error);
    }
  };

  const getFieldValue = (hotelBooking: any, field: string) => {
    const fieldKey = `${hotelBooking.id}-${field}`;
    return editingFields[fieldKey] !== undefined ? editingFields[fieldKey] : hotelBooking[field] || '';
  };

  if (!accommodationRequired) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Accommodation not required for this booking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Hotel Allocations</h3>
      {hotels.map((hotel) => {
        const hotelBookingsForHotel = hotelBookings.filter(hb => hb.hotel_id === hotel.id);
        const allocatedBooking = hotelBookingsForHotel.find(hb => hb.allocated);
        const isAllocated = !!allocatedBooking;
        const hotelBooking = allocatedBooking || hotelBookingsForHotel[0]; // Use allocated one or first one

        return (
          <Card key={hotel.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {hotel.name}
                <Switch
                  checked={isAllocated}
                  onCheckedChange={(checked) => handleHotelAllocation(hotel.id, checked)}
                />
              </CardTitle>
            </CardHeader>
            {isAllocated && hotelBooking && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Check In Date</Label>
                    <Input
                      type="date"
                      value={getFieldValue(hotelBooking, 'check_in_date')}
                      onChange={(e) => handleFieldChange(hotelBooking.id, 'check_in_date', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Check Out Date</Label>
                    <Input
                      type="date"
                      value={getFieldValue(hotelBooking, 'check_out_date')}
                      onChange={(e) => handleFieldChange(hotelBooking.id, 'check_out_date', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Nights</Label>
                    <Input value={hotelBooking.nights || 0} readOnly />
                  </div>
                  <div>
                    <Label>Bedding Type</Label>
                    <Select 
                      value={getFieldValue(hotelBooking, 'bedding')} 
                      onValueChange={(value) => handleFieldChange(hotelBooking.id, 'bedding', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="double">Double</SelectItem>
                        <SelectItem value="twin">Twin</SelectItem>
                        <SelectItem value="triple">Triple</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Room Type</Label>
                    <Input
                      value={getFieldValue(hotelBooking, 'room_type')}
                      onChange={(e) => handleFieldChange(hotelBooking.id, 'room_type', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Room Upgrade</Label>
                    <Input
                      value={getFieldValue(hotelBooking, 'room_upgrade')}
                      onChange={(e) => handleFieldChange(hotelBooking.id, 'room_upgrade', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Confirmation Number</Label>
                    <Input
                      value={getFieldValue(hotelBooking, 'confirmation_number')}
                      onChange={(e) => handleFieldChange(hotelBooking.id, 'confirmation_number', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Room Requests</Label>
                    <Textarea
                      value={getFieldValue(hotelBooking, 'room_requests')}
                      onChange={(e) => handleFieldChange(hotelBooking.id, 'room_requests', e.target.value)}
                    />
                  </div>
                </div>
                
                {hasUnsavedChanges[hotelBooking.id] && (
                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      onClick={() => saveAllChanges(hotelBooking.id)}
                      disabled={updateHotelBooking.isPending}
                      className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                    >
                      {updateHotelBooking.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};
