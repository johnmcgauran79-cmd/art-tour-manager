
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Building, MapPin, Plus } from "lucide-react";
import { TourDetailModal } from "@/components/TourDetailModal";
import { TourBookingsList } from "@/components/TourBookingsList";
import { AddTourModal } from "@/components/AddTourModal";
import { useTours, Tour } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";

const getStatusColor = (status: string) => {
  switch (status) {
    case "available": return "bg-green-100 text-green-800";
    case "sold_out": return "bg-red-100 text-red-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "closed": return "bg-gray-100 text-gray-800";
    case "past": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startMonth} - ${endMonth}`;
};

// Transform database Tour to TourDetailModal expected format
const transformTourForModal = (tour: Tour, passengersBooked: number) => ({
  id: tour.id,
  name: tour.name,
  dates: formatDateRange(tour.start_date, tour.end_date),
  duration: `${tour.days} days, ${tour.nights} nights`,
  location: tour.location || 'Location TBD',
  pickupPoint: tour.pickup_point || 'TBD',
  status: tour.status || 'pending',
  passengersBooked,
  totalCapacity: tour.capacity || 50,
  roomsAvailable: 0,
  notes: tour.notes || '',
  inclusions: tour.inclusions || '',
  exclusions: tour.exclusions || '',
  pricing: {
    single: tour.price_single || 0,
    double: tour.price_double || 0,
    twin: tour.price_twin || 0,
  },
  deposit: tour.deposit_required || 0,
  finalPaymentDate: tour.final_payment_date || '',
  instalmentDetails: tour.instalment_details || '',
  days: tour.days,
  nights: tour.nights,
});

export const ActiveTours = ({ showAll = false }: { showAll?: boolean }) => {
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [showTourDetail, setShowTourDetail] = useState(false);
  const [showBookingsList, setShowBookingsList] = useState<{show: boolean, tourId: string, tourName: string}>({show: false, tourId: '', tourName: ''});
  const [showAddTour, setShowAddTour] = useState(false);
  
  const { data: tours, isLoading: toursLoading } = useTours();
  const { data: bookings } = useBookings();

  const handleViewTour = (tour: Tour) => {
    const { passengersBooked } = getBookingStats(tour.id);
    
    // Always show tour detail modal when clicking on tour
    const transformedTour = transformTourForModal(tour, passengersBooked);
    setSelectedTour(transformedTour);
    setShowTourDetail(true);
  };

  if (toursLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading tours...</div>
        </CardContent>
      </Card>
    );
  }

  const displayTours = showAll ? (tours || []) : (tours || []).slice(0, 3);

  // Calculate tour metrics
  const getBookingStats = (tourId: string) => {
    const tourBookings = bookings?.filter(b => b.tour_id === tourId && b.status !== 'cancelled') || [];
    const passengersBooked = tourBookings.reduce((sum, booking) => sum + booking.passenger_count, 0);
    return { passengersBooked, bookings: tourBookings.length };
  };

  // If showing bookings list, render that instead
  if (showBookingsList.show) {
    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => setShowBookingsList({show: false, tourId: '', tourName: ''})}
        >
          ← Back to Tours
        </Button>
        <TourBookingsList 
          tourId={showBookingsList.tourId} 
          tourName={showBookingsList.tourName} 
        />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {showAll ? "All Tours" : "Active Tours"}
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowAddTour(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add New Tour
              </Button>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardTitle>
          <CardDescription>
            {showAll ? "Complete list of tours" : "Current and upcoming tour departures"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayTours.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tours found. Create your first tour to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {displayTours.map((tour) => {
                const { passengersBooked } = getBookingStats(tour.id);
                const tourCapacity = tour.capacity || 50;
                const spotsRemaining = tourCapacity - passengersBooked;
                
                return (
                  <div 
                    key={tour.id} 
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleViewTour(tour)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-blue-600 hover:text-blue-800 transition-colors">
                            {tour.name}
                          </h3>
                          <Badge className={getStatusColor(tour.status || 'pending')}>
                            {(tour.status || 'pending').replace("_", " ")}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{formatDateRange(tour.start_date, tour.end_date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span>{tour.days} days, {tour.nights} nights</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{tour.location || 'Location TBD'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{passengersBooked} passengers booked</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{spotsRemaining} spots remaining</span>
                          </div>
                        </div>

                        {tour.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{tour.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TourDetailModal 
        tour={selectedTour} 
        open={showTourDetail} 
        onOpenChange={setShowTourDetail} 
      />

      <AddTourModal open={showAddTour} onOpenChange={setShowAddTour} />
    </>
  );
};
