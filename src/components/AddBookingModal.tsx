
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTours } from "@/hooks/useTours";
import { useCreateBooking } from "@/hooks/useBookings";
import { HotelAllocationSection } from "@/components/HotelAllocationSection";
import { ActivityAllocationSection } from "@/components/ActivityAllocationSection";

interface AddBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedTourId?: string;
}

export const AddBookingModal = ({ open, onOpenChange, preSelectedTourId }: AddBookingModalProps) => {
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
    checkInDate: "",
    checkOutDate: "",
    notes: ""
  });
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");

  const { data: tours } = useTours();
  const createBooking = useCreateBooking();

  useEffect(() => {
    if (preSelectedTourId && open) {
      const selectedTour = tours?.find(tour => tour.id === preSelectedTourId);
      setFormData(prev => ({ 
        ...prev, 
        tourId: preSelectedTourId,
        checkInDate: selectedTour?.start_date || "",
        checkOutDate: selectedTour?.end_date || ""
      }));
    }
  }, [preSelectedTourId, open, tours]);

  useEffect(() => {
    if (formData.tourId && tours) {
      const selectedTour = tours.find(tour => tour.id === formData.tourId);
      if (selectedTour) {
        setFormData(prev => ({
          ...prev,
          checkInDate: selectedTour.start_date || "",
          checkOutDate: selectedTour.end_date || ""
        }));
      }
    }
  }, [formData.tourId, tours]);

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
      check_in_date: formData.checkInDate || undefined,
      check_out_date: formData.checkOutDate || undefined,
    }, {
      onSuccess: (data) => {
        setCreatedBookingId(data.id);
        if (formData.accommodationRequired) {
          setActiveTab("accommodation");
        } else {
          setActiveTab("activities");
        }
      }
    });
  };

  const handleClose = () => {
    setFormData({
      tourId: preSelectedTourId || "",
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
      checkInDate: "",
      checkOutDate: "",
      notes: ""
    });
    setCreatedBookingId(null);
    setActiveTab("details");
    onOpenChange(false);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Booking</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Booking Details</TabsTrigger>
            <TabsTrigger value="accommodation" disabled={!createdBookingId}>Hotel Allocation</TabsTrigger>
            <TabsTrigger value="activities" disabled={!createdBookingId}>Activities</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
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

                <div className="space-y-2">
                  <Label htmlFor="checkInDate">Check In Date</Label>
                  <Input
                    id="checkInDate"
                    type="date"
                    value={formData.checkInDate}
                    onChange={(e) => handleInputChange("checkInDate", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkOutDate">Check Out Date</Label>
                  <Input
                    id="checkOutDate"
                    type="date"
                    value={formData.checkOutDate}
                    onChange={(e) => handleInputChange("checkOutDate", e.target.value)}
                  />
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
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBooking.isPending}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {createBooking.isPending ? "Creating..." : "Create Booking"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="accommodation" className="space-y-4">
            {createdBookingId && formData.tourId && (
              <>
                <HotelAllocationSection
                  tourId={formData.tourId}
                  bookingId={createdBookingId}
                  accommodationRequired={formData.accommodationRequired}
                  defaultCheckIn={formData.checkInDate}
                  defaultCheckOut={formData.checkOutDate}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    onClick={() => setActiveTab("activities")}
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    Next: Activities
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="activities" className="space-y-4">
            {createdBookingId && formData.tourId && (
              <>
                <ActivityAllocationSection
                  tourId={formData.tourId}
                  bookingId={createdBookingId}
                  passengerCount={parseInt(formData.passengers)}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    onClick={handleClose}
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    Complete Booking
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
