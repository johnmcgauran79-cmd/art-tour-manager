
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useHotels } from "@/hooks/useHotels";
import { useHotelBookings, useCreateHotelBooking, useUpdateHotelBooking } from "@/hooks/useHotelBookings";
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
  const { data: hotelBookings = [] } = useHotelBookings(bookingId);
  const createHotelBooking = useCreateHotelBooking();
  const updateHotelBooking = useUpdateHotelBooking();
  const updateBooking = useUpdateBooking();

  const [editingFields, setEditingFields] = useState<{[key: string]: any}>({});
  const [pendingUpdates, setPendingUpdates] = useState<{[key: string]: boolean}>({});

  const updateBookingDates = async () => {
    // Get all allocated hotel bookings
    const allocatedHotelBookings = hotelBookings.filter(hb => hb.allocated);
    
    if (allocatedHotelBookings.length === 0) return;

    // Find earliest check-in and latest check-out
    const checkInDates = allocatedHotelBookings
      .map(hb => hb.check_in_date)
      .filter(date => date !== null)
      .sort();
    
    const checkOutDates = allocatedHotelBookings
      .map(hb => hb.check_out_date)
      .filter(date => date !== null)
      .sort();

    if (checkInDates.length === 0 || checkOutDates.length === 0) return;

    const earliestCheckIn = checkInDates[0];
    const latestCheckOut = checkOutDates[checkOutDates.length - 1];

    // Update the booking with new dates
    updateBooking.mutate({
      id: bookingId,
      check_in_date: earliestCheckIn,
      check_out_date: latestCheckOut,
    });
  };

  const handleHotelAllocation = (hotelId: string, allocated: boolean) => {
    const existingHotelBooking = hotelBookings.find(hb => hb.hotel_id === hotelId);
    const hotel = hotels.find(h => h.id === hotelId);
    
    if (existingHotelBooking) {
      updateHotelBooking.mutate({
        id: existingHotelBooking.id,
        allocated,
      }, {
        onSuccess: () => {
          onUpdate?.();
          updateBookingDates();
        }
      });
    } else if (allocated) {
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
        onSuccess: () => {
          onUpdate?.();
          updateBookingDates();
        }
      });
    }
  };

  const handleFieldChange = (hotelBookingId: string, field: string, value: any) => {
    const fieldKey = `${hotelBookingId}-${field}`;
    setEditingFields(prev => ({ ...prev, [fieldKey]: value }));
    setPendingUpdates(prev => ({ ...prev, [fieldKey]: true }));
  };

  const saveFieldUpdate = (hotelBookingId: string, field: string) => {
    const fieldKey = `${hotelBookingId}-${field}`;
    const value = editingFields[fieldKey];
    
    updateHotelBooking.mutate({
      id: hotelBookingId,
      [field]: value,
    }, {
      onSuccess: () => {
        onUpdate?.();
        setPendingUpdates(prev => ({ ...prev, [fieldKey]: false }));
        setEditingFields(prev => {
          const newState = { ...prev };
          delete newState[fieldKey];
          return newState;
        });
        
        // If check-in or check-out date was updated, sync booking dates
        if (field === 'check_in_date' || field === 'check_out_date') {
          setTimeout(() => {
            updateBookingDates();
          }, 100); // Small delay to ensure hotel booking is updated first
        }
      }
    });
  };

  const getFieldValue = (hotelBooking: any, field: string) => {
    const fieldKey = `${hotelBooking.id}-${field}`;
    return editingFields[fieldKey] !== undefined ? editingFields[fieldKey] : hotelBooking[field] || '';
  };

  const hasPendingUpdate = (hotelBookingId: string, field: string) => {
    const fieldKey = `${hotelBookingId}-${field}`;
    return pendingUpdates[fieldKey] || false;
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
        const hotelBooking = hotelBookings.find(hb => hb.hotel_id === hotel.id);
        const isAllocated = hotelBooking?.allocated || false;

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
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={getFieldValue(hotelBooking, 'check_in_date')}
                        onChange={(e) => handleFieldChange(hotelBooking.id, 'check_in_date', e.target.value)}
                      />
                      {hasPendingUpdate(hotelBooking.id, 'check_in_date') && (
                        <Button 
                          size="sm" 
                          onClick={() => saveFieldUpdate(hotelBooking.id, 'check_in_date')}
                          disabled={updateHotelBooking.isPending}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Check Out Date</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={getFieldValue(hotelBooking, 'check_out_date')}
                        onChange={(e) => handleFieldChange(hotelBooking.id, 'check_out_date', e.target.value)}
                      />
                      {hasPendingUpdate(hotelBooking.id, 'check_out_date') && (
                        <Button 
                          size="sm" 
                          onClick={() => saveFieldUpdate(hotelBooking.id, 'check_out_date')}
                          disabled={updateHotelBooking.isPending}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Nights</Label>
                    <Input value={hotelBooking.nights || 0} readOnly />
                  </div>
                  <div>
                    <Label>Bedding Type</Label>
                    <div className="flex gap-2">
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
                      {hasPendingUpdate(hotelBooking.id, 'bedding') && (
                        <Button 
                          size="sm" 
                          onClick={() => saveFieldUpdate(hotelBooking.id, 'bedding')}
                          disabled={updateHotelBooking.isPending}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Room Type</Label>
                    <div className="flex gap-2">
                      <Input
                        value={getFieldValue(hotelBooking, 'room_type')}
                        onChange={(e) => handleFieldChange(hotelBooking.id, 'room_type', e.target.value)}
                      />
                      {hasPendingUpdate(hotelBooking.id, 'room_type') && (
                        <Button 
                          size="sm" 
                          onClick={() => saveFieldUpdate(hotelBooking.id, 'room_type')}
                          disabled={updateHotelBooking.isPending}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Room Upgrade</Label>
                    <div className="flex gap-2">
                      <Input
                        value={getFieldValue(hotelBooking, 'room_upgrade')}
                        onChange={(e) => handleFieldChange(hotelBooking.id, 'room_upgrade', e.target.value)}
                      />
                      {hasPendingUpdate(hotelBooking.id, 'room_upgrade') && (
                        <Button 
                          size="sm" 
                          onClick={() => saveFieldUpdate(hotelBooking.id, 'room_upgrade')}
                          disabled={updateHotelBooking.isPending}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Confirmation Number</Label>
                    <div className="flex gap-2">
                      <Input
                        value={getFieldValue(hotelBooking, 'confirmation_number')}
                        onChange={(e) => handleFieldChange(hotelBooking.id, 'confirmation_number', e.target.value)}
                      />
                      {hasPendingUpdate(hotelBooking.id, 'confirmation_number') && (
                        <Button 
                          size="sm" 
                          onClick={() => saveFieldUpdate(hotelBooking.id, 'confirmation_number')}
                          disabled={updateHotelBooking.isPending}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Room Requests</Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={getFieldValue(hotelBooking, 'room_requests')}
                        onChange={(e) => handleFieldChange(hotelBooking.id, 'room_requests', e.target.value)}
                      />
                      {hasPendingUpdate(hotelBooking.id, 'room_requests') && (
                        <Button 
                          size="sm" 
                          onClick={() => saveFieldUpdate(hotelBooking.id, 'room_requests')}
                          disabled={updateHotelBooking.isPending}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};
