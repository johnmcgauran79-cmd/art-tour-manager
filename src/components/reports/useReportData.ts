
import { useBookings } from "@/hooks/useBookings";
import { useActivities } from "@/hooks/useActivities";
import { useActivityBookings } from "@/hooks/useActivityBookings";
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

export const useReportData = (tourId: string): ReportItem[] => {
  const { data: allBookings } = useBookings();
  const { data: activities } = useActivities(tourId);

  const tourBookings = (allBookings || []).filter(booking => 
    booking.tour_id === tourId && booking.status !== 'cancelled'
  );

  // Contact List Report
  const contactList = tourBookings.map(booking => ({
    firstName: booking.customers?.first_name || '',
    lastName: booking.customers?.last_name || '',
    phone: booking.customers?.phone || ''
  }));

  // Dietary Requirements Report
  const dietaryRequirements = tourBookings
    .map(booking => ({
      leadPassenger: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      additionalPassengers: [booking.passenger_2_name, booking.passenger_3_name].filter(Boolean),
      dietaryRequirements: booking.customers?.dietary_requirements || ''
    }))
    .filter(item => item.dietaryRequirements && item.dietaryRequirements.trim() !== '');

  // Passenger Summary Report
  const passengerSummary = tourBookings.map(booking => ({
    leadPassenger: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
    additionalPassengers: [booking.passenger_2_name, booking.passenger_3_name].filter(Boolean),
    passengerCount: booking.passenger_count,
    checkIn: formatDateToDDMMYYYY(booking.check_in_date),
    checkOut: formatDateToDDMMYYYY(booking.check_out_date),
    nights: booking.total_nights || 0,
    status: booking.status,
    notes: booking.extra_requests || '',
    groupName: booking.group_name || ''
  }));

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
      title: 'Contact List for WhatsApp',
      description: 'Contact information for all passengers',
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
