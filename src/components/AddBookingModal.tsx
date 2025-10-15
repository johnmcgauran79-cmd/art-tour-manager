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
import { useToast } from "@/hooks/use-toast";

import { ContactSearch } from "@/components/booking/ContactSearch";
import { BookingDetailsForm } from "@/components/booking/BookingDetailsForm";
import { AddContactModal } from "@/components/AddContactModal";
import { UserPlus } from "lucide-react";
import { HotelAllocationSection } from "@/components/HotelAllocationSection";
import { ActivityAllocationSection } from "@/components/ActivityAllocationSection";
import { useHotels } from "@/hooks/useHotels";
import { useActivities } from "@/hooks/useActivities";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface AddBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedTourId?: string;
  defaultStatus?: string;
  preSelectedTourStartDate?: string;
  preSelectedTourEndDate?: string;
}

export const AddBookingModal = ({ open, onOpenChange, preSelectedTourId, defaultStatus = "invoiced", preSelectedTourStartDate, preSelectedTourEndDate }: AddBookingModalProps) => {
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedSecondaryContact, setSelectedSecondaryContact] = useState<any>(null);
  const [leadPassengerName, setLeadPassengerName] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [addingContactFor, setAddingContactFor] = useState<'lead' | 'secondary' | null>(null);
  
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
    secondary_contact_id: '',
    secondary_contact_search: '',
    
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
    activityAllocations: {} as Record<string, number>,
    hotelDates: {} as Record<string, { 
      check_in: string; 
      check_out: string; 
      bedding?: string; 
      room_type?: string; 
      room_upgrade?: string; 
      confirmation_number?: string; 
      room_requests?: string; 
    }>,
  });

  const { data: tours } = useTours();
  const createBooking = useCreateBooking();
  const { toast } = useToast();
  
  const { data: hotels = [] } = useHotels(formData.tour_id);
  const { data: activities = [] } = useActivities(formData.tour_id);
  
  useEffect(() => {
    if (open && hotels && hotels.length > 0) {
      const initialHotelDates: Record<string, { check_in: string; check_out: string }> = {};
      
      hotels.forEach(hotel => {
        const hotelData: any = {
          check_in: hotel.default_check_in || '',
          check_out: hotel.default_check_out || '',
        };
        
        if (hotel.default_room_type) {
          hotelData.room_type = hotel.default_room_type;
        }
        hotelData.bedding = 'double';
        
        initialHotelDates[hotel.id] = hotelData;
      });
      
      setFormData(prev => ({
        ...prev,
        hotelDates: initialHotelDates,
      }));
    }
  }, [open, hotels]);
  
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
        status: defaultStatus,
        extra_requests: '',
        accommodation_required: true,
        check_in_date: initialCheckIn,
        check_out_date: initialCheckOut,
        invoice_notes: '',
        secondary_contact_id: '',
        secondary_contact_search: '',
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
        activityAllocations: {},
        hotelDates: {},
      });
      setSelectedContact(null);
      setSelectedSecondaryContact(null);
      setLeadPassengerName('');
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
        dietary_restrictions: selectedContact.dietary_requirements || '',
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

  const handleCreateBooking = async () => {
    try {
      const cleanedFormData = {
        ...formData,
        passport_expiry_date: formData.passport_expiry_date || null,
        secondary_contact_id: formData.secondary_contact_id || null,
      };

      const newBooking = await createBooking.mutateAsync(cleanedFormData);
      toast({
        title: "Success",
        description: `Booking created successfully with all allocations!`,
      });
      
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {defaultStatus === 'waitlisted' ? 'Add to Waitlist' : 'Add New Booking'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value="details" onValueChange={() => {}} className="w-full">
            <TabsContent value="details" className="space-y-6">
              <form onSubmit={handleCreateBooking} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-brand-navy">Lead Passenger</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddContactClick('lead')}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add New Contact
                    </Button>
                  </div>
                  <ContactSearch
                    value={leadPassengerName}
                    onValueChange={setLeadPassengerName}
                    onContactSelect={handleContactSelect}
                    selectedContactId={selectedContact?.id || ''}
                  />
                </div>

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
                    Close
                  </Button>
                  <Button 
                    type="submit" 
                    className={defaultStatus === 'waitlisted' ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"}
                  >
                    {defaultStatus === 'waitlisted' ? 'Continue to Waitlist' : 'Continue'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AddContactModal 
        open={showAddContact} 
        onOpenChange={setShowAddContact}
        onContactCreated={handleContactCreated}
      />
    </>
  );
};
