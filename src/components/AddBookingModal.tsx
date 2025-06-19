import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Edit, ChevronDown, Check } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useCreateBooking } from "@/hooks/useBookings";
import { useCustomers } from "@/hooks/useCustomers";
import { HotelAllocationSection } from "@/components/HotelAllocationSection";
import { ActivityAllocationSection } from "@/components/ActivityAllocationSection";
import { EditContactModal } from "@/components/EditContactModal";
import { cn } from "@/lib/utils";

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
    leadPhone: "",
    passengers: "2",
    passenger2Name: "",
    passenger3Name: "",
    groupName: "",
    bookingAgent: "",
    status: "invoiced",
    extraRequests: "",
    accommodationRequired: true,
    checkInDate: "",
    checkOutDate: "",
    notes: ""
  });
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showEditContact, setShowEditContact] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  const { data: tours } = useTours();
  const { data: customers } = useCustomers();
  const createBooking = useCreateBooking();

  // Filter customers based on lead passenger input
  const filteredContacts = customers?.filter(customer => {
    if (!formData.leadPassenger) return false;
    const searchTerm = formData.leadPassenger.toLowerCase();
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    return fullName.includes(searchTerm);
  }) || [];

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

  // Add effect to sync form data when selected customer data changes
  useEffect(() => {
    if (selectedContactId && customers) {
      const selectedCustomer = customers.find(c => c.id === selectedContactId);
      if (selectedCustomer) {
        setFormData(prev => ({
          ...prev,
          leadPassenger: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`,
          leadEmail: selectedCustomer.email || "",
          leadPhone: selectedCustomer.phone || "",
        }));
      }
    }
  }, [selectedContactId, customers]);

  const handleContactSelect = (customer: any) => {
    setSelectedContactId(customer.id);
    setFormData(prev => ({
      ...prev,
      leadPassenger: `${customer.first_name} ${customer.last_name}`,
      leadEmail: customer.email || "",
      leadPhone: customer.phone || "",
    }));
    setContactPopoverOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createBooking.mutate({
      tour_id: formData.tourId,
      lead_passenger_name: formData.leadPassenger,
      lead_passenger_email: formData.leadEmail,
      lead_passenger_phone: formData.leadPhone,
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
      leadPhone: "",
      passengers: "2",
      passenger2Name: "",
      passenger3Name: "",
      groupName: "",
      bookingAgent: "",
      status: "invoiced",
      extraRequests: "",
      accommodationRequired: true,
      checkInDate: "",
      checkOutDate: "",
      notes: ""
    });
    setCreatedBookingId(null);
    setActiveTab("details");
    setSelectedContactId("");
    onOpenChange(false);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear selected contact if manually editing the name
    if (field === "leadPassenger" && typeof value === "string") {
      const selectedContact = customers?.find(c => c.id === selectedContactId);
      if (selectedContact && value !== `${selectedContact.first_name} ${selectedContact.last_name}`) {
        setSelectedContactId("");
      }
    }
  };

  const handleEditContact = () => {
    // Create a contact object from current form data or use selected contact
    const selectedContact = customers?.find(c => c.id === selectedContactId);
    const contact = selectedContact || {
      first_name: formData.leadPassenger.split(' ')[0] || '',
      last_name: formData.leadPassenger.split(' ').slice(1).join(' ') || '',
      email: formData.leadEmail,
      phone: formData.leadPhone,
    };
    setContactToEdit(contact);
    setShowEditContact(true);
  };

  const handleContactUpdated = (updatedContact: any) => {
    // Update form data with the updated contact info
    setFormData(prev => ({
      ...prev,
      leadPassenger: `${updatedContact.first_name} ${updatedContact.last_name}`,
      leadEmail: updatedContact.email || '',
      leadPhone: updatedContact.phone || '',
    }));
    
    // Update selected contact ID if it was an existing contact
    if (updatedContact.id) {
      setSelectedContactId(updatedContact.id);
    }
  };

  return (
    <>
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

                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Lead Passenger Details</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEditContact}
                      disabled={!formData.leadPassenger}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Contact
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="leadPassenger">Lead Passenger Name</Label>
                      <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                        <PopoverTrigger asChild>
                          <div className="relative">
                            <Input
                              id="leadPassenger"
                              value={formData.leadPassenger}
                              onChange={(e) => {
                                handleInputChange("leadPassenger", e.target.value);
                                setContactPopoverOpen(e.target.value.length > 0);
                              }}
                              placeholder="e.g., John Smith"
                              required
                              className="pr-8"
                            />
                            {filteredContacts.length > 0 && formData.leadPassenger && (
                              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandList>
                              {filteredContacts.length === 0 ? (
                                <CommandEmpty>No contacts found.</CommandEmpty>
                              ) : (
                                <CommandGroup>
                                  {filteredContacts.map((customer) => (
                                    <CommandItem
                                      key={customer.id}
                                      onSelect={() => handleContactSelect(customer)}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedContactId === customer.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{customer.first_name} {customer.last_name}</span>
                                        <span className="text-sm text-muted-foreground">
                                          {customer.email} {customer.phone && `• ${customer.phone}`}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="leadEmail">Lead Passenger Email</Label>
                      <Input
                        id="leadEmail"
                        type="email"
                        value={formData.leadEmail}
                        onChange={(e) => handleInputChange("leadEmail", e.target.value)}
                        placeholder="e.g., john@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="leadPhone">Lead Passenger Phone</Label>
                      <Input
                        id="leadPhone"
                        type="tel"
                        value={formData.leadPhone}
                        onChange={(e) => handleInputChange("leadPhone", e.target.value)}
                        placeholder="e.g., +1234567890"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createBooking.isPending}
                    className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
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
                  <div className="flex justify-between gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleClose}
                    >
                      Close
                    </Button>
                    <Button 
                      onClick={() => setActiveTab("activities")}
                      className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
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
                  <div className="flex justify-between gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleClose}
                    >
                      Close
                    </Button>
                    <Button 
                      onClick={handleClose}
                      className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
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

      <EditContactModal
        contact={contactToEdit}
        open={showEditContact}
        onOpenChange={setShowEditContact}
        onContactUpdated={handleContactUpdated}
      />
    </>
  );
};
