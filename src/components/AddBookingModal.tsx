import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateBooking } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { useUpdateCustomer } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRecalculateBookingDates } from "@/hooks/useRecalculateBookingDates";
import { useBookingFormState } from "@/hooks/useBookingFormState";

import { ContactSearch } from "@/components/booking/ContactSearch";
import { BookingDetailsForm } from "@/components/booking/BookingDetailsForm";
import { LeadPassengerSection } from "@/components/booking/LeadPassengerSection";
import { HotelAllocationTab } from "@/components/booking/HotelAllocationTab";
import { ActivityAllocationTab } from "@/components/booking/ActivityAllocationTab";
import { MedicalDetailsTab } from "@/components/booking/MedicalDetailsTab";
import { AddContactModal } from "@/components/AddContactModal";
import { BookingConfirmationDialog } from "@/components/BookingConfirmationDialog";
import { UserPlus, X } from "lucide-react";
import { useHotels } from "@/hooks/useHotels";
import { useActivities } from "@/hooks/useActivities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AddBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedTourId?: string;
  defaultStatus?: string;
  preSelectedTourStartDate?: string;
  preSelectedTourEndDate?: string;
}

export const AddBookingModal = ({ 
  open, 
  onOpenChange, 
  preSelectedTourId, 
  defaultStatus = "invoiced", 
  preSelectedTourStartDate, 
  preSelectedTourEndDate 
}: AddBookingModalProps) => {
  const [selectedContact, setSelectedContact] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    dietary_requirements: string | null;
    medical_conditions: string | null;
    accessibility_needs: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    emergency_contact_relationship: string | null;
  } | null>(null);

  const [selectedSecondaryContact, setSelectedSecondaryContact] = useState<any>(null);
  const [selectedPassenger2, setSelectedPassenger2] = useState<any>(null);
  const [selectedPassenger3, setSelectedPassenger3] = useState<any>(null);
  const [leadPassengerName, setLeadPassengerName] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [addingContactFor, setAddingContactFor] = useState<'lead' | 'secondary' | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showNoHotelsWarning, setShowNoHotelsWarning] = useState(false);
  
  const {
    formData,
    handleFormChange,
    hotelAllocations,
    setHotelAllocations,
    activityAllocations,
    setActivityAllocations,
    medicalFormData,
    setMedicalFormData,
    buildHotelAllocations,
    initializeHotelAllocations,
    initializeActivityAllocations,
    prefillMedicalFromContact,
  } = useBookingFormState({
    preSelectedTourId,
    defaultStatus,
    preSelectedTourStartDate,
    preSelectedTourEndDate,
    isOpen: open,
  });

  const { data: tours } = useTours();
  const createBooking = useCreateBooking();
  const updateCustomer = useUpdateCustomer();
  const recalculateBookingDates = useRecalculateBookingDates();
  const { toast } = useToast();
  
  const { data: hotels = [] } = useHotels(formData.tour_id);
  const { data: activities = [] } = useActivities(formData.tour_id);

  // Reset contact-related state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedContact(null);
      setSelectedSecondaryContact(null);
      setSelectedPassenger2(null);
      setSelectedPassenger3(null);
      setLeadPassengerName('');
      setActiveTab("details");
    }
  }, [open]);

  // Initialize hotel allocations when hotels load
  useEffect(() => {
    if (!open || hotels.length === 0) return;
    initializeHotelAllocations(hotels);
  }, [open, hotels, formData.accommodation_required]);

  // Initialize activity allocations when activities load
  useEffect(() => {
    if (!open || activities.length === 0) return;
    initializeActivityAllocations(activities);
  }, [open, activities, formData.passenger_count]);
  
  // Set default dates to tour start/end when tour is selected and no hotels exist
  useEffect(() => {
    if (!formData.tour_id || !formData.accommodation_required) return;
    if (hotels.length !== 0) return;

    const selectedTour = tours?.find((t) => t.id === formData.tour_id);
    if (!selectedTour) return;

    if (!formData.check_in_date || !formData.check_out_date) {
      handleFormChange('check_in_date', formData.check_in_date || selectedTour.start_date);
      handleFormChange('check_out_date', formData.check_out_date || selectedTour.end_date);
    }
  }, [formData.tour_id, formData.accommodation_required, hotels.length, tours]);

  // Pre-set tour ID from props
  useEffect(() => {
    if (preSelectedTourId && tours && tours.length > 0) {
      if (preSelectedTourStartDate && preSelectedTourEndDate) {
        handleFormChange('tour_id', preSelectedTourId);
        handleFormChange('check_in_date', preSelectedTourStartDate);
        handleFormChange('check_out_date', preSelectedTourEndDate);
      } else {
        const selectedTour = tours.find(tour => tour.id === preSelectedTourId);
        if (selectedTour) {
          handleFormChange('tour_id', preSelectedTourId);
        }
      }
    }
  }, [preSelectedTourId, tours]);

  // Sync contact data to form
  useEffect(() => {
    if (selectedContact) {
      const fullName = `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim();
      handleFormChange('lead_passenger_name', fullName);
      handleFormChange('lead_passenger_email', selectedContact.email || '');
      handleFormChange('lead_passenger_phone', selectedContact.phone || '');
      setLeadPassengerName(fullName);
      prefillMedicalFromContact(selectedContact);
    }
  }, [selectedContact]);

  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
  };

  const handleSecondaryContactSelect = (customer: any) => {
    setSelectedSecondaryContact(customer);
    handleFormChange('secondary_contact_id', customer ? customer.id : "");
    handleFormChange('secondary_contact_search', customer ? `${customer.first_name} ${customer.last_name}` : "");
  };

  const handleAddContactClick = (contactType: 'lead' | 'secondary') => {
    setAddingContactFor(contactType);
    setShowAddContact(true);
  };

  const handleContactCreated = (contact: any) => {
    if (addingContactFor === 'lead') {
      setSelectedContact(contact);
    } else if (addingContactFor === 'secondary') {
      handleSecondaryContactSelect(contact);
    }
    setAddingContactFor(null);
    setShowAddContact(false);
  };

  const handleContinueToNextTab = () => {
    if (activeTab === "details") {
      if (!selectedContact) {
        toast({
          title: "Error",
          description: "Please select a lead passenger contact from the dropdown.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.tour_id) {
        toast({
          title: "Error",
          description: "Please select a tour.",
          variant: "destructive",
        });
        return;
      }
      
      // Safety check: ensure hotel allocations are properly set before showing hotels tab
      if (hotels.length > 0 && formData.accommodation_required) {
        const hasUnallocated = hotels.some(h => !hotelAllocations[h.id]?.allocated);
        if (hasUnallocated) {
          setHotelAllocations(buildHotelAllocations(
            hotels, 
            formData.accommodation_required, 
            formData.passenger_count, 
            hotelAllocations
          ));
        }
      }
      
      setActiveTab("hotels");
    } else if (activeTab === "hotels") {
      setActiveTab("activities");
    } else if (activeTab === "activities") {
      setActiveTab("medical");
    } else if (activeTab === "medical") {
      handleShowConfirmation();
    }
  };

  const handleShowConfirmation = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!selectedContact) {
      toast({
        title: "Error",
        description: "Please select a lead passenger contact from the dropdown.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.tour_id) {
      toast({
        title: "Error",
        description: "Please select a tour.",
        variant: "destructive",
      });
      return;
    }

    // Validate invoice reference is provided
    if (!formData.invoice_reference || formData.invoice_reference.trim() === '') {
      toast({
        title: "Invoice Reference Required",
        description: "Please enter an invoice reference number. Use 0 for host or complimentary bookings.",
        variant: "destructive",
      });
      setActiveTab("details");
      return;
    }

    // Validate bedding types match passenger count for allocated hotels
    if (formData.accommodation_required) {
      const allocatedHotels = Object.entries(hotelAllocations).filter(([_, allocation]) => allocation.allocated);
      
      if (hotels.length > 0 && allocatedHotels.length === 0) {
        setValidationError("Hotel must be allocated if accommodation is required for this booking. Please allocate at least one hotel in the Hotels tab.");
        setActiveTab("hotels");
        return;
      }
      
      if (hotels.length === 0) {
        setShowNoHotelsWarning(true);
        return;
      }
      
      if (formData.passenger_count === 1) {
        const invalidBedding = allocatedHotels.find(([_, allocation]) => allocation.bedding !== 'single');
        if (invalidBedding) {
          setValidationError("Single passenger bookings can only have Single bedding. Please update the Hotels tab before creating this booking.");
          setActiveTab("hotels");
          return;
        }
      } else if (formData.passenger_count >= 2) {
        const singleBedding = allocatedHotels.find(([_, allocation]) => allocation.bedding === 'single');
        if (singleBedding) {
          setValidationError(`You have ${formData.passenger_count} passengers but Single bedding selected. Please update to Double, Twin, Triple, or Family in the Hotels tab before creating this booking.`);
          setActiveTab("hotels");
          return;
        }
      }
    }

    // Validate second passenger name is filled when passenger count is 2 or more
    if (formData.passenger_count >= 2) {
      if (!formData.passenger_2_name || formData.passenger_2_name.trim() === '') {
        setValidationError("Second passenger name is required when booking for 2 or more passengers. Please add the second passenger's name in the Details tab.");
        setActiveTab("details");
        return;
      }
    }

    setShowConfirmation(true);
  };

  const handleCreateBooking = async () => {
    try {
      const cleanedFormData = {
        ...formData,
        passport_expiry_date: formData.passport_expiry_date || null,
        secondary_contact_id: formData.secondary_contact_id || null,
        passenger_2_id: formData.passenger_2_id || null,
        passenger_3_id: formData.passenger_3_id || null,
      };

      const newBooking = await createBooking.mutateAsync(cleanedFormData);
      console.log('Booking created:', newBooking);
      
      // Save hotel allocations
      const hotelInserts = Object.entries(hotelAllocations)
        .filter(([_, allocation]) => allocation.allocated)
        .map(([hotelId, allocation]) => {
          const checkIn = (allocation.check_in_date || formData.check_in_date) || null;
          const checkOut = (allocation.check_out_date || formData.check_out_date) || null;
          
          let nights = null;
          if (checkIn && checkOut) {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const diffTime = checkOutDate.getTime() - checkInDate.getTime();
            nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
          
          return {
            booking_id: newBooking.id,
            hotel_id: hotelId,
            required: true,
            allocated: true,
            check_in_date: checkIn || null,
            check_out_date: checkOut || null,
            nights: nights,
            bedding: (allocation.bedding || 'double') as 'single' | 'double' | 'twin',
            room_type: allocation.room_type || null,
            room_upgrade: allocation.room_upgrade || null,
            confirmation_number: allocation.confirmation_number || null,
            room_requests: allocation.room_requests || null,
          };
        });

      if (hotelInserts.length > 0) {
        const { error: hotelError } = await supabase
          .from('hotel_bookings')
          .insert(hotelInserts)
          .select();
        
        if (hotelError) {
          console.error('Error creating hotel bookings:', hotelError);
          throw new Error(`Failed to save hotel allocations: ${hotelError.message}`);
        }
      }

      // Recalculate booking dates
      if (cleanedFormData.accommodation_required) {
        await recalculateBookingDates.mutateAsync(newBooking.id);
      }

      // Save activity allocations
      const activityInserts = Object.entries(activityAllocations)
        .filter(([_, count]) => count > 0)
        .map(([activityId, count]) => ({
          booking_id: newBooking.id,
          activity_id: activityId,
          passengers_attending: count,
        }));

      if (activityInserts.length > 0) {
        const { error: activityError } = await supabase
          .from('activity_bookings')
          .insert(activityInserts)
          .select();
        
        if (activityError) {
          console.error('Error creating activity bookings:', activityError);
          throw new Error(`Failed to save activity allocations: ${activityError.message}`);
        }
      }

      // Update customer with medical/emergency contact info if changed
      if (selectedContact) {
        const hasChanges = 
          medicalFormData.dietary_requirements !== (selectedContact.dietary_requirements || '') ||
          medicalFormData.medical_conditions !== (selectedContact.medical_conditions || '') ||
          medicalFormData.accessibility_needs !== (selectedContact.accessibility_needs || '') ||
          medicalFormData.emergency_contact_name !== (selectedContact.emergency_contact_name || '') ||
          medicalFormData.emergency_contact_phone !== (selectedContact.emergency_contact_phone || '') ||
          medicalFormData.emergency_contact_relationship !== (selectedContact.emergency_contact_relationship || '');

        if (hasChanges) {
          await updateCustomer.mutateAsync({
            id: selectedContact.id,
            dietary_requirements: medicalFormData.dietary_requirements || null,
            medical_conditions: medicalFormData.medical_conditions || null,
            accessibility_needs: medicalFormData.accessibility_needs || null,
            emergency_contact_name: medicalFormData.emergency_contact_name || null,
            emergency_contact_phone: medicalFormData.emergency_contact_phone || null,
            emergency_contact_relationship: medicalFormData.emergency_contact_relationship || null,
          });
        }
      }
      
      toast({
        title: "Success",
        description: `Booking created successfully with hotels and activities!`,
      });
      
      setShowConfirmation(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getConfirmationData = () => {
    const selectedTour = tours?.find(t => t.id === formData.tour_id);
    
    const otherPassengers = [];
    if (selectedPassenger2) {
      otherPassengers.push(`${selectedPassenger2.first_name} ${selectedPassenger2.last_name}${selectedPassenger2.email ? ` (${selectedPassenger2.email})` : ''}`);
    } else if (formData.passenger_2_name) {
      otherPassengers.push(formData.passenger_2_name);
    }
    if (selectedPassenger3) {
      otherPassengers.push(`${selectedPassenger3.first_name} ${selectedPassenger3.last_name}${selectedPassenger3.email ? ` (${selectedPassenger3.email})` : ''}`);
    } else if (formData.passenger_3_name) {
      otherPassengers.push(formData.passenger_3_name);
    }
    
    const allocatedHotels = hotels
      .filter(hotel => hotelAllocations[hotel.id]?.allocated)
      .map(hotel => ({
        name: hotel.name,
        checkIn: hotelAllocations[hotel.id].check_in_date,
        checkOut: hotelAllocations[hotel.id].check_out_date,
        bedding: hotelAllocations[hotel.id].bedding,
      }));
    
    const selectedActivities = activities
      .filter(activity => activityAllocations[activity.id] > 0)
      .map(activity => ({
        name: activity.name,
        paxCount: activityAllocations[activity.id],
      }));

    return {
      leadPassenger: {
        firstName: selectedContact?.first_name || '',
        lastName: selectedContact?.last_name || '',
        email: selectedContact?.email || '',
      },
      otherPassengers,
      tourName: selectedTour?.name || '',
      passengerCount: formData.passenger_count,
      checkInDate: formData.check_in_date,
      checkOutDate: formData.check_out_date,
      bedding: formData.accommodation_required ? 'As per hotel allocations' : 'N/A',
      whatsappGroupComms: formData.whatsapp_group_comms,
      hotels: allocatedHotels,
      activities: selectedActivities,
    };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {defaultStatus === 'waitlisted' ? 'Add to Waitlist' : 'Add New Booking'}
              </DialogTitle>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="hotels">Hotels</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="medical">Medical</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <LeadPassengerSection
                formData={{
                  leadPassenger: leadPassengerName,
                  leadEmail: formData.lead_passenger_email,
                  leadPhone: formData.lead_passenger_phone,
                  leadDietary: selectedContact?.dietary_requirements || '',
                }}
                onInputChange={(field, value) => {
                  if (field === 'leadPassenger') setLeadPassengerName(value);
                  else if (field === 'leadEmail') handleFormChange('lead_passenger_email', value);
                  else if (field === 'leadPhone') handleFormChange('lead_passenger_phone', value);
                }}
                onContactSelect={handleContactSelect}
                onEditContact={() => {
                  if (selectedContact) {
                    setShowAddContact(true);
                    setAddingContactFor('lead');
                  }
                }}
                onAddNewContact={() => handleAddContactClick('lead')}
                selectedContactId={selectedContact?.id || ''}
                selectedContact={selectedContact}
              />

              <div className="space-y-4">
                <BookingDetailsForm
                  formData={formData}
                  setFormData={handleFormChange}
                  tours={tours}
                  preSelectedTourId={preSelectedTourId}
                  isWaitlistMode={formData.status === 'waitlisted'}
                  onSecondaryContactSelect={handleSecondaryContactSelect}
                  selectedSecondaryContact={selectedSecondaryContact}
                  selectedPassenger2={selectedPassenger2}
                  selectedPassenger3={selectedPassenger3}
                  onPassenger2Select={setSelectedPassenger2}
                  onPassenger3Select={setSelectedPassenger3}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddContactClick('secondary')}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add New Contact for Secondary
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  type="button"
                  onClick={handleContinueToNextTab}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  Continue to Hotels
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="hotels">
              <HotelAllocationTab
                hotels={hotels}
                hotelAllocations={hotelAllocations}
                setHotelAllocations={setHotelAllocations}
                accommodationRequired={formData.accommodation_required}
                passengerCount={formData.passenger_count}
                onBack={() => setActiveTab("details")}
                onContinue={handleContinueToNextTab}
              />
            </TabsContent>

            <TabsContent value="activities">
              <ActivityAllocationTab
                activities={activities}
                activityAllocations={activityAllocations}
                setActivityAllocations={setActivityAllocations}
                passengerCount={formData.passenger_count}
                onBack={() => setActiveTab("hotels")}
                onContinue={handleContinueToNextTab}
              />
            </TabsContent>

            <TabsContent value="medical">
              <MedicalDetailsTab
                medicalFormData={medicalFormData}
                setMedicalFormData={setMedicalFormData}
                hasSelectedContact={!!selectedContact}
                onBack={() => setActiveTab("activities")}
                onContinue={handleContinueToNextTab}
                isWaitlistMode={defaultStatus === 'waitlisted'}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AddContactModal 
        open={showAddContact} 
        onOpenChange={setShowAddContact}
        onContactCreated={handleContactCreated}
      />

      <BookingConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        onConfirm={handleCreateBooking}
        isCreating={createBooking.isPending}
        bookingData={getConfirmationData()}
      />

      <AlertDialog open={!!validationError} onOpenChange={() => setValidationError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Validation Error</AlertDialogTitle>
            <AlertDialogDescription>
              {validationError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setValidationError(null)}>
              OK, I'll fix it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNoHotelsWarning} onOpenChange={() => setShowNoHotelsWarning(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Hotels Loaded</AlertDialogTitle>
            <AlertDialogDescription>
              This tour does not have any hotels loaded in the system yet. Please load hotels when ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowNoHotelsWarning(false);
              setShowConfirmation(true);
            }}>
              OK, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
