
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, DollarSign, Clock, AlertCircle, Hotel, Bell } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { useHotels } from "@/hooks/useHotels";
import { TourAlertsModal } from "@/components/TourAlertsModal";
import { useTourAlerts } from "@/hooks/useTourAlerts";

interface TourOverviewTabProps {
  tour: {
    id: string;
    name: string;
    dates: string;
    duration: string;
    location: string;
    pickupPoint: string;
    status: string;
    notes: string;
    inclusions: string;
    exclusions: string;
    pricing: {
      single: number;
      double: number;
      twin: number;
    };
    deposit: number;
    instalmentAmount: number;
    instalmentDate: string;
    finalPaymentDate: string;
    totalCapacity: number;
    minimumPassengers: number | null;
    startDate: string;
    endDate: string;
    tourHost: string;
  };
}

export const TourOverviewTab = ({ tour }: TourOverviewTabProps) => {
  const { data: allBookings } = useBookings();
  const { data: hotels } = useHotels(tour.id);
  const [selectedTourForAlerts, setSelectedTourForAlerts] = useState<string | null>(null);
  const { unacknowledgedCount } = useTourAlerts(tour.id);

  // Calculate booking statistics for this tour
  const tourBookings = (allBookings || []).filter(booking => booking.tour_id === tour.id);
  const confirmedBookings = tourBookings.filter(b => b.status !== 'cancelled' && b.status !== 'waitlisted');
  const waitlistedBookings = tourBookings.filter(b => b.status === 'waitlisted');
  const totalConfirmedPassengers = confirmedBookings.reduce((sum, b) => sum + b.passenger_count, 0);
  const totalWaitlistedPassengers = waitlistedBookings.reduce((sum, b) => sum + b.passenger_count, 0);

  // Calculate hotel room statistics for the first night only to avoid double-counting back-to-back hotels
  // But sum together if multiple hotels exist on the same date (like Scone tour)
  const hotelsList = hotels || [];
  const earliestCheckIn = hotelsList.length > 0 
    ? hotelsList.reduce((earliest, hotel) => {
        if (!hotel.default_check_in) return earliest;
        if (!earliest) return hotel.default_check_in;
        return hotel.default_check_in < earliest ? hotel.default_check_in : earliest;
      }, null as string | null)
    : null;
  
  const firstNightHotels = earliestCheckIn 
    ? hotelsList.filter(hotel => hotel.default_check_in === earliestCheckIn)
    : [];
  
  const totalRoomsReserved = firstNightHotels.reduce((sum, hotel) => sum + (hotel.rooms_reserved || 0), 0);
  const totalRoomsBooked = firstNightHotels.reduce((sum, hotel) => sum + (hotel.rooms_booked || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-800";
      case "closed": return "bg-red-100 text-red-800";
      case "sold_out": return "bg-yellow-100 text-yellow-800";
      case "past": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dates</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tour.dates}</div>
            <p className="text-xs text-muted-foreground">{tour.duration}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tour.location || "TBD"}</div>
            <p className="text-xs text-muted-foreground">
              Pickup: {tour.pickupPoint || "TBD"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Badge className={getStatusColor(tour.status)}>
              {tour.status.replace("_", " ").toUpperCase()}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">Tour Host</div>
            <p className="text-xs text-muted-foreground">{tour.tourHost}</p>
          </CardContent>
        </Card>
      </div>

      {/* Capacity and Waitlist Information */}
      <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Passengers</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalConfirmedPassengers}</div>
            <p className="text-xs text-muted-foreground">{confirmedBookings.length} bookings</p>
          </CardContent>
        </Card>

        {waitlistedBookings.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waitlisted Passengers</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{totalWaitlistedPassengers}</div>
              <p className="text-xs text-muted-foreground">{waitlistedBookings.length} on waitlist</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tour.totalCapacity > 0 ? tour.totalCapacity : "NA"}
            </div>
            <p className="text-xs text-muted-foreground">
              {tour.minimumPassengers ? `Min: ${tour.minimumPassengers}` : "No minimum"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Availability</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tour.totalCapacity > 0 ? Math.max(0, tour.totalCapacity - totalConfirmedPassengers) : "NA"}
            </div>
            <p className="text-xs text-muted-foreground">Spots remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rooms Booked</CardTitle>
            <Hotel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRoomsReserved > 0 ? `${totalRoomsBooked} of ${totalRoomsReserved}` : "NA"}
            </div>
            <p className="text-xs text-muted-foreground">rooms booked</p>
          </CardContent>
        </Card>

        <Card 
          className="border-2 border-yellow-200 cursor-pointer hover:bg-yellow-50 hover:border-yellow-300 hover:shadow-md transition-all duration-200"
          onClick={() => setSelectedTourForAlerts(tour.id)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tour Alerts</CardTitle>
            <div className="relative">
              <Bell className="h-4 w-4 text-yellow-600" />
              {unacknowledgedCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                  {unacknowledgedCount}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {unacknowledgedCount}
            </div>
            <p className="text-xs text-muted-foreground">pending alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium">Single Occupancy</h4>
              <p className="text-2xl font-bold text-green-600">
                ${tour.pricing.single || 0}
              </p>
            </div>
            <div>
              <h4 className="font-medium">Double Occupancy</h4>
              <p className="text-2xl font-bold text-green-600">
                ${tour.pricing.double || 0}
              </p>
            </div>
            <div>
              <h4 className="font-medium">Twin Share</h4>
              <p className="text-2xl font-bold text-green-600">
                ${tour.pricing.twin || 0}
              </p>
            </div>
          </div>
          
          {tour.deposit > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Payment Structure</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Deposit Required:</span> ${tour.deposit}
                </div>
                {tour.instalmentAmount > 0 && (
                  <div>
                    <span className="font-medium">Instalment:</span> ${tour.instalmentAmount}
                    {tour.instalmentDate && (
                      <span className="text-muted-foreground ml-1">
                        (Due: {new Date(tour.instalmentDate).toLocaleDateString('en-AU')})
                      </span>
                    )}
                  </div>
                )}
                {tour.finalPaymentDate && (
                  <div>
                    <span className="font-medium">Final Payment Due:</span>{" "}
                    {new Date(tour.finalPaymentDate).toLocaleDateString('en-AU')}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tour Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tour.inclusions && (
          <Card>
            <CardHeader>
              <CardTitle>Inclusions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{tour.inclusions}</div>
            </CardContent>
          </Card>
        )}

        {tour.exclusions && (
          <Card>
            <CardHeader>
              <CardTitle>Exclusions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{tour.exclusions}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {tour.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm">{tour.notes}</div>
          </CardContent>
        </Card>
      )}

      {selectedTourForAlerts && (
        <TourAlertsModal
          tourId={selectedTourForAlerts}
          open={!!selectedTourForAlerts}
          onOpenChange={(open) => !open && setSelectedTourForAlerts(null)}
        />
      )}
    </div>
  );
};
