
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";
import { useUpdateBooking, useDeleteBooking } from "@/hooks/useBookings";
import { useCancelBooking } from "@/hooks/useCancelBooking";
import { HotelAllocationSection } from "@/components/HotelAllocationSection";
import { ActivityAllocationSection } from "@/components/ActivityAllocationSection";
import { CancelBookingDialog } from "@/components/CancelBookingDialog";

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
    lead_passenger_first_name: '',
    lead_passenger_last_name: '',
    lead_passenger_email: '',
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

  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const cancelBooking = useCancelBooking();

  useEffect(() => {
    if (booking) {
      setFormData({
        lead_passenger_first_name: booking.customers?.first_name || '',
        lead_passenger_last_name: booking.customers?.last_name || '',
        lead_passenger_email: booking.customers?.email || '',
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
      // Only include the booking fields, not the customer fields
      passenger_count: formData.passenger_count,
      passenger_2_name: formData.passenger_2_name,
      passenger_3_name: formData.passenger_3_name,
      group_name: formData.group_name,
      booking_agent: formData.booking_agent,
      status: formData.status,
      extra_requests: formData.extra_requests,
      invoice_notes: formData.invoice_notes,
      accommodation_required: formData.accommodation_required,
      check_in_date: formData.check_in_date,
      check_out_date: formData.check_out_date,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const handleStatusChange = (newStatus: 'pending' | 'invoiced' | 'deposited' | 'paid' | 'cancelled') => {
    if (newStatus === 'cancelled' && booking?.status !== 'cancelled') {
      setShowCancelDialog(true);
    } else {
      setFormData(prev => ({ ...prev, status: newStatus }));
    }
  };

  const handleCancelConfirm = (reason: string) => {
    if (!booking) return;
    
    cancelBooking.mutate({
      bookingId: booking.id,
      cancellationReason: reason
    }, {
      onSuccess: () => {
        setShowCancelDialog(false);
        onOpenChange(false);
      }
    });
  };

  const handleDelete = () => {
    if (!booking) return;
    if (confirm('Are you sure you want to delete this booking?')) {
      deleteBooking.mutate(booking.id);
      onOpenChange(false);
    }
  };

  if (!booking) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Edit Booking - {formData.lead_passenger_first_name} {formData.lead_passenger_last_name}
              <Button onClick={handleDelete} variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Booking
              </Button>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Booking Details</TabsTrigger>
              <TabsTrigger value="accommodation">Hotel Allocation</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lead_passenger_first_name">Lead Passenger First Name</Label>
                    <Input
                      id="lead_passenger_first_name"
                      value={formData.lead_passenger_first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_first_name: e.target.value }))}
                      disabled
                      className="bg-gray-100"
                      title="Customer details are managed separately in the Contacts section"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead_passenger_last_name">Lead Passenger Last Name</Label>
                    <Input
                      id="lead_passenger_last_name"
                      value={formData.lead_passenger_last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_last_name: e.target.value }))}
                      disabled
                      className="bg-gray-100"
                      title="Customer details are managed separately in the Contacts section"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead_passenger_email">Lead Passenger Email</Label>
                    <Input
                      id="lead_passenger_email"
                      type="email"
                      value={formData.lead_passenger_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_email: e.target.value }))}
                      disabled
                      className="bg-gray-100"
                      title="Customer details are managed separately in the Contacts section"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passenger_count">Passenger Count</Label>
                    <Input
                      id="passenger_count"
                      type="number"
                      min="1"
                      value={formData.passenger_count}
                      onChange={(e) => setFormData(prev => ({ ...prev, passenger_count: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={handleStatusChange}>
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

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateBooking.isPending}
                    className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                  >
                    {updateBooking.isPending ? 'Updating...' : 'Update Booking'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="accommodation" className="space-y-4">
              <HotelAllocationSection
                tourId={booking.tour_id}
                bookingId={booking.id}
                accommodationRequired={formData.accommodation_required}
                defaultCheckIn={formData.check_in_date}
                defaultCheckOut={formData.check_out_date}
              />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <ActivityAllocationSection
                tourId={booking.tour_id}
                bookingId={booking.id}
                passengerCount={formData.passenger_count}
              />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>

        <CancelBookingDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancelConfirm}
          bookingId={booking.id}
          isLoading={cancelBooking.isPending}
        />
      </Dialog>
    </>
  );
};
