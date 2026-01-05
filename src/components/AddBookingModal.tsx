import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateBooking } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRecalculateBookingDates } from "@/hooks/useRecalculateBookingDates";

import { ContactSearch } from "@/components/booking/ContactSearch";
import { BookingDetailsForm } from "@/components/booking/BookingDetailsForm";
import { LeadPassengerSection } from "@/components/booking/LeadPassengerSection";
import { AddContactModal } from "@/components/AddContactModal";
import { BookingConfirmationDialog } from "@/components/BookingConfirmationDialog";
import { UserPlus } from "lucide-react";
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

export const AddBookingModal = ({ open, onOpenChange, preSelectedTourId, defaultStatus = "invoiced", preSelectedTourStartDate, preSelectedTourEndDate }: AddBookingModalProps) => {
  const [selectedContact, setSelectedContact] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    dietary_requirements: string | null;
  } | null>(null);
  const [selectedSecondaryContact, setSelectedSecondaryContact] = useState<any>(null);
  const [leadPassengerName, setLeadPassengerName] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [addingContactFor, setAddingContactFor] = useState<'lead' | 'secondary' | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showNoHotelsWarning, setShowNoHotelsWarning] = useState(false);
  
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
    status: defaultStatus || 'invoiced',
    extra_requests: '',
    accommodation_required: true,
    check_in_date: '',
    check_out_date: '',
    invoice_notes: '',
    secondary_contact_id: '',
    secondary_contact_search: '',
    
    // Travel documents
    passport_number: '',
    passport_expiry_date: '',
    passport_country: '',
    id_number: '',
    nationality: '',
  });

  const [hotelAllocations, setHotelAllocations] = useState<Record<string, {
    allocated: boolean;
    check_in_date: string;
    check_out_date: string;
    bedding: string;
    room_type?: string;
    room_upgrade?: string;
    confirmation_number?: string;
    room_requests?: string;
  }>>({});

  const [activityAllocations, setActivityAllocations] = useState<Record<string, number>>({});

  const { data: tours } = useTours();
  const createBooking = useCreateBooking();
  const recalculateBookingDates = useRecalculateBookingDates();
  const { toast } = useToast();
  
  const { data: hotels = [] } = useHotels(formData.tour_id);
  const { data: activities = [] } = useActivities(formData.tour_id);
  
  // Helper function to build hotel allocations - single source of truth
  const buildHotelAllocations = (
    hotelsList: typeof hotels,
    accommodationRequired: boolean,
    passengerCount: number,
    existingAllocations: typeof hotelAllocations = {}
  ) => {
    const allocations: Record<string, any> = {};
    
    hotelsList.forEach(hotel => {
      const existing = existingAllocations[hotel.id];
      allocations[hotel.id] = {
        allocated: accommodationRequired,
        check_in_date: existing?.check_in_date || hotel.default_check_in || preSelectedTourStartDate || '',
        check_out_date: existing?.check_out_date || hotel.default_check_out || preSelectedTourEndDate || '',
        bedding: passengerCount === 1 ? 'single' : (existing?.bedding || 'double'),
        room_type: existing?.room_type || hotel.default_room_type || '',
        room_upgrade: existing?.room_upgrade || '',
        confirmation_number: existing?.confirmation_number || '',
        room_requests: existing?.room_requests || '',
      };
    });
    
    return allocations;
  };
  
  // Single effect to manage hotel allocations - runs when hotels load or accommodation changes
  useEffect(() => {
    if (!open || hotels.length === 0) return;
    
    const newAllocations = buildHotelAllocations(
      hotels,
      formData.accommodation_required,
      formData.passenger_count,
      hotelAllocations
    );
    
    // Only update if there's an actual change to prevent infinite loops
    const hasChanges = hotels.some(hotel => {
      const existing = hotelAllocations[hotel.id];
      const newAlloc = newAllocations[hotel.id];
      return !existing || existing.allocated !== newAlloc.allocated;
    });
    
    if (hasChanges || Object.keys(hotelAllocations).length === 0) {
      setHotelAllocations(newAllocations);
    }
  }, [open, hotels, formData.accommodation_required]);
  
  // Update bedding when passenger count changes
  useEffect(() => {
    if (Object.keys(hotelAllocations).length === 0) return;
    
    const needsBeddingUpdate = formData.passenger_count === 1 && 
      Object.values(hotelAllocations).some(a => a.bedding !== 'single');
    
    if (needsBeddingUpdate) {
      const updatedAllocations = { ...hotelAllocations };
      Object.keys(updatedAllocations).forEach(hotelId => {
        updatedAllocations[hotelId] = { ...updatedAllocations[hotelId], bedding: 'single' };
      });
      setHotelAllocations(updatedAllocations);
    }
  }, [formData.passenger_count]);

  // Initialize activity allocations when activities load
  useEffect(() => {
    if (!open || activities.length === 0) return;
    
    const initialAllocations: Record<string, number> = {};
    activities.forEach(activity => {
      initialAllocations[activity.id] = formData.passenger_count;
    });
    setActivityAllocations(initialAllocations);
  }, [open, activities, formData.passenger_count]);
  
  // Set default dates to tour start/end when tour is selected and no hotels exist
  useEffect(() => {
    if (formData.tour_id) {
      const selectedTour = tours?.find(t => t.id === formData.tour_id);
      if (selectedTour && hotels.length === 0 && formData.accommodation_required) {
        setFormData(prev => ({
          ...prev,
          checkInDate: selectedTour.start_date,
          checkOutDate: selectedTour.end_date,
        }));
      }
    }
  }, [formData.tour_id, hotels, formData.accommodation_required, tours]);

  useEffect(() => {
    if (preSelectedTourId) {
      if (preSelectedTourStartDate && preSelectedTourEndDate) {
        setFormData(prev => ({
          ...prev,
          tour_id: preSelectedTourId,
          check_in_date: preSelectedTourStartDate,
          check_out_date: preSelectedTourEndDate,
        }));
      } else if (tours && tours.length > 0) {
        const selectedTour = tours.find(tour => tour.id === preSelectedTourId);
        if (selectedTour) {
          setFormData(prev => ({
            ...prev,
            tour_id: preSelectedTourId,
          }));
        }
      }
    }
  }, [preSelectedTourId, tours]);

  useEffect(() => {
    if (open) {
      const initialCheckIn = preSelectedTourStartDate || '';
      const initialCheckOut = preSelectedTourEndDate || '';
      
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
        status: defaultStatus || 'invoiced',
        extra_requests: '',
        accommodation_required: true,
        check_in_date: initialCheckIn,
        check_out_date: initialCheckOut,
        invoice_notes: '',
        secondary_contact_id: '',
        secondary_contact_search: '',
        passport_number: '',
        passport_expiry_date: '',
        passport_country: '',
        id_number: '',
        nationality: '',
      });
      setSelectedContact(null);
      setSelectedSecondaryContact(null);
      setLeadPassengerName('');
      setHotelAllocations({});
      setActivityAllocations({});
      setActiveTab("details");
    }
  }, [open, preSelectedTourId, defaultStatus, preSelectedTourStartDate, preSelectedTourEndDate]);

  useEffect(() => {
    if (selectedContact) {
      const fullName = `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        lead_passenger_name: fullName,
        lead_passenger_email: selectedContact.email || '',
        lead_passenger_phone: selectedContact.phone || '',
      }));
      setLeadPassengerName(fullName);
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
  
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
      setActiveTab("travel");
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

    // Validate bedding types match passenger count for allocated hotels
    if (formData.accommodation_required) {
      const allocatedHotels = Object.entries(hotelAllocations).filter(([_, allocation]) => allocation.allocated);
      
      // Check if tour has hotels but none are allocated
      if (hotels.length > 0 && allocatedHotels.length === 0) {
        setValidationError("Hotel must be allocated if accommodation is required for this booking. Please allocate at least one hotel in the Hotels tab.");
        setActiveTab("hotels");
        return;
      }
      
      // Check if tour has no hotels loaded at all
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

    // Show confirmation dialog instead of creating booking directly
    setShowConfirmation(true);
  };

  const handleCreateBooking = async () => {
    try {
      const cleanedFormData = {
        ...formData,
        passport_expiry_date: formData.passport_expiry_date || null,
        secondary_contact_id: formData.secondary_contact_id || null,
      };

      // Create the booking first
      const newBooking = await createBooking.mutateAsync(cleanedFormData);
      console.log('Booking created:', newBooking);
      
      // Save hotel allocations - use direct Supabase insert for better error handling
      const hotelInserts = Object.entries(hotelAllocations)
        .filter(([_, allocation]) => allocation.allocated)
        .map(([hotelId, allocation]) => {
          // Convert empty strings to null for date fields
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
            check_in_date: checkIn || null, // Ensure empty string becomes null
            check_out_date: checkOut || null, // Ensure empty string becomes null
            nights: nights,
            bedding: (allocation.bedding || 'double') as 'single' | 'double' | 'twin',
            room_type: allocation.room_type || null,
            room_upgrade: allocation.room_upgrade || null,
            confirmation_number: allocation.confirmation_number || null,
            room_requests: allocation.room_requests || null,
          };
        });

      if (hotelInserts.length > 0) {
        const { data: hotelData, error: hotelError } = await supabase
          .from('hotel_bookings')
          .insert(hotelInserts)
          .select();
        
        if (hotelError) {
          console.error('Error creating hotel bookings:', hotelError);
          throw new Error(`Failed to save hotel allocations: ${hotelError.message}`);
        }
        console.log('Hotel bookings created:', hotelData);
        
        // Recalculate booking dates immediately after hotel bookings are created
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
        const { data: activityData, error: activityError } = await supabase
          .from('activity_bookings')
          .insert(activityInserts)
          .select();
        
        if (activityError) {
          console.error('Error creating activity bookings:', activityError);
          throw new Error(`Failed to save activity allocations: ${activityError.message}`);
        }
        console.log('Activity bookings created:', activityData);
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

  // Prepare confirmation data
  const getConfirmationData = () => {
    const selectedTour = tours?.find(t => t.id === formData.tour_id);
    
    const otherPassengers = [];
    if (formData.passenger_2_name) otherPassengers.push(formData.passenger_2_name);
    if (formData.passenger_3_name) otherPassengers.push(formData.passenger_3_name);
    
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
      hotels: allocatedHotels,
      activities: selectedActivities,
    };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {defaultStatus === 'waitlisted' ? 'Add to Waitlist' : 'Add New Booking'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="hotels">Hotels</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="medical">Medical</TabsTrigger>
              <TabsTrigger value="travel">Travel Docs</TabsTrigger>
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
                  // Dietary is now managed on the contact, not the booking
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

            <TabsContent value="hotels" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Hotel Allocations</h3>
                {!formData.accommodation_required ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Accommodation not required for this booking.</p>
                  </div>
                ) : hotels && hotels.length > 0 ? (
                  hotels.map((hotel) => {
                    const allocation = hotelAllocations[hotel.id] || {
                      allocated: false,
                      check_in_date: hotel.default_check_in || '',
                      check_out_date: hotel.default_check_out || '',
                      bedding: 'double',
                      room_type: hotel.default_room_type || '',
                    };

                    return (
                      <Card key={hotel.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            {hotel.name}
                            <Switch
                              checked={allocation.allocated}
                              onCheckedChange={(checked) => {
                                setHotelAllocations(prev => ({
                                  ...prev,
                                  [hotel.id]: { ...allocation, allocated: checked }
                                }));
                              }}
                            />
                          </CardTitle>
                        </CardHeader>
                        {allocation.allocated && (
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label>Check In Date</Label>
                                <Input
                                  type="date"
                                  value={allocation.check_in_date}
                                  onChange={(e) => {
                                    setHotelAllocations(prev => ({
                                      ...prev,
                                      [hotel.id]: { ...allocation, check_in_date: e.target.value }
                                    }));
                                  }}
                                />
                              </div>
                              <div>
                                <Label>Check Out Date</Label>
                                <Input
                                  type="date"
                                  value={allocation.check_out_date}
                                  onChange={(e) => {
                                    setHotelAllocations(prev => ({
                                      ...prev,
                                      [hotel.id]: { ...allocation, check_out_date: e.target.value }
                                    }));
                                  }}
                                />
                              </div>
                              <div>
                                <Label>Bedding Type</Label>
                                <Select 
                                  value={allocation.bedding} 
                                  onValueChange={(value) => {
                                    if (formData.passenger_count === 1 && value !== 'single') {
                                      toast({
                                        title: "Invalid Selection",
                                        description: "Single passenger bookings can only have Single bedding.",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    if (formData.passenger_count >= 2 && value === 'single') {
                                      toast({
                                        title: "Invalid Selection",
                                        description: `You have ${formData.passenger_count} passengers. Single bedding is not appropriate. Please select Double, Twin, Triple, or Family.`,
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    setHotelAllocations(prev => ({
                                      ...prev,
                                      [hotel.id]: { ...allocation, bedding: value }
                                    }));
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem 
                                      value="single"
                                      disabled={formData.passenger_count >= 2}
                                    >
                                      Single
                                    </SelectItem>
                                    <SelectItem 
                                      value="double" 
                                      disabled={formData.passenger_count === 1}
                                    >
                                      Double
                                    </SelectItem>
                                    <SelectItem 
                                      value="twin" 
                                      disabled={formData.passenger_count === 1}
                                    >
                                      Twin
                                    </SelectItem>
                                    <SelectItem 
                                      value="triple" 
                                      disabled={formData.passenger_count === 1}
                                    >
                                      Triple
                                    </SelectItem>
                                    <SelectItem 
                                      value="family" 
                                      disabled={formData.passenger_count === 1}
                                    >
                                      Family
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Room Type</Label>
                                <Input
                                  value={allocation.room_type || ''}
                                  onChange={(e) => {
                                    setHotelAllocations(prev => ({
                                      ...prev,
                                      [hotel.id]: { ...allocation, room_type: e.target.value }
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No hotels available for this tour.</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setActiveTab("details")}>
                  Back
                </Button>
                <Button 
                  type="button"
                  onClick={handleContinueToNextTab}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  Continue to Activities
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="activities" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Activity Allocations</h3>
                {activities && activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => {
                      const allocation = activityAllocations[activity.id] ?? formData.passenger_count;

                      return (
                        <Card key={activity.id}>
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                              <div>
                                <p className="font-medium">{activity.name}</p>
                                {activity.activity_date && (
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(activity.activity_date).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div>
                                <Label>Passengers Attending</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={allocation}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setActivityAllocations(prev => ({
                                      ...prev,
                                      [activity.id]: value
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No activities available for this tour.</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setActiveTab("hotels")}>
                  Back
                </Button>
                <Button 
                  type="button"
                  onClick={handleContinueToNextTab}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  Continue to Medical Details
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="medical" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Medical & Emergency Contact</h3>
                
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Medical details, dietary requirements, and emergency contact information are stored on the contact record. 
                      {selectedContact ? (
                        <>
                          {' '}You can view or edit this information by{' '}
                          <Button 
                            variant="link" 
                            className="px-1 h-auto text-blue-600"
                            onClick={() => {
                              setShowAddContact(true);
                              setAddingContactFor('lead');
                            }}
                          >
                            editing the contact
                          </Button>.
                        </>
                      ) : (
                        <> Please select or create a contact to manage this information.</>
                      )}
                    </p>
                    
                    {selectedContact && (
                      <div className="mt-4 space-y-2 text-sm">
                        <div><span className="font-medium">Dietary Requirements:</span> {selectedContact.dietary_requirements || '—'}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setActiveTab("activities")}>
                  Back
                </Button>
                <Button 
                  type="button"
                  onClick={handleContinueToNextTab}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  Continue to Travel Documents
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="travel" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Travel Documents</h3>
                
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
                  <Label htmlFor="passport_country">Passport Country</Label>
                  <Input
                    id="passport_country"
                    value={formData.passport_country}
                    onChange={(e) => handleFormChange('passport_country', e.target.value)}
                    placeholder="Country of issue"
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
                  <Label htmlFor="id_number">ID Number</Label>
                  <Input
                    id="id_number"
                    value={formData.id_number}
                    onChange={(e) => handleFormChange('id_number', e.target.value)}
                    placeholder="National ID or other identification number"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setActiveTab("medical")}>
                  Back
                </Button>
                <Button 
                  type="button"
                  onClick={handleShowConfirmation}
                  className={defaultStatus === 'waitlisted' ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"}
                >
                  {defaultStatus === 'waitlisted' ? 'Add to Waitlist' : 'Review & Create Booking'}
                </Button>
              </div>
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
