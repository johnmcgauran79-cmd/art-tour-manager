
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { useUpdateBooking, useDeleteBooking } from "@/hooks/useBookings";
import { useHotels } from "@/hooks/useHotels";
import { useHotelBookings, useCreateHotelBooking, useUpdateHotelBooking, useDeleteHotelBooking } from "@/hooks/useHotelBookings";

interface Booking {
  id: string;
  tour_id: string;
  lead_passenger_id: string | null;
  passenger_count: number;
  passenger_2_name: string | null;
  passenger_3_name: string | null;
  group_name: string | null;
  booking_agent: string | null;
  status: 'pending' | 'invoiced' | 'deposited' | 'paid' | 'cancelled';
  extra_requests: string | null;
  invoice_notes: string | null;
  accommodation_required: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  total_nights: number | null;
  created_at: string;
  updated_at: string;
  customers?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface EditBookingModalProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditBookingModal = ({ booking, open, onOpenChange }: EditBookingModalProps) => {
  const [formData, setFormData] = useState({
    passenger_count: 1,
    passenger_2_name: '',
    passenger_3_name: '',
    group_name: '',
    booking_agent: '',
    status: 'pending' as 'pending' | 'invoiced' | 'deposited' | 'paid' | 'cancelled',
    extra_requests: '',
    invoice_notes: '',
    accommodation_required: true,
    check_in_date: '',
    check_out_date: '',
  });

  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const { data: hotels = [] } = useHotels(booking?.tour_id || "");
  const { data: hotelBookings = [] } = useHotelBookings(booking?.id || "");
  const createHotelBooking = useCreateHotelBooking();
  const updateHotelBooking = useUpdateHotelBooking();
  const deleteHotelBooking = useDeleteHotelBooking();

  useEffect(() => {
    if (booking) {
      setFormData({
        passenger_count: booking.passenger_count,
        passenger_2_name: booking.passenger_2_name || '',
        passenger_3_name: booking.passenger_3_name || '',
        group_name: booking.group_name || '',
        booking_agent: booking.booking_agent || '',
        status: booking.status,
        extra_requests: booking.extra_requests || '',
        invoice_notes: booking.invoice_notes || '',
        accommodation_required: booking.accommodation_required || false,
        check_in_date: booking.check_in_date || '',
        check_out_date: booking.check_out_date || '',
      });
    }
  }, [booking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    updateBooking.mutate({
      id: booking.id,
      ...formData,
    });
  };

  const handleDelete = () => {
    if (!booking) return;
    if (confirm('Are you sure you want to delete this booking?')) {
      deleteBooking.mutate(booking.id);
      onOpenChange(false);
    }
  };

  const handleHotelAllocation = (hotelId: string, allocated: boolean) => {
    const existingHotelBooking = hotelBookings.find(hb => hb.hotel_id === hotelId);
    const hotel = hotels.find(h => h.id === hotelId);
    
    if (existingHotelBooking) {
      updateHotelBooking.mutate({
        id: existingHotelBooking.id,
        allocated,
      });
    } else if (allocated) {
      createHotelBooking.mutate({
        booking_id: booking?.id,
        hotel_id: hotelId,
        allocated: true,
        check_in_date: hotel?.default_check_in || formData.check_in_date,
        check_out_date: hotel?.default_check_out || formData.check_out_date,
        room_type: hotel?.default_room_type,
        bedding: 'double',
        required: true,
      });
    }
  };

  const updateHotelBookingField = (hotelBookingId: string, field: string, value: any) => {
    updateHotelBooking.mutate({
      id: hotelBookingId,
      [field]: value,
    });
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Edit Booking - {booking.customers?.first_name} {booking.customers?.last_name}
            <Button onClick={handleDelete} variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Booking
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Booking Details</TabsTrigger>
            <TabsTrigger value="accommodation">Hotel Allocation</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="passenger_count">Passenger Count</Label>
                  <Input
                    id="passenger_count"
                    type="number"
                    min="1"
                    value={formData.passenger_count}
                    onChange={(e) => setFormData(prev => ({ ...prev, passenger_count: parseInt(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: 'pending' | 'invoiced' | 'deposited' | 'paid' | 'cancelled') => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                      <SelectItem value="deposited">Deposited</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="passenger_2_name">Passenger 2 Name</Label>
                  <Input
                    id="passenger_2_name"
                    value={formData.passenger_2_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, passenger_2_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="passenger_3_name">Passenger 3 Name</Label>
                  <Input
                    id="passenger_3_name"
                    value={formData.passenger_3_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, passenger_3_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="group_name">Group Name</Label>
                  <Input
                    id="group_name"
                    value={formData.group_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, group_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="booking_agent">Booking Agent</Label>
                  <Input
                    id="booking_agent"
                    value={formData.booking_agent}
                    onChange={(e) => setFormData(prev => ({ ...prev, booking_agent: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="check_in_date">Check In Date</Label>
                  <Input
                    id="check_in_date"
                    type="date"
                    value={formData.check_in_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, check_in_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="check_out_date">Check Out Date</Label>
                  <Input
                    id="check_out_date"
                    type="date"
                    value={formData.check_out_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, check_out_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="accommodation_required"
                  checked={formData.accommodation_required}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, accommodation_required: checked }))}
                />
                <Label htmlFor="accommodation_required">Accommodation Required</Label>
              </div>

              <div>
                <Label htmlFor="extra_requests">Extra Requests</Label>
                <Textarea
                  id="extra_requests"
                  value={formData.extra_requests}
                  onChange={(e) => setFormData(prev => ({ ...prev, extra_requests: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="invoice_notes">Invoice Notes</Label>
                <Textarea
                  id="invoice_notes"
                  value={formData.invoice_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoice_notes: e.target.value }))}
                />
              </div>

              <Button type="submit" disabled={updateBooking.isPending}>
                {updateBooking.isPending ? 'Updating...' : 'Update Booking'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="accommodation" className="space-y-4">
            {formData.accommodation_required ? (
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
                            <div>
                              <Label>Confirmation Number</Label>
                              <Input
                                value={hotelBooking.confirmation_number || ''}
                                onChange={(e) => updateHotelBookingField(hotelBooking.id, 'confirmation_number', e.target.value)}
                              />
                            </div>
                            <div>
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
            ) : (
              <p className="text-muted-foreground">Accommodation not required for this booking.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
