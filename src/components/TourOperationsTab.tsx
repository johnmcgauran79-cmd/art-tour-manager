
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Utensils, Hotel, Users, Eye, FileText } from "lucide-react";
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
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">Tour Operations Reports</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">Management Dashboard</Badge>
            </div>
            <Button 
              onClick={() => setReportsModalOpen(true)}
              className="flex items-center gap-2 bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              <Eye className="h-4 w-4" />
              View & Manage All Reports
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div 
              className="text-center p-6 border-2 border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => setReportsModalOpen(true)}
            >
              <div className="bg-blue-100 p-3 rounded-full mx-auto mb-3 w-fit group-hover:bg-blue-200 transition-colors">
                <Phone className="h-8 w-8 text-blue-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-blue-700">Contact Lists</p>
              <p className="text-sm text-gray-600">{contactList.length} contacts</p>
            </div>
            <div 
              className="text-center p-6 border-2 border-green-200 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => setReportsModalOpen(true)}
            >
              <div className="bg-green-100 p-3 rounded-full mx-auto mb-3 w-fit group-hover:bg-green-200 transition-colors">
                <Utensils className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-green-700">Dietary Requirements</p>
              <p className="text-sm text-gray-600">{dietaryRequirements.length} special diets</p>
            </div>
            <div 
              className="text-center p-6 border-2 border-purple-200 rounded-lg cursor-pointer hover:bg-purple-50 hover:border-purple-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => setReportsModalOpen(true)}
            >
              <div className="bg-purple-100 p-3 rounded-full mx-auto mb-3 w-fit group-hover:bg-purple-200 transition-colors">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-purple-700">Passenger Summary</p>
              <p className="text-sm text-gray-600">{tourBookings.length} bookings</p>
            </div>
            <div 
              className="text-center p-6 border-2 border-orange-200 rounded-lg cursor-pointer hover:bg-orange-50 hover:border-orange-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => setReportsModalOpen(true)}
            >
              <div className="bg-orange-100 p-3 rounded-full mx-auto mb-3 w-fit group-hover:bg-orange-200 transition-colors">
                <Hotel className="h-8 w-8 text-orange-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-orange-700">Hotel Reports</p>
              <p className="text-sm text-gray-600">{hotels?.length || 0} hotels</p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-brand-navy/5 border border-brand-navy/20 rounded-lg">
            <p className="text-sm text-brand-navy">
              <strong className="text-brand-navy">Quick Access:</strong> Click on any report type above to view, select multiple reports, and export them in CSV or PDF format. 
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
