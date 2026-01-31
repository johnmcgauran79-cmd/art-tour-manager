import { useState, useEffect } from "react";

export interface HotelAllocation {
  allocated: boolean;
  check_in_date: string;
  check_out_date: string;
  bedding: string;
  room_type?: string;
  room_upgrade?: string;
  confirmation_number?: string;
  room_requests?: string;
}

export interface MedicalFormData {
  dietary_requirements: string;
  medical_conditions: string;
  accessibility_needs: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
}

export interface PassengerContactData {
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
  preferred_name?: string | null;
}

export interface BookingFormData {
  tour_id: string;
  lead_passenger_name: string;
  lead_passenger_email: string;
  lead_passenger_phone: string;
  passenger_count: number;
  passenger_2_name: string;
  passenger_3_name: string;
  passenger_2_id: string;
  passenger_3_id: string;
  group_name: string;
  booking_agent: string;
  status: string;
  extra_requests: string;
  accommodation_required: boolean;
  check_in_date: string;
  check_out_date: string;
  invoice_notes: string;
  secondary_contact_id: string;
  secondary_contact_search: string;
  passport_number: string;
  passport_expiry_date: string;
  passport_country: string;
  id_number: string;
  nationality: string;
  whatsapp_group_comms: boolean;
}

interface UseBookingFormStateProps {
  preSelectedTourId?: string;
  defaultStatus?: string;
  preSelectedTourStartDate?: string;
  preSelectedTourEndDate?: string;
  isOpen: boolean;
}

interface Hotel {
  id: string;
  name: string;
  default_check_in: string | null;
  default_check_out: string | null;
  default_room_type: string | null;
}

interface Activity {
  id: string;
  name: string;
  activity_date: string | null;
}

export const useBookingFormState = ({
  preSelectedTourId,
  defaultStatus = "invoiced",
  preSelectedTourStartDate,
  preSelectedTourEndDate,
  isOpen,
}: UseBookingFormStateProps) => {
  const [formData, setFormData] = useState<BookingFormData>({
    tour_id: preSelectedTourId || '',
    lead_passenger_name: '',
    lead_passenger_email: '',
    lead_passenger_phone: '',
    passenger_count: 1,
    passenger_2_name: '',
    passenger_3_name: '',
    passenger_2_id: '',
    passenger_3_id: '',
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
    passport_number: '',
    passport_expiry_date: '',
    passport_country: '',
    id_number: '',
    nationality: '',
    whatsapp_group_comms: true,
  });

  const [hotelAllocations, setHotelAllocations] = useState<Record<string, HotelAllocation>>({});
  const [activityAllocations, setActivityAllocations] = useState<Record<string, number>>({});
  const [medicalFormData, setMedicalFormData] = useState<MedicalFormData>({
    dietary_requirements: '',
    medical_conditions: '',
    accessibility_needs: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
  });

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
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
        passenger_2_id: '',
        passenger_3_id: '',
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
        whatsapp_group_comms: true,
      });
      setHotelAllocations({});
      setActivityAllocations({});
      setMedicalFormData({
        dietary_requirements: '',
        medical_conditions: '',
        accessibility_needs: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: '',
      });
    }
  }, [isOpen, preSelectedTourId, defaultStatus, preSelectedTourStartDate, preSelectedTourEndDate]);

  // Helper function to build hotel allocations
  const buildHotelAllocations = (
    hotels: Hotel[],
    accommodationRequired: boolean,
    passengerCount: number,
    existingAllocations: Record<string, HotelAllocation> = {}
  ) => {
    const allocations: Record<string, HotelAllocation> = {};
    
    hotels.forEach(hotel => {
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

  // Initialize hotel allocations when hotels load
  const initializeHotelAllocations = (hotels: Hotel[]) => {
    if (hotels.length === 0) return;
    
    const newAllocations = buildHotelAllocations(
      hotels,
      formData.accommodation_required,
      formData.passenger_count,
      hotelAllocations
    );
    
    const hasChanges = hotels.some(hotel => {
      const existing = hotelAllocations[hotel.id];
      const newAlloc = newAllocations[hotel.id];
      return !existing || existing.allocated !== newAlloc.allocated;
    });
    
    if (hasChanges || Object.keys(hotelAllocations).length === 0) {
      setHotelAllocations(newAllocations);
    }
  };

  // Initialize activity allocations when activities load
  const initializeActivityAllocations = (activities: Activity[]) => {
    if (activities.length === 0) return;
    
    const initialAllocations: Record<string, number> = {};
    activities.forEach(activity => {
      initialAllocations[activity.id] = formData.passenger_count;
    });
    setActivityAllocations(initialAllocations);
  };

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

  // Pre-fill medical form data from contact
  const prefillMedicalFromContact = (contact: {
    dietary_requirements: string | null;
    medical_conditions: string | null;
    accessibility_needs: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    emergency_contact_relationship: string | null;
  }) => {
    setMedicalFormData({
      dietary_requirements: contact.dietary_requirements || '',
      medical_conditions: contact.medical_conditions || '',
      accessibility_needs: contact.accessibility_needs || '',
      emergency_contact_name: contact.emergency_contact_name || '',
      emergency_contact_phone: contact.emergency_contact_phone || '',
      emergency_contact_relationship: contact.emergency_contact_relationship || '',
    });
  };

  return {
    formData,
    setFormData,
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
  };
};
