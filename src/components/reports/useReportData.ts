
import { useQuery } from "@tanstack/react-query";
import { useBookings } from "@/hooks/useBookings";
import { useActivities } from "@/hooks/useActivities";
import { useActivityBookings } from "@/hooks/useActivityBookings";
import { usePickupOptions } from "@/hooks/usePickupOptions";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { Phone, Utensils, Users, ClipboardList, Grid3X3 } from "lucide-react";
import React from "react";

interface ReportItem {
  id: string;
  type: 'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | 'activitymatrix';
  title: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  data: any[];
}

interface UseReportDataOptions {
  showAllContacts?: boolean;
}

export const useReportData = (tourId: string, options: UseReportDataOptions = {}): ReportItem[] => {
  const { showAllContacts = false } = options;
  const { data: allBookings } = useBookings();
  const { data: activities } = useActivities(tourId);
  const { data: pickupOptions } = usePickupOptions(tourId);
  
  // Fetch all hotel bookings for bookings on this tour
  const { data: hotelBookings } = useQuery({
    queryKey: ['tour-hotel-bookings', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_bookings')
        .select(`
          booking_id,
          bedding,
          check_in_date,
          check_out_date,
          nights,
          hotels!inner (tour_id)
        `)
        .eq('hotels.tour_id', tourId)
        .order('check_in_date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tourId,
  });

  const tourBookings = (allBookings || []).filter(booking => {
    return booking.tour_id === tourId && 
      booking.status !== 'cancelled' && 
      booking.status !== 'waitlisted';
  });

  // Contacts List Report - All passengers on tour with phone numbers
  const contactList = tourBookings
    .filter(booking => showAllContacts || booking.whatsapp_group_comms === true)
    .flatMap(booking => {
      const contacts = [];
      // Lead passenger
      if (booking.customers) {
        contacts.push({
          firstName: booking.customers.first_name || '',
          lastName: booking.customers.last_name || '',
          phone: booking.customers.phone || ''
        });
      }
      // Passenger 2 (linked contact)
      if ((booking as any).passenger_2) {
        const p2 = (booking as any).passenger_2;
        contacts.push({
          firstName: p2.first_name || '',
          lastName: p2.last_name || '',
          phone: p2.phone || ''
        });
      } else if (booking.passenger_2_name) {
        const nameParts = booking.passenger_2_name.split(' ');
        contacts.push({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: ''
        });
      }
      // Passenger 3 (linked contact)
      if ((booking as any).passenger_3) {
        const p3 = (booking as any).passenger_3;
        contacts.push({
          firstName: p3.first_name || '',
          lastName: p3.last_name || '',
          phone: p3.phone || ''
        });
      } else if (booking.passenger_3_name) {
        const nameParts = booking.passenger_3_name.split(' ');
        contacts.push({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: ''
        });
      }
      return contacts;
    });

  // Dietary Requirements Report - includes all passengers with dietary requirements
  const dietaryRequirements = tourBookings.flatMap(booking => {
    const items = [];
    const leadName = `${booking.customers?.first_name} ${booking.customers?.last_name}`;
    
    // Lead passenger dietary
    if (booking.customers?.dietary_requirements?.trim()) {
      items.push({
        leadPassenger: leadName,
        passengerName: leadName,
        additionalPassengers: [booking.passenger_2_name, booking.passenger_3_name].filter(Boolean),
        dietaryRequirements: booking.customers.dietary_requirements
      });
    }
    
    // Passenger 2 dietary (from linked contact)
    const p2 = (booking as any).passenger_2;
    if (p2?.dietary_requirements?.trim()) {
      items.push({
        leadPassenger: leadName,
        passengerName: `${p2.first_name} ${p2.last_name}`,
        additionalPassengers: [],
        dietaryRequirements: p2.dietary_requirements
      });
    }
    
    // Passenger 3 dietary (from linked contact)
    const p3 = (booking as any).passenger_3;
    if (p3?.dietary_requirements?.trim()) {
      items.push({
        leadPassenger: leadName,
        passengerName: `${p3.first_name} ${p3.last_name}`,
        additionalPassengers: [],
        dietaryRequirements: p3.dietary_requirements
      });
    }
    
    return items;
  });

  // Passenger Summary Report
  const passengerSummary = tourBookings.map(booking => {
    const bookingHotelBookings = (hotelBookings || []).filter(hb => hb.booking_id === booking.id);
    const firstHotelBooking = bookingHotelBookings[0];
    const lastHotelBooking = bookingHotelBookings[bookingHotelBookings.length - 1];
    
    const bedding = firstHotelBooking?.bedding || '';
    const checkIn = firstHotelBooking?.check_in_date || booking.check_in_date;
    const checkOut = lastHotelBooking?.check_out_date || booking.check_out_date;
    const totalNights = bookingHotelBookings.reduce((sum, hb) => sum + (hb.nights || 0), 0) || booking.total_nights || 0;
    
    // Resolve pickup location name
    const pickupName = booking.selected_pickup_option_id && pickupOptions
      ? pickupOptions.find(p => p.id === booking.selected_pickup_option_id)?.name || ''
      : '';
    
    return {
      leadPassenger: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      additionalPassengers: [booking.passenger_2_name, booking.passenger_3_name].filter(Boolean),
      passengerCount: booking.passenger_count,
      bedding: bedding,
      checkIn: formatDateToDDMMYYYY(checkIn),
      checkOut: formatDateToDDMMYYYY(checkOut),
      nights: totalNights,
      status: booking.status,
      notes: (booking as any).booking_notes || '',
      groupName: booking.group_name || '',
      pickupLocation: pickupName,
    };
  });

  // Individual Passenger List Report
  const passengerList = tourBookings.flatMap(booking => {
    const passengers = [];
    
    // Add lead passenger
    passengers.push({
      name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      bookingReference: booking.id.substring(0, 8),
      groupName: booking.group_name || '',
      dietaryRequirements: booking.customers?.dietary_requirements || '',
      notes: ''
    });

    // Add additional passengers
    if (booking.passenger_2_name) {
      passengers.push({
        name: booking.passenger_2_name,
        bookingReference: booking.id.substring(0, 8),
        groupName: booking.group_name || '',
        dietaryRequirements: '',
        notes: ''
      });
    }

    if (booking.passenger_3_name) {
      passengers.push({
        name: booking.passenger_3_name,
        bookingReference: booking.id.substring(0, 8),
        groupName: booking.group_name || '',
        dietaryRequirements: '',
        notes: ''
      });
    }

    return passengers;
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Activity Allocation Matrix Report
  const activityMatrix = [
    {
      activities: (activities || []).map(activity => ({
        ...activity,
        tour_id: tourId
      })),
      bookings: tourBookings.map(booking => ({
        id: booking.id,
        leadPassenger: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
        passengerCount: booking.passenger_count,
        groupName: booking.group_name || '',
        status: booking.status
      }))
    }
  ];

  return [
    {
      id: 'contacts',
      type: 'contacts',
      title: 'Contacts List',
      description: 'All passengers on tour with phone numbers',
      icon: React.createElement(Phone, { className: "h-5 w-5 text-blue-600" }),
      count: contactList.length,
      data: contactList
    },
    {
      id: 'dietary',
      type: 'dietary',
      title: 'Dietary Requirements',
      description: 'Special dietary needs for all passengers',
      icon: React.createElement(Utensils, { className: "h-5 w-5 text-green-600" }),
      count: dietaryRequirements.length,
      data: dietaryRequirements
    },
    {
      id: 'summary',
      type: 'summary',
      title: 'Passenger Summary',
      description: 'Complete booking details for all passengers',
      icon: React.createElement(Users, { className: "h-5 w-5 text-purple-600" }),
      count: passengerSummary.length,
      data: passengerSummary
    },
    {
      id: 'passengerlist',
      type: 'passengerlist',
      title: 'Individual Passenger List',
      description: 'All passengers listed individually with space for notes',
      icon: React.createElement(ClipboardList, { className: "h-5 w-5 text-orange-600" }),
      count: passengerList.length,
      data: passengerList
    },
    {
      id: 'activitymatrix',
      type: 'activitymatrix',
      title: 'Activity Allocation Matrix',
      description: 'Passenger allocation across all activities to identify discrepancies',
      icon: React.createElement(Grid3X3, { className: "h-5 w-5 text-red-600" }),
      count: tourBookings.length,
      data: activityMatrix
    }
  ];
};
