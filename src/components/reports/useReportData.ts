
import { useBookings } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { Phone, Utensils, Users } from "lucide-react";

interface ReportItem {
  id: string;
  type: 'contacts' | 'dietary' | 'summary' | 'hotel';
  title: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  data: any[];
}

export const useReportData = (tourId: string): ReportItem[] => {
  const { data: allBookings } = useBookings();

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

  return [
    {
      id: 'contacts',
      type: 'contacts',
      title: 'Contact List for WhatsApp',
      description: 'Contact information for all passengers',
      icon: <Phone className="h-5 w-5 text-blue-600" />,
      count: contactList.length,
      data: contactList
    },
    {
      id: 'dietary',
      type: 'dietary',
      title: 'Dietary Requirements',
      description: 'Special dietary needs for all passengers',
      icon: <Utensils className="h-5 w-5 text-green-600" />,
      count: dietaryRequirements.length,
      data: dietaryRequirements
    },
    {
      id: 'summary',
      type: 'summary',
      title: 'Passenger Summary',
      description: 'Complete booking details for all passengers',
      icon: <Users className="h-5 w-5 text-purple-600" />,
      count: passengerSummary.length,
      data: passengerSummary
    }
  ];
};
