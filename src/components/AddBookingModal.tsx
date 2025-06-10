import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTours } from "@/hooks/useTours";
import { useCreateBooking } from "@/hooks/useBookings";

interface AddBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddBookingModal = ({ open, onOpenChange }: AddBookingModalProps) => {
  const [formData, setFormData] = useState({
    tourId: "",
    leadPassenger: "",
    leadEmail: "",
    passengers: "2",
    passenger2Name: "",
    passenger3Name: "",
    groupName: "",
    bookingAgent: "",
    status: "pending",
    extraRequests: "",
    accommodationRequired: true,
    notes: ""
  });

  const { data: tours } = useTours();
  const createBooking = useCreateBooking();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createBooking.mutate({
      tour_id: formData.tourId,
      lead_passenger_name: formData.leadPassenger,
      lead_passenger_email: formData.leadEmail,
      passenger_count: parseInt(formData.passengers),
      passenger_2_name: formData.passenger2Name || undefined,
      passenger_3_name: formData.passenger3Name || undefined,
      group_name: formData.groupName || undefined,
      booking_agent: formData.bookingAgent || undefined,
      status: formData.status,
      extra_requests: formData.extraRequests || undefined,
      accommodation_required: formData.accommodationRequired,
    });

    // Reset form and close modal
    setFormData({
      tourId: "",
      leadPassenger: "",
      leadEmail: "",
      passengers: "2",
      passenger2Name: "",
      passenger3Name: "",
      groupName: "",
      bookingAgent: "",
      status: "pending",
      extraRequests: "",
      accommodationRequired: true,
      notes: ""
    });
    onOpenChange(false);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Booking</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tourId">Select Tour</Label>
            <Select value={formData.tourId} onValueChange={(value) => handleInputChange("tourId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tour..." />
              </SelectTrigger>
              <SelectContent>
                {tours?.map((tour) => (
                  <SelectItem key={tour.id} value={tour.id}>
                    {tour.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leadPassenger">Lead Passenger Name</Label>
              <Input
                id="leadPassenger"
                value={formData.leadPassenger}
                onChange={(e) => handleInputChange("leadPassenger", e.target.value)}
                placeholder="e.g., John Smith"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="leadEmail">Lead Passenger Email</Label>
              <Input
                id="leadEmail"
                type="email"
                value={formData.leadEmail}
                onChange={(e) => handleInputChange("leadEmail", e.target.value)}
                placeholder="e.g., john@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passengers">Number of Passengers</Label>
              <Select value={formData.passengers} onValueChange={(value) => handleInputChange("passengers", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name (Optional)</Label>
              <Input
                id="groupName"
                value={formData.groupName}
                onChange={(e) => handleInputChange("groupName", e.target.value)}
                placeholder="e.g., Smith Family"
              />
            </div>
          </div>

          {parseInt(formData.passengers) >= 2 && (
            <div className="space-y-2">
              <Label htmlFor="passenger2Name">Passenger 2 Name</Label>
              <Input
                id="passenger2Name"
                value={formData.passenger2Name}
                onChange={(e) => handleInputChange("passenger2Name", e.target.value)}
                placeholder="e.g., Mary Smith"
              />
            </div>
          )}

          {parseInt(formData.passengers) >= 3 && (
            <div className="space-y-2">
              <Label htmlFor="passenger3Name">Passenger 3 Name</Label>
              <Input
                id="passenger3Name"
                value={formData.passenger3Name}
                onChange={(e) => handleInputChange("passenger3Name", e.target.value)}
                placeholder="e.g., Sarah Smith"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bookingAgent">Booking Agent</Label>
              <Input
                id="bookingAgent"
                value={formData.bookingAgent}
                onChange={(e) => handleInputChange("bookingAgent", e.target.value)}
                placeholder="e.g., Travel Agent Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Booking Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
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
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="accommodationRequired"
              checked={formData.accommodationRequired}
              onCheckedChange={(checked) => handleInputChange("accommodationRequired", checked as boolean)}
            />
            <Label htmlFor="accommodationRequired">Accommodation Required</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extraRequests">Extra Requests</Label>
            <Textarea
              id="extraRequests"
              value={formData.extraRequests}
              onChange={(e) => handleInputChange("extraRequests", e.target.value)}
              placeholder="Any special requests or requirements..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Additional notes about the booking..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBooking.isPending}>
              {createBooking.isPending ? "Creating..." : "Create Booking"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
