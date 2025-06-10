
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building, Calendar, Users, MapPin, Phone, Mail, Edit, FileText } from "lucide-react";
import { EditTourModal } from "@/components/EditTourModal";
import { AddHotelModal } from "@/components/AddHotelModal";
import { EditHotelModal } from "@/components/EditHotelModal";
import { AddActivityModal } from "@/components/AddActivityModal";
import { EditActivityModal } from "@/components/EditActivityModal";
import { EditBookingModal } from "@/components/EditBookingModal";
import { AddBookingModal } from "@/components/AddBookingModal";
import { RoomingListModal } from "@/components/RoomingListModal";
import { useHotels, Hotel } from "@/hooks/useHotels";
import { useActivities, Activity } from "@/hooks/useActivities";
import { useBookings } from "@/hooks/useBookings";
import { useHotelBookings } from "@/hooks/useHotelBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface Tour {
  id: string;
  name: string;
  dates: string;
  duration: string;
  location: string;
  pickupPoint: string;
  status: string;
  passengersBooked: number;
  totalCapacity: number;
  roomsAvailable: number;
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
  instalmentDetails: string;
  days: number;
  nights: number;
}

interface TourDetailModalProps {
  tour: Tour | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "deposited": return "bg-blue-100 text-blue-800";
    case "invoiced": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export const TourDetailModal = ({ tour, open, onOpenChange }: TourDetailModalProps) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [showEditTour, setShowEditTour] = useState(false);
  const [showAddHotel, setShowAddHotel] = useState(false);
  const [showEditHotel, setShowEditHotel] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showEditActivity, setShowEditActivity] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showEditBooking, setShowEditBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [showRoomingList, setShowRoomingList] = useState(false);
  const [selectedHotelForRooming, setSelectedHotelForRooming] = useState<Hotel | null>(null);

  const { data: hotels = [], isLoading: hotelsLoading } = useHotels(tour?.id || "");
  const { data: activities = [], isLoading: activitiesLoading } = useActivities(tour?.id || "");
  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings();

  if (!tour) return null;

  // Filter bookings for this tour and sort by created date
  const tourBookings = allBookings
    .filter(booking => booking.tour_id === tour.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const handleHotelEdit = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setShowEditHotel(true);
  };

  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowEditActivity(true);
  };

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
    setShowEditBooking(true);
  };

  const handleRoomingList = (hotel: Hotel) => {
    setSelectedHotelForRooming(hotel);
    setShowRoomingList(true);
  };

  // Component to display bedding type for each booking
  const BookingBeddingCell = ({ booking }: { booking: any }) => {
    const { data: hotelBookings = [] } = useHotelBookings(booking.id);
    
    if (!booking.accommodation_required || hotelBookings.length === 0) {
      return <span>-</span>;
    }

    const beddingTypes = hotelBookings
      .filter(hb => hb.allocated)
      .map(hb => hb.bedding)
      .filter(Boolean);

    if (beddingTypes.length === 0) {
      return <span>Not allocated</span>;
    }

    return (
      <div className="space-y-1">
        {beddingTypes.map((bedding, index) => (
          <div key={index} className="capitalize text-sm">
            {bedding}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">{tour.name}</DialogTitle>
              <Button onClick={() => setShowEditTour(true)} variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit Tour
              </Button>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="hotels">Hotels</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Tour Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{tour.dates}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{tour.days} days, {tour.nights} nights</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{tour.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{tour.passengersBooked}/{tour.totalCapacity} passengers</span>
                    </div>
                    <Badge className="w-fit">
                      Status: {tour.status}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pricing Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tour.pricing.single > 0 && (
                      <div className="flex justify-between">
                        <span>Single:</span>
                        <span>${tour.pricing.single}</span>
                      </div>
                    )}
                    {tour.pricing.double > 0 && (
                      <div className="flex justify-between">
                        <span>Double:</span>
                        <span>${tour.pricing.double}</span>
                      </div>
                    )}
                    {tour.pricing.twin > 0 && (
                      <div className="flex justify-between">
                        <span>Twin:</span>
                        <span>${tour.pricing.twin}</span>
                      </div>
                    )}
                    {tour.deposit > 0 && (
                      <div className="flex justify-between font-semibold">
                        <span>Deposit Required:</span>
                        <span>${tour.deposit}</span>
                      </div>
                    )}
                    {tour.instalmentAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Instalment Amount:</span>
                        <span>${tour.instalmentAmount}</span>
                      </div>
                    )}
                    {tour.instalmentDate && (
                      <div className="flex justify-between">
                        <span>Instalment Due:</span>
                        <span>{formatDateToDDMMYYYY(tour.instalmentDate)}</span>
                      </div>
                    )}
                    {tour.instalmentDetails && (
                      <div className="flex justify-between">
                        <span>Instalment Details:</span>
                        <span>{tour.instalmentDetails}</span>
                      </div>
                    )}
                    {tour.finalPaymentDate && (
                      <div className="flex justify-between">
                        <span>Final Payment Due:</span>
                        <span>{formatDateToDDMMYYYY(tour.finalPaymentDate)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {tour.inclusions && (
                <Card>
                  <CardHeader>
                    <CardTitle>Inclusions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{tour.inclusions}</p>
                  </CardContent>
                </Card>
              )}

              {tour.exclusions && (
                <Card>
                  <CardHeader>
                    <CardTitle>Exclusions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{tour.exclusions}</p>
                  </CardContent>
                </Card>
              )}

              {tour.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{tour.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="hotels" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Hotels</h3>
                <Button onClick={() => setShowAddHotel(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Hotel
                </Button>
              </div>
              
              <div className="space-y-4">
                {hotelsLoading ? (
                  <p>Loading hotels...</p>
                ) : hotels.length === 0 ? (
                  <p className="text-muted-foreground">No hotels added yet.</p>
                ) : (
                  hotels.map((hotel) => (
                    <Card key={hotel.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          {hotel.name}
                          <div className="flex items-center gap-2">
                            <Button 
                              onClick={() => handleRoomingList(hotel)} 
                              variant="outline" 
                              size="sm"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Rooming List
                            </Button>
                            <Button 
                              onClick={() => handleHotelEdit(hotel)} 
                              variant="outline" 
                              size="sm"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Badge className={
                              hotel.booking_status === "paid" ? "bg-green-100 text-green-800" :
                              hotel.booking_status === "contracted" ? "bg-blue-100 text-blue-800" :
                              hotel.booking_status === "enquiry_sent" ? "bg-yellow-100 text-yellow-800" :
                              hotel.booking_status === "cancelled" ? "bg-red-100 text-red-800" :
                              "bg-gray-100 text-gray-800"
                            }>
                              {hotel.booking_status}
                            </Badge>
                          </div>
                        </CardTitle>
                        <CardDescription>{hotel.address}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium">Contact</p>
                            <div className="text-sm text-muted-foreground">
                              {hotel.contact_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3" />
                                  {hotel.contact_phone}
                                </div>
                              )}
                              {hotel.contact_email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3" />
                                  {hotel.contact_email}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Rooms</p>
                            <p className="text-sm text-muted-foreground">
                              {hotel.rooms_booked || 0}/{hotel.rooms_reserved || 0} booked
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {(hotel.rooms_reserved || 0) - (hotel.rooms_booked || 0)} available
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Stay Period</p>
                            <p className="text-sm text-muted-foreground">
                              {hotel.default_check_in} - {hotel.default_check_out}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Room Type: {hotel.default_room_type || "Not specified"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold cursor-pointer hover:text-blue-600" onClick={() => console.log('Edit activities')}>
                  Activities
                </h3>
                <Button onClick={() => setShowAddActivity(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Activity
                </Button>
              </div>
              
              <div className="space-y-4">
                {activitiesLoading ? (
                  <p>Loading activities...</p>
                ) : activities.length === 0 ? (
                  <p className="text-muted-foreground">No activities added yet.</p>
                ) : (
                  activities.map((activity) => (
                    <Card key={activity.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleActivityClick(activity)}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          {activity.name}
                          <Badge className={activity.activity_status === "confirmed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                            {activity.activity_status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{activity.location}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Date:</span> {activity.activity_date || "Not set"}
                          </div>
                          <div>
                            <span className="font-medium">Time:</span> {activity.start_time && activity.end_time ? `${activity.start_time} - ${activity.end_time}` : "Not set"}
                          </div>
                          <div>
                            <span className="font-medium">Spots Booked:</span> {activity.spots_booked || 0}
                          </div>
                          <div>
                            <span className="font-medium">Transport:</span> {activity.transport_status}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="bookings" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  Bookings ({tourBookings.length})
                </h3>
                <Button onClick={() => setShowAddBooking(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Booking
                </Button>
              </div>
              
              {bookingsLoading ? (
                <p>Loading bookings...</p>
              ) : tourBookings.length === 0 ? (
                <p className="text-muted-foreground">No bookings found for this tour.</p>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead Passenger</TableHead>
                        <TableHead>Other Passengers</TableHead>
                        <TableHead>Pax</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Nights</TableHead>
                        <TableHead>Bedding</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tourBookings.map((booking) => (
                        <TableRow 
                          key={booking.id} 
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => handleBookingClick(booking)}
                        >
                          <TableCell>
                            {booking.customers?.first_name} {booking.customers?.last_name}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {booking.passenger_2_name && <div>{booking.passenger_2_name}</div>}
                              {booking.passenger_3_name && <div>{booking.passenger_3_name}</div>}
                              {booking.group_name && <div className="text-sm text-muted-foreground">Group: {booking.group_name}</div>}
                            </div>
                          </TableCell>
                          <TableCell>{booking.passenger_count}</TableCell>
                          <TableCell>
                            {booking.check_in_date ? 
                              formatDateToDDMMYYYY(booking.check_in_date) : 
                              'TBD'
                            }
                          </TableCell>
                          <TableCell>
                            {booking.check_out_date ? 
                              formatDateToDDMMYYYY(booking.check_out_date) : 
                              'TBD'
                            }
                          </TableCell>
                          <TableCell>{booking.total_nights || '-'}</TableCell>
                          <TableCell>
                            <BookingBeddingCell booking={booking} />
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(booking.status || 'pending')}>
                              {(booking.status || 'pending').replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate" title={booking.extra_requests || ''}>
                              {booking.extra_requests || '-'}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <EditTourModal 
        tour={tour} 
        open={showEditTour} 
        onOpenChange={setShowEditTour} 
      />

      <AddHotelModal 
        tourId={tour.id} 
        open={showAddHotel} 
        onOpenChange={setShowAddHotel} 
      />

      <EditHotelModal 
        hotel={selectedHotel} 
        open={showEditHotel} 
        onOpenChange={setShowEditHotel} 
      />

      <AddActivityModal 
        tourId={tour.id} 
        open={showAddActivity} 
        onOpenChange={setShowAddActivity} 
      />

      <EditActivityModal 
        activity={selectedActivity} 
        open={showEditActivity} 
        onOpenChange={setShowEditActivity} 
      />

      <EditBookingModal 
        booking={selectedBooking} 
        open={showEditBooking} 
        onOpenChange={setShowEditBooking} 
      />

      <AddBookingModal 
        open={showAddBooking} 
        onOpenChange={setShowAddBooking}
        preSelectedTourId={tour?.id}
      />

      <RoomingListModal
        hotel={selectedHotelForRooming}
        tourId={tour.id}
        open={showRoomingList}
        onOpenChange={setShowRoomingList}
      />
    </>
  );
};
