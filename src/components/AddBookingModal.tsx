import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Heart, Plus, User, MapPin, Calendar } from "lucide-react";
import { useCreateBooking } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { ContactSearch } from "@/components/booking/ContactSearch";
import { BookingDetailsForm } from "@/components/booking/BookingDetailsForm";
import { AddContactModal } from "@/components/AddContactModal";
import { HotelAllocationSection } from "@/components/HotelAllocationSection";
import { ActivityAllocationSection } from "@/components/ActivityAllocationSection";

interface AddBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedTourId?: string;
  defaultStatus?: string;
}

export const AddBookingModal = ({ open, onOpenChange, preSelectedTourId, defaultStatus = "pending" }: AddBookingModalProps) => {
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [leadPassengerName, setLeadPassengerName] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formData, setFormData] = useState({
    tour_id: preSelectedTourId || '',
    lead_passenger_name: '',
    lead_passenger_email: '',
    lead_passenger_phone: '',
    passenger_count: 1,
    passenger_2_name: '',
    passenger_3_name: '',
    group_name: '',
    booking_agent: '',
    status: defaultStatus,
    extra_requests: '',
    accommodation_required: true,
    check_in_date: '',
    check_out_date: '',
    invoice_notes: '',
    
    // Emergency contact
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    
    // Travel documents
    passport_number: '',
    passport_expiry_date: '',
    passport_country: '',
    id_number: '',
    nationality: '',
    
    // Medical info
    medical_conditions: '',
    accessibility_needs: '',
    dietary_restrictions: '',
  });

  const { data: tours } = useTours();
  const createBooking = useCreateBooking();

  // Auto-fill check-in/out dates when tour is selected - Enhanced version
  useEffect(() => {
    console.log('Tour selection effect triggered:', { 
      tourId: formData.tour_id, 
      toursLoaded: !!tours, 
      toursCount: tours?.length 
    });
    
    if (formData.tour_id && tours && tours.length > 0) {
      const selectedTour = tours.find(tour => tour.id === formData.tour_id);
      console.log('Selected tour found:', selectedTour);
      
      if (selectedTour && selectedTour.start_date && selectedTour.end_date) {
        console.log('Auto-filling dates:', {
          checkIn: selectedTour.start_date,
          checkOut: selectedTour.end_date
        });
        
        setFormData(prev => ({
          ...prev,
          check_in_date: selectedTour.start_date,
          check_out_date: selectedTour.end_date,
        }));
      } else {
        console.log('Tour found but missing dates:', {
          hasStartDate: !!selectedTour?.start_date,
          hasEndDate: !!selectedTour?.end_date
        });
      }
    }
  }, [formData.tour_id, tours]);

  // Initialize form with preSelectedTourId and auto-fill dates immediately
  useEffect(() => {
    if (preSelectedTourId && tours && tours.length > 0) {
      const selectedTour = tours.find(tour => tour.id === preSelectedTourId);
      if (selectedTour) {
        console.log('Pre-selected tour auto-fill:', selectedTour);
        setFormData(prev => ({
          ...prev,
          tour_id: preSelectedTourId,
          check_in_date: selectedTour.start_date || '',
          check_out_date: selectedTour.end_date || '',
        }));
      }
    }
  }, [preSelectedTourId, tours]);

  // Set default status
  useEffect(() => {
    if (defaultStatus) {
      setFormData(prev => ({ ...prev, status: defaultStatus }));
    }
  }, [defaultStatus]);

  useEffect(() => {
    if (selectedContact) {
      const fullName = `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        lead_passenger_name: fullName,
        lead_passenger_email: selectedContact.email || '',
        lead_passenger_phone: selectedContact.phone || '',
        dietary_restrictions: selectedContact.dietary_requirements || '',
      }));
      setLeadPassengerName(fullName);
    }
  }, [selectedContact]);

  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
  };

  const handleContactCreated = () => {
    setShowAddContact(false);
    // Optionally refresh the contact search or clear the form
  };

  const handleFormChange = (field: string, value: any) => {
    console.log('Form field changed:', { field, value });
    
    // If tour_id is being changed, immediately auto-fill dates
    if (field === 'tour_id' && value && tours) {
      const selectedTour = tours.find(tour => tour.id === value);
      if (selectedTour && selectedTour.start_date && selectedTour.end_date) {
        console.log('Immediate tour date auto-fill:', {
          checkIn: selectedTour.start_date,
          checkOut: selectedTour.end_date
        });
        
        setFormData(prev => ({
          ...prev,
          [field]: value,
          check_in_date: selectedTour.start_date,
          check_out_date: selectedTour.end_date,
        }));
        setHasUnsavedChanges(true);
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tour_id) {
      alert('Please select a tour');
      return;
    }
    
    if (!formData.lead_passenger_name || !formData.lead_passenger_email) {
      alert('Please provide lead passenger name and email');
      return;
    }

    // Clean up date fields - convert empty strings to null
    const cleanedFormData = {
      ...formData,
      check_in_date: formData.check_in_date || null,
      check_out_date: formData.check_out_date || null,
      passport_expiry_date: formData.passport_expiry_date || null,
    };

    createBooking.mutate(cleanedFormData, {
      onSuccess: (data) => {
        setCreatedBookingId(data.id);
        setHasUnsavedChanges(false);
        
        // Navigate to next tab based on accommodation requirement
        if (formData.accommodation_required) {
          setActiveTab("hotels");
        } else {
          setActiveTab("activities");
        }
      }
    });
  };

  const handleTabUpdate = (nextTab?: string) => {
    setHasUnsavedChanges(false);
    if (nextTab) {
      setActiveTab(nextTab);
    } else {
      // If no next tab specified, close the modal
      handleClose();
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmClose = window.confirm("You have unsaved changes. Are you sure you want to close?");
      if (!confirmClose) return;
    }
    
    // Reset form and state
    setFormData({
      tour_id: preSelectedTourId || '',
      lead_passenger_name: '',
      lead_passenger_email: '',
      lead_passenger_phone: '',
      passenger_count: 1,
      passenger_2_name: '',
      passenger_3_name: '',
      group_name: '',
      booking_agent: '',
      status: defaultStatus,
      extra_requests: '',
      accommodation_required: true,
      check_in_date: '',
      check_out_date: '',
      invoice_notes: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relationship: '',
      passport_number: '',
      passport_expiry_date: '',
      passport_country: '',
      id_number: '',
      nationality: '',
      medical_conditions: '',
      accessibility_needs: '',
      dietary_restrictions: '',
    });
    setSelectedContact(null);
    setLeadPassengerName('');
    setCreatedBookingId(null);
    setActiveTab("details");
    setHasUnsavedChanges(false);
    onOpenChange(false);
  };

  const isWaitlistMode = defaultStatus === 'waitlisted';

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isWaitlistMode ? 'Add to Waitlist' : 'Add New Booking'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="hotels" className="flex items-center gap-1" disabled={!createdBookingId}>
                <MapPin className="h-4 w-4" />
                Hotels
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center gap-1" disabled={!createdBookingId}>
                <Calendar className="h-4 w-4" />
                Activities
              </TabsTrigger>
              <TabsTrigger value="medical" className="flex items-center gap-1" disabled={!createdBookingId}>
                <Heart className="h-4 w-4" />
                Medical & Emergency
              </TabsTrigger>
              <TabsTrigger value="travel" className="flex items-center gap-1" disabled={!createdBookingId}>
                <FileText className="h-4 w-4" />
                Travel Docs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <form onSubmit={handleCreateBooking} className="space-y-4">
                {/* Lead Passenger Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-brand-navy flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Lead Passenger Information
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddContact(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Contact
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ContactSearch
                      value={leadPassengerName}
                      onValueChange={setLeadPassengerName}
                      onContactSelect={handleContactSelect}
                      selectedContactId={selectedContact?.id || ''}
                    />
                    
                    <div>
                      <Label htmlFor="lead_passenger_email">Email *</Label>
                      <Input
                        id="lead_passenger_email"
                        type="email"
                        value={formData.lead_passenger_email}
                        onChange={(e) => handleFormChange('lead_passenger_email', e.target.value)}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="lead_passenger_phone">Phone</Label>
                      <Input
                        id="lead_passenger_phone"
                        value={formData.lead_passenger_phone}
                        onChange={(e) => handleFormChange('lead_passenger_phone', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <BookingDetailsForm 
                  formData={formData}
                  setFormData={handleFormChange}
                  tours={tours}
                  preSelectedTourId={preSelectedTourId}
                  isWaitlistMode={isWaitlistMode}
                />

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createBooking.isPending}
                    className={isWaitlistMode ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"}
                  >
                    {createBooking.isPending ? 'Creating...' : (isWaitlistMode ? 'Add to Waitlist' : 'Create Booking')}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="hotels" className="space-y-4">
              {createdBookingId && formData.tour_id ? (
                <>
                  <HotelAllocationSection
                    tourId={formData.tour_id}
                    bookingId={createdBookingId}
                    accommodationRequired={formData.accommodation_required}
                    defaultCheckIn={formData.check_in_date}
                    defaultCheckOut={formData.check_out_date}
                    onUpdate={() => setHasUnsavedChanges(false)}
                  />
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Close
                    </Button>
                    <Button 
                      onClick={() => handleTabUpdate("activities")}
                      className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                    >
                      Next: Activities
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Please create the booking first to manage hotel allocations.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              {createdBookingId && formData.tour_id ? (
                <>
                  <ActivityAllocationSection
                    tourId={formData.tour_id}
                    bookingId={createdBookingId}
                    passengerCount={formData.passenger_count}
                  />
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Close
                    </Button>
                    <Button 
                      onClick={() => handleTabUpdate("medical")}
                      className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                    >
                      Next: Medical & Emergency
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Please create the booking first to manage activity allocations.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="medical" className="space-y-4">
              <div className="grid grid-cols-1 gap-6">
                {/* Emergency Contact Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="text-lg font-medium text-brand-navy flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Emergency Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                      <Input
                        id="emergency_contact_name"
                        value={formData.emergency_contact_name}
                        onChange={(e) => handleFormChange('emergency_contact_name', e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                      <Input
                        id="emergency_contact_phone"
                        value={formData.emergency_contact_phone}
                        onChange={(e) => handleFormChange('emergency_contact_phone', e.target.value)}
                        placeholder="Phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                      <Input
                        id="emergency_contact_relationship"
                        value={formData.emergency_contact_relationship}
                        onChange={(e) => handleFormChange('emergency_contact_relationship', e.target.value)}
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
                    <Label htmlFor="medical_conditions">Medical Conditions</Label>
                    <Textarea
                      id="medical_conditions"
                      value={formData.medical_conditions}
                      onChange={(e) => handleFormChange('medical_conditions', e.target.value)}
                      placeholder="Any medical conditions, allergies, or medications..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="accessibility_needs">Accessibility Needs</Label>
                    <Textarea
                      id="accessibility_needs"
                      value={formData.accessibility_needs}
                      onChange={(e) => handleFormChange('accessibility_needs', e.target.value)}
                      placeholder="Mobility assistance, wheelchair access, etc..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dietary_restrictions">Dietary Requirements</Label>
                    <Textarea
                      id="dietary_restrictions"
                      value={formData.dietary_restrictions}
                      onChange={(e) => handleFormChange('dietary_restrictions', e.target.value)}
                      placeholder="Food allergies, dietary preferences, etc..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button 
                  onClick={() => handleTabUpdate("travel")}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  Next: Travel Documents
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="travel" className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-brand-navy">Travel Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="passport_number">Passport Number</Label>
                    <Input
                      id="passport_number"
                      value={formData.passport_number}
                      onChange={(e) => handleFormChange('passport_number', e.target.value)}
                      placeholder="Passport number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passport_expiry_date">Passport Expiry Date</Label>
                    <Input
                      id="passport_expiry_date"
                      type="date"
                      value={formData.passport_expiry_date}
                      onChange={(e) => handleFormChange('passport_expiry_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="passport_country">Passport Issuing Country</Label>
                    <Input
                      id="passport_country"
                      value={formData.passport_country}
                      onChange={(e) => handleFormChange('passport_country', e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nationality">Nationality</Label>
                    <Input
                      id="nationality"
                      value={formData.nationality}
                      onChange={(e) => handleFormChange('nationality', e.target.value)}
                      placeholder="Nationality"
                    />
                  </div>
                  <div>
                    <Label htmlFor="id_number">National ID Number</Label>
                    <Input
                      id="id_number"
                      value={formData.id_number}
                      onChange={(e) => handleFormChange('id_number', e.target.value)}
                      placeholder="National ID or driver's license"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button 
                  onClick={() => handleTabUpdate()}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  Update & Complete
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>

        <AddContactModal 
          open={showAddContact} 
          onOpenChange={setShowAddContact}
          onContactCreated={handleContactCreated}
        />
      </Dialog>
    </>
  );
};
