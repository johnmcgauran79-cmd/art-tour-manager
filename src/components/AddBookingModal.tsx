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
import { Edit, ChevronDown, Check, Shield, FileText, Heart, Hotel } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useCreateBooking } from "@/hooks/useBookings";
import { useCustomers, useUpdateCustomer } from "@/hooks/useCustomers";
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
    leadDietary: "",
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
    notes: "",
    invoiceNotes: "",
    
    // Emergency contact
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    
    // Travel documents
    passportNumber: "",
    passportExpiryDate: "",
    passportCountry: "",
    idNumber: "",
    nationality: "",
    
    // Medical info (removed dietaryRestrictions as it's duplicate)
    medicalConditions: "",
    accessibilityNeeds: "",
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
  const updateCustomer = useUpdateCustomer();

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
          leadDietary: selectedCustomer.dietary_requirements || "",
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
      leadDietary: customer.dietary_requirements || "",
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
      invoice_notes: formData.invoiceNotes || undefined,
      
      // Emergency contact
      emergency_contact_name: formData.emergencyContactName || undefined,
      emergency_contact_phone: formData.emergencyContactPhone || undefined,
      emergency_contact_relationship: formData.emergencyContactRelationship || undefined,
      
      // Travel documents
      passport_number: formData.passportNumber || undefined,
      passport_expiry_date: formData.passportExpiryDate || undefined,
      passport_country: formData.passportCountry || undefined,
      id_number: formData.idNumber || undefined,
      nationality: formData.nationality || undefined,
      
      // Medical info (removed dietary_restrictions as it's duplicate)
      medical_conditions: formData.medicalConditions || undefined,
      accessibility_needs: formData.accessibilityNeeds || undefined,
    }, {
      onSuccess: (data) => {
        // Update customer dietary requirements if changed and customer exists
        if (selectedContactId && formData.leadDietary) {
          const selectedCustomer = customers?.find(c => c.id === selectedContactId);
          if (selectedCustomer && selectedCustomer.dietary_requirements !== formData.leadDietary) {
            updateCustomer.mutate({
              id: selectedContactId,
              dietary_requirements: formData.leadDietary
            });
          }
        }
        
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
      leadDietary: "",
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
      notes: "",
      invoiceNotes: "",
      
      // Emergency contact
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
      
      // Travel documents
      passportNumber: "",
      passportExpiryDate: "",
      passportCountry: "",
      idNumber: "",
      nationality: "",
      
      // Medical info (removed dietaryRestrictions)
      medicalConditions: "",
      accessibilityNeeds: "",
    });
    setCreatedBookingId(null);
    setActiveTab("details");
    setSelectedContactId("");
    onOpenChange(false);
  };

  const handleInputChange = (field: string, value: string | boolean | number) => {
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
      dietary_requirements: formData.leadDietary,
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
      leadDietary: updatedContact.dietary_requirements || '',
    }));
    
    // Update selected contact ID if it was an existing contact
    if (updatedContact.id) {
      setSelectedContactId(updatedContact.id);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Booking</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="accommodation" disabled={!createdBookingId} className="flex items-center gap-1">
                <Hotel className="h-4 w-4" />
                Hotels
              </TabsTrigger>
              <TabsTrigger value="medical" className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                Medical & Emergency
              </TabsTrigger>
              <TabsTrigger value="travel" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Travel Docs
              </TabsTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="leadDietary">Dietary Requirements</Label>
                    <Textarea
                      id="leadDietary"
                      value={formData.leadDietary}
                      onChange={(e) => handleInputChange("leadDietary", e.target.value)}
                      placeholder="Enter dietary requirements..."
                      rows={3}
                    />
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
                        <SelectItem value="instalment_paid">Instalment Paid</SelectItem>
                        <SelectItem value="fully_paid">Fully Paid</SelectItem>
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
                  <Label htmlFor="invoiceNotes">Invoice Notes</Label>
                  <Textarea
                    id="invoiceNotes"
                    value={formData.invoiceNotes}
                    onChange={(e) => handleInputChange("invoiceNotes", e.target.value)}
                    placeholder="Notes to be included on the invoice..."
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

            <TabsContent value="medical" className="space-y-4">
              <div className="grid grid-cols-1 gap-6">
                {/* Emergency Contact Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="text-lg font-medium text-brand-navy flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Emergency Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                      <Input
                        id="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                      <Input
                        id="emergencyContactPhone"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => handleInputChange("emergencyContactPhone", e.target.value)}
                        placeholder="Phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContactRelationship">Relationship</Label>
                      <Input
                        id="emergencyContactRelationship"
                        value={formData.emergencyContactRelationship}
                        onChange={(e) => handleInputChange("emergencyContactRelationship", e.target.value)}
                        placeholder="e.g., Spouse, Parent, Sibling"
                      />
                    </div>
                  </div>
                </div>

                {/* Medical & Accessibility Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="text-lg font-medium text-brand-navy flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Medical & Accessibility Information
                  </h3>
                  <div>
                    <Label htmlFor="medicalConditions">Medical Conditions</Label>
                    <Textarea
                      id="medicalConditions"
                      value={formData.medicalConditions}
                      onChange={(e) => handleInputChange("medicalConditions", e.target.value)}
                      placeholder="Any medical conditions, allergies, or medications..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="accessibilityNeeds">Accessibility Needs</Label>
                    <Textarea
                      id="accessibilityNeeds"
                      value={formData.accessibilityNeeds}
                      onChange={(e) => handleInputChange("accessibilityNeeds", e.target.value)}
                      placeholder="Mobility assistance, wheelchair access, etc..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={createBooking.isPending}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  {createBooking.isPending ? 'Creating...' : 'Create Booking'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="travel" className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-brand-navy">Travel Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="passportNumber">Passport Number</Label>
                    <Input
                      id="passportNumber"
                      value={formData.passportNumber}
                      onChange={(e) => handleInputChange("passportNumber", e.target.value)}
                      placeholder="Passport number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passportExpiryDate">Passport Expiry Date</Label>
                    <Input
                      id="passportExpiryDate"
                      type="date"
                      value={formData.passportExpiryDate}
                      onChange={(e) => handleInputChange("passportExpiryDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="passportCountry">Passport Issuing Country</Label>
                    <Input
                      id="passportCountry"
                      value={formData.passportCountry}
                      onChange={(e) => handleInputChange("passportCountry", e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nationality">Nationality</Label>
                    <Input
                      id="nationality"
                      value={formData.nationality}
                      onChange={(e) => handleInputChange("nationality", e.target.value)}
                      placeholder="Nationality"
                    />
                  </div>
                  <div>
                    <Label htmlFor="idNumber">National ID Number</Label>
                    <Input
                      id="idNumber"
                      value={formData.idNumber}
                      onChange={(e) => handleInputChange("idNumber", e.target.value)}
                      placeholder="National ID or driver's license"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={createBooking.isPending}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  {createBooking.isPending ? 'Creating...' : 'Create Booking'}
                </Button>
              </div>
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
