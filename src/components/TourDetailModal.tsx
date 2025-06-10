
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, DollarSign, Clock, Bed, Edit } from "lucide-react";
import { TourBookingsList } from "@/components/TourBookingsList";
import { useActivities } from "@/hooks/useActivities";
import { useHotels } from "@/hooks/useHotels";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddActivityModal } from "@/components/AddActivityModal";
import { AddHotelModal } from "@/components/AddHotelModal";
import { EditActivityModal } from "@/components/EditActivityModal";
import { EditHotelModal } from "@/components/EditHotelModal";
import { EditTourModal } from "@/components/EditTourModal";
import { Tour } from "@/hooks/useTours";
import { formatDateRange, formatDisplayDate, formatDateToDDMMYYYY } from "@/lib/utils";

interface TourDetailModalProps {
  tour: Tour | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TourDetailModal = ({ tour, open, onOpenChange }: TourDetailModalProps) => {
  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [addActivityModalOpen, setAddActivityModalOpen] = useState(false);
  const [addHotelModalOpen, setAddHotelModalOpen] = useState(false);
  const [editActivityModalOpen, setEditActivityModalOpen] = useState(false);
  const [editHotelModalOpen, setEditHotelModalOpen] = useState(false);
  const [editTourModalOpen, setEditTourModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);

  const { data: activities } = useActivities(tour?.id || "");
  const { data: hotels } = useHotels(tour?.id || "");

  const handleActivityClick = (activity: any) => {
    setSelectedActivity(activity);
    setEditActivityModalOpen(true);
  };

  const handleHotelClick = (hotel: any) => {
    setSelectedHotel(hotel);
    setEditHotelModalOpen(true);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    return `${hour12}:${minutes}${ampm}`;
  };

  // Transform the database tour data to match the expected interface
  const transformedTour = tour ? {
    id: tour.id,
    name: tour.name,
    dates: formatDateRange(tour.start_date, tour.end_date),
    duration: `${tour.days} days / ${tour.nights} nights`,
    location: tour.location || "",
    pickupPoint: tour.pickup_point || "",
    status: tour.status,
    notes: tour.notes || "",
    inclusions: tour.inclusions || "",
    exclusions: tour.exclusions || "",
    pricing: {
      single: tour.price_single || 0,
      double: tour.price_double || 0,
      twin: tour.price_twin || 0,
    },
    deposit: tour.deposit_required || 0,
    instalmentAmount: tour.instalment_amount || 0,
    instalmentDate: tour.instalment_date || "",
    finalPaymentDate: tour.final_payment_date || "",
    totalCapacity: tour.capacity || 0,
    startDate: tour.start_date,
    endDate: tour.end_date,
  } : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{tour?.name}</DialogTitle>
              <Button
                onClick={() => setEditTourModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Tour
              </Button>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="hotels">Hotels</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Tour Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{transformedTour?.dates}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{transformedTour?.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{transformedTour?.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Capacity: {transformedTour?.totalCapacity}</span>
                    </div>
                    {transformedTour?.pickupPoint && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>Start Location: {transformedTour.pickupPoint}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pricing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge variant="secondary" className="uppercase">{transformedTour?.status}</Badge>
                    <div className="space-y-1">
                      {transformedTour?.pricing.single > 0 && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Single: {transformedTour.pricing.single}</span>
                        </div>
                      )}
                      {transformedTour?.pricing.double > 0 && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Double: {transformedTour.pricing.double}</span>
                        </div>
                      )}
                      {transformedTour?.pricing.twin > 0 && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Twin: {transformedTour.pricing.twin}</span>
                        </div>
                      )}
                      {transformedTour?.deposit > 0 && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Deposit: {transformedTour.deposit}</span>
                        </div>
                      )}
                      {transformedTour?.instalmentAmount > 0 && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Instalment: {transformedTour.instalmentAmount}</span>
                        </div>
                      )}
                      {transformedTour?.instalmentDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Instalment Date: {formatDateToDDMMYYYY(transformedTour.instalmentDate)}</span>
                        </div>
                      )}
                      {transformedTour?.finalPaymentDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Final Payment: {formatDateToDDMMYYYY(transformedTour.finalPaymentDate)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {transformedTour?.inclusions && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Inclusions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap">{transformedTour.inclusions}</div>
                    </CardContent>
                  </Card>
                )}

                {transformedTour?.exclusions && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Exclusions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap">{transformedTour.exclusions}</div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {transformedTour?.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap">{transformedTour.notes}</div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Activities</h3>
                <Button 
                  onClick={() => setAddActivityModalOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Add Activity
                </Button>
              </div>

              {activities && activities.length > 0 ? (
                <div className="grid gap-4">
                  {activities.map((activity) => (
                    <Card key={activity.id} className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleActivityClick(activity)}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{activity.name}</CardTitle>
                          <div className="flex gap-2">
                            <Badge variant="outline">
                              Pax Attending: {activity.spots_booked || 0}
                            </Badge>
                            {activity.spots_available && (
                              <Badge variant="secondary">
                                Available: {activity.spots_available}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {activity.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{activity.location}</span>
                            </div>
                          )}
                          {activity.activity_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{formatDisplayDate(activity.activity_date)}</span>
                            </div>
                          )}
                          {activity.start_time && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{formatTime(activity.start_time)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{activity.spots_booked || 0}/{activity.spots_available || 0}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No activities added yet.</p>
                  <Button 
                    onClick={() => setAddActivityModalOpen(true)} 
                    className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Add First Activity
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="hotels" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Hotels</h3>
                <Button 
                  onClick={() => setAddHotelModalOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Add Hotel
                </Button>
              </div>

              {hotels && hotels.length > 0 ? (
                <div className="grid gap-4">
                  {hotels.map((hotel) => (
                    <Card key={hotel.id} className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleHotelClick(hotel)}>
                      <CardHeader>
                        <CardTitle className="text-base">{hotel.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {hotel.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{hotel.address}</span>
                            </div>
                          )}
                          {hotel.default_check_in && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>Check-in: {formatDateToDDMMYYYY(hotel.default_check_in)}</span>
                            </div>
                          )}
                          {hotel.default_check_out && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>Check-out: {formatDateToDDMMYYYY(hotel.default_check_out)}</span>
                            </div>
                          )}
                          {hotel.default_room_type && (
                            <div className="flex items-center gap-1">
                              <Bed className="h-4 w-4 text-muted-foreground" />
                              <span>Room Type: {hotel.default_room_type}</span>
                            </div>
                          )}
                          {hotel.extra_night_price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span>Extra Night: {hotel.extra_night_price}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Bed className="h-4 w-4 text-muted-foreground" />
                            <span>Booked: {hotel.rooms_booked || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Bed className="h-4 w-4 text-muted-foreground" />
                            <span>Available: {hotel.rooms_available || 0}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No hotels added yet.</p>
                  <Button 
                    onClick={() => setAddHotelModalOpen(true)}
                    className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Add First Hotel
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bookings" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Bookings</h3>
                <Button 
                  onClick={() => setAddBookingModalOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Add Booking
                </Button>
              </div>
              <TourBookingsList tourId={tour?.id || ""} tourName={tour?.name || ""} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AddBookingModal
        open={addBookingModalOpen}
        onOpenChange={setAddBookingModalOpen}
        preSelectedTourId={tour?.id}
      />

      <AddActivityModal
        open={addActivityModalOpen}
        onOpenChange={setAddActivityModalOpen}
        tourId={tour?.id}
      />

      <AddHotelModal
        open={addHotelModalOpen}
        onOpenChange={setAddHotelModalOpen}
        tourId={tour?.id}
      />

      {selectedActivity && (
        <EditActivityModal
          open={editActivityModalOpen}
          onOpenChange={setEditActivityModalOpen}
          activity={selectedActivity}
        />
      )}

      {selectedHotel && (
        <EditHotelModal
          open={editHotelModalOpen}
          onOpenChange={setEditHotelModalOpen}
          hotel={selectedHotel}
        />
      )}

      {transformedTour && (
        <EditTourModal
          open={editTourModalOpen}
          onOpenChange={setEditTourModalOpen}
          tour={transformedTour}
        />
      )}
    </>
  );
};
