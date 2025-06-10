
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Building, Calendar, Users, MapPin, Phone, Mail } from "lucide-react";

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
}

interface TourDetailModalProps {
  tour: Tour | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mockHotels = [
  {
    id: "1",
    name: "Crown Towers Melbourne",
    address: "8 Whiteman St, Southbank VIC 3006",
    contact: {
      phone: "(03) 9292 6868",
      email: "reservations@crownmelbourne.com.au"
    },
    bookingStatus: "confirmed",
    roomsReserved: 20,
    roomsBooked: 15,
    checkIn: "Nov 2, 2024",
    checkOut: "Nov 8, 2024",
    roomType: "Superior King",
    extraNightPrice: 280
  }
];

const mockActivities = [
  {
    id: "1",
    name: "Melbourne Cup Day - Flemington",
    date: "Nov 5, 2024",
    spotsAvailable: 35,
    spotsBooked: 28,
    location: "Flemington Racecourse",
    startTime: "10:00 AM",
    endTime: "6:00 PM",
    status: "confirmed"
  },
  {
    id: "2",
    name: "Crown Oaks Day",
    date: "Nov 7, 2024",
    spotsAvailable: 35,
    spotsBooked: 25,
    location: "Flemington Racecourse",
    startTime: "11:00 AM",
    endTime: "5:00 PM",
    status: "pending"
  }
];

const mockBookings = [
  {
    id: "1",
    leadPassenger: "John Smith",
    secondPassenger: "Mary Smith",
    passengers: 2,
    checkIn: "Nov 2, 2024",
    checkOut: "Nov 8, 2024",
    nights: 6,
    status: "confirmed",
    notes: "Anniversary celebration"
  },
  {
    id: "2",
    leadPassenger: "David Wilson",
    secondPassenger: "Sarah Wilson",
    passengers: 2,
    checkIn: "Nov 2, 2024",
    checkOut: "Nov 8, 2024",
    nights: 6,
    status: "deposited",
    notes: "Dietary requirements: Vegetarian"
  }
];

export const TourDetailModal = ({ tour, open, onOpenChange }: TourDetailModalProps) => {
  const [activeTab, setActiveTab] = useState("overview");

  if (!tour) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{tour.name}</DialogTitle>
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
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Add/Edit Hotel
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add/Edit Activity
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add/Edit Booking
                  </Button>
                </CardContent>
              </Card>
            </div>

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
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Hotel
              </Button>
            </div>
            
            <div className="space-y-4">
              {mockHotels.map((hotel) => (
                <Card key={hotel.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {hotel.name}
                      <Badge className="bg-green-100 text-green-800">
                        {hotel.bookingStatus}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{hotel.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium">Contact</p>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {hotel.contact.phone}
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {hotel.contact.email}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Rooms</p>
                        <p className="text-sm text-muted-foreground">
                          {hotel.roomsBooked}/{hotel.roomsReserved} booked
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {hotel.roomsReserved - hotel.roomsBooked} available
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Stay Period</p>
                        <p className="text-sm text-muted-foreground">
                          {hotel.checkIn} - {hotel.checkOut}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Room Type: {hotel.roomType}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activities" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Activities</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Activity
              </Button>
            </div>
            
            <div className="space-y-4">
              {mockActivities.map((activity) => (
                <Card key={activity.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {activity.name}
                      <Badge className={activity.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                        {activity.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{activity.location}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Date:</span> {activity.date}
                      </div>
                      <div>
                        <span className="font-medium">Time:</span> {activity.startTime} - {activity.endTime}
                      </div>
                      <div>
                        <span className="font-medium">Capacity:</span> {activity.spotsBooked}/{activity.spotsAvailable}
                      </div>
                      <div>
                        <span className="font-medium">Available:</span> {activity.spotsAvailable - activity.spotsBooked}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Bookings</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Booking
              </Button>
            </div>
            
            <div className="space-y-4">
              {mockBookings.map((booking) => (
                <Card key={booking.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {booking.leadPassenger}
                      <Badge className={booking.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                        {booking.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {booking.passengers} passengers • {booking.nights} nights
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Second Passenger:</span> {booking.secondPassenger}
                      </div>
                      <div>
                        <span className="font-medium">Check-in:</span> {booking.checkIn}
                      </div>
                      <div>
                        <span className="font-medium">Check-out:</span> {booking.checkOut}
                      </div>
                    </div>
                    {booking.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{booking.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
