import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, DollarSign, Clock, Bed } from "lucide-react";
import { TourBookingsList } from "@/components/TourBookingsList";
import { useActivities } from "@/hooks/useActivities";
import { useHotels } from "@/hooks/useHotels";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddActivityModal } from "@/components/AddActivityModal";
import { AddHotelModal } from "@/components/AddHotelModal";
import { EditActivityModal } from "@/components/EditActivityModal";
import { EditHotelModal } from "@/components/EditHotelModal";

interface Tour {
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
}

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tour?.name}</DialogTitle>
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
                      <span>{tour?.dates}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{tour?.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{tour?.totalCapacity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>{tour?.pricing?.single}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tour Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">{tour?.status}</Badge>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Inclusions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tour?.inclusions}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Exclusions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tour?.exclusions}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tour?.notes}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Activities</h3>
                <Button 
                  onClick={() => setAddActivityModalOpen(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
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
                              <span>{new Date(activity.activity_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {activity.start_time && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{activity.start_time}</span>
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
                    className="mt-4 bg-slate-900 hover:bg-slate-800 text-white"
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
                  className="bg-slate-900 hover:bg-slate-800 text-white"
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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          {hotel.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{hotel.address}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Bed className="h-4 w-4 text-muted-foreground" />
                            <span>{hotel.rooms_available}</span>
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
                    className="mt-4 bg-slate-900 hover:bg-slate-800 text-white"
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
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Add Booking
                </Button>
              </div>
              <TourBookingsList tourId={tour.id} />
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
    </>
  );
};
