import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hotel, MapPin, Heart, FileText } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useCreateBooking } from "@/hooks/useBookings";
import { useCustomers, useUpdateCustomer } from "@/hooks/useCustomers";
import { HotelAllocationSection } from "@/components/HotelAllocationSection";
import { ActivityAllocationSection } from "@/components/ActivityAllocationSection";
import { EditContactModal } from "@/components/EditContactModal";
import { BookingDetailsForm } from "./booking/BookingDetailsForm";

interface AddBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedTourId?: string;
}

const initialFormData = {
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
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  passportNumber: "",
  passportExpiryDate: "",
  passportCountry: "",
  idNumber: "",
  nationality: "",
  medicalConditions: "",
  accessibilityNeeds: "",
};

export const AddBookingModal = ({ open, onOpenChange, preSelectedTourId }: AddBookingModalProps) => {
  const [formData, setFormData] = useState(initialFormData);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showEditContact, setShowEditContact] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  const { data: tours } = useTours();
  const { data: customers } = useCustomers();
  const createBooking = useCreateBooking();
  const updateCustomer = useUpdateCustomer();

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
      emergency_contact_name: formData.emergencyContactName || undefined,
      emergency_contact_phone: formData.emergencyContactPhone || undefined,
      emergency_contact_relationship: formData.emergencyContactRelationship || undefined,
      passport_number: formData.passportNumber || undefined,
      passport_expiry_date: formData.passportExpiryDate || undefined,
      passport_country: formData.passportCountry || undefined,
      id_number: formData.idNumber || undefined,
      nationality: formData.nationality || undefined,
      medical_conditions: formData.medicalConditions || undefined,
      accessibility_needs: formData.accessibilityNeeds || undefined,
    }, {
      onSuccess: (data) => {
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
          setActiveTab("hotels");
        } else {
          setActiveTab("activities");
        }
      }
    });
  };

  const handleClose = () => {
    setFormData({ ...initialFormData, tourId: preSelectedTourId || "" });
    setCreatedBookingId(null);
    setActiveTab("details");
    setSelectedContactId("");
    onOpenChange(false);
  };

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === "leadPassenger" && typeof value === "string") {
      const selectedContact = customers?.find(c => c.id === selectedContactId);
      if (selectedContact && value !== `${selectedContact.first_name} ${selectedContact.last_name}`) {
        setSelectedContactId("");
      }
    }
  };

  const handleEditContact = () => {
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
    setFormData(prev => ({
      ...prev,
      leadPassenger: `${updatedContact.first_name} ${updatedContact.last_name}`,
      leadEmail: updatedContact.email || '',
      leadPhone: updatedContact.phone || '',
      leadDietary: updatedContact.dietary_requirements || '',
    }));
    
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
              <TabsTrigger value="hotels" disabled={!createdBookingId} className="flex items-center gap-1">
                <Hotel className="h-4 w-4" />
                Hotels
              </TabsTrigger>
              <TabsTrigger value="activities" disabled={!createdBookingId} className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Activities
              </TabsTrigger>
              <TabsTrigger value="medical" className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                Medical
              </TabsTrigger>
              <TabsTrigger value="travel" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Travel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <BookingDetailsForm
                formData={formData}
                onInputChange={handleInputChange}
                onSubmit={handleSubmit}
                onClose={handleClose}
                onContactSelect={handleContactSelect}
                onEditContact={handleEditContact}
                selectedContactId={selectedContactId}
                isLoading={createBooking.isPending}
              />
            </TabsContent>

            <TabsContent value="hotels" className="space-y-4">
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
                    <Button type="button" variant="outline" onClick={handleClose}>
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
                    <Button type="button" variant="outline" onClick={handleClose}>
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
