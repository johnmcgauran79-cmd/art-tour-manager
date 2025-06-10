
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

  const handleHotelAllocation = (hotelId: string, allocated: boolean) => {
    const existingHotelBooking = hotelBookings.find(hb => hb.hotel_id === hotelId);
    const hotel = hotels.find(h => h.id === hotelId);
    
    if (existingHotelBooking) {
      updateHotelBooking.mutate({
        id: existingHotelBooking.id,
        allocated,
      }, {
        onSuccess: () => onUpdate?.()
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
        onSuccess: () => onUpdate?.()
      });
    }
  };

  const updateHotelBookingField = (hotelBookingId: string, field: string, value: any) => {
    updateHotelBooking.mutate({
      id: hotelBookingId,
      [field]: value,
    }, {
      onSuccess: () => onUpdate?.()
    });
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
                    <Input
                      type="date"
                      value={hotelBooking.check_in_date || ''}
                      onChange={(e) => updateHotelBookingField(hotelBooking.id, 'check_in_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Check Out Date</Label>
                    <Input
                      type="date"
                      value={hotelBooking.check_out_date || ''}
                      onChange={(e) => updateHotelBookingField(hotelBooking.id, 'check_out_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Nights</Label>
                    <Input value={hotelBooking.nights || 0} readOnly />
                  </div>
                  <div>
                    <Label>Bedding Type</Label>
                    <Select 
                      value={hotelBooking.bedding} 
                      onValueChange={(value) => updateHotelBookingField(hotelBooking.id, 'bedding', value)}
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
                      value={hotelBooking.room_type || ''}
                      onChange={(e) => updateHotelBookingField(hotelBooking.id, 'room_type', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Room Upgrade</Label>
                    <Input
                      value={hotelBooking.room_upgrade || ''}
                      onChange={(e) => updateHotelBookingField(hotelBooking.id, 'room_upgrade', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Confirmation Number</Label>
                    <Input
                      value={hotelBooking.confirmation_number || ''}
                      onChange={(e) => updateHotelBookingField(hotelBooking.id, 'confirmation_number', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Room Requests</Label>
                    <Textarea
                      value={hotelBooking.room_requests || ''}
                      onChange={(e) => updateHotelBookingField(hotelBooking.id, 'room_requests', e.target.value)}
                    />
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
