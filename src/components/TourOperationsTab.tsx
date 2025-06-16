
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Utensils, Hotel, Users, Eye } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { useHotels } from "@/hooks/useHotels";
import { TourOperationsReportsModal } from "@/components/TourOperationsReportsModal";

interface TourOperationsTabProps {
  tourId: string;
  tourName: string;
}

export const TourOperationsTab = ({ tourId, tourName }: TourOperationsTabProps) => {
  const { data: allBookings } = useBookings();
  const { data: hotels } = useHotels(tourId);
  const [reportsModalOpen, setReportsModalOpen] = useState(false);

  const tourBookings = (allBookings || []).filter(booking => booking.tour_id === tourId && booking.status !== 'cancelled');

  // Get all dietary requirements
  const dietaryRequirements = tourBookings
    .map(booking => ({
      name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      dietary: booking.customers?.dietary_requirements || '',
      passengerCount: booking.passenger_count,
      additionalPassengers: [booking.passenger_2_name, booking.passenger_3_name].filter(Boolean)
    }))
    .filter(item => item.dietary && item.dietary.trim() !== '');

  // Get contact list for WhatsApp export
  const contactList = tourBookings.map(booking => ({
    name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
    phone: booking.customers?.phone || '',
    email: booking.customers?.email || '',
    passengerCount: booking.passenger_count
  }));

  return (
    <div className="space-y-6">
      {/* Operations Reports Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-600" />
              <CardTitle>Tour Operations Reports</CardTitle>
              <Badge variant="secondary">Management Dashboard</Badge>
            </div>
            <Button 
              onClick={() => setReportsModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View & Manage All Reports
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div 
              className="text-center p-4 border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
              onClick={() => setReportsModalOpen(true)}
            >
              <Phone className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="font-medium">Contact Lists</p>
              <p className="text-sm text-gray-600">{contactList.length} contacts</p>
            </div>
            <div 
              className="text-center p-4 border rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-colors"
              onClick={() => setReportsModalOpen(true)}
            >
              <Utensils className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium">Dietary Requirements</p>
              <p className="text-sm text-gray-600">{dietaryRequirements.length} special diets</p>
            </div>
            <div 
              className="text-center p-4 border rounded-lg cursor-pointer hover:bg-purple-50 hover:border-purple-200 transition-colors"
              onClick={() => setReportsModalOpen(true)}
            >
              <Users className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="font-medium">Passenger Summary</p>
              <p className="text-sm text-gray-600">{tourBookings.length} bookings</p>
            </div>
            <div 
              className="text-center p-4 border rounded-lg cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition-colors"
              onClick={() => setReportsModalOpen(true)}
            >
              <Hotel className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <p className="font-medium">Hotel Reports</p>
              <p className="text-sm text-gray-600">{hotels?.length || 0} hotels</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Quick Access:</strong> Click on any report type above to view, select multiple reports, and export them in CSV or PDF format. 
              Perfect for tour management and operations coordination.
            </p>
          </div>
        </CardContent>
      </Card>

      <TourOperationsReportsModal
        tourId={tourId}
        tourName={tourName}
        open={reportsModalOpen}
        onOpenChange={setReportsModalOpen}
      />
    </div>
  );
};
