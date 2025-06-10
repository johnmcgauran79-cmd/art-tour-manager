
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Building, MapPin, Eye } from "lucide-react";
import { TourDetailModal } from "@/components/TourDetailModal";

interface Tour {
  id: string;
  name: string;
  dates: string;
  duration: string;
  location: string;
  pickupPoint: string;
  status: "available" | "pending" | "sold-out" | "closed" | "past";
  passengersBooked: number;
  totalCapacity: number;
  roomsAvailable: number;
  notes: string;
}

const mockTours: Tour[] = [
  {
    id: "1",
    name: "Melbourne Cup Carnival 2024",
    dates: "Nov 2-8, 2024",
    duration: "6 days, 5 nights",
    location: "Melbourne, VIC",
    pickupPoint: "Sydney Airport",
    status: "available",
    passengersBooked: 28,
    totalCapacity: 35,
    roomsAvailable: 4,
    notes: "Premium package includes Crown Casino accommodation"
  },
  {
    id: "2",
    name: "Formula 1 Australian Grand Prix",
    dates: "Mar 21-24, 2025",
    duration: "4 days, 3 nights",
    location: "Melbourne, VIC",
    pickupPoint: "Brisbane Airport",
    status: "sold-out",
    passengersBooked: 40,
    totalCapacity: 40,
    roomsAvailable: 0,
    notes: "Sold out - waiting list available"
  },
  {
    id: "3",
    name: "Bathurst 1000 Experience",
    dates: "Oct 10-13, 2024",
    duration: "4 days, 3 nights",
    location: "Bathurst, NSW",
    pickupPoint: "Sydney CBD",
    status: "available",
    passengersBooked: 15,
    totalCapacity: 30,
    roomsAvailable: 8,
    notes: "Mountain views accommodation package"
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "available": return "bg-green-100 text-green-800";
    case "sold-out": return "bg-red-100 text-red-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "closed": return "bg-gray-100 text-gray-800";
    case "past": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export const ActiveTours = ({ showAll = false }: { showAll?: boolean }) => {
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [showTourDetail, setShowTourDetail] = useState(false);

  const handleViewTour = (tour: Tour) => {
    setSelectedTour(tour);
    setShowTourDetail(true);
  };

  const displayTours = showAll ? mockTours : mockTours.slice(0, 3);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {showAll ? "All Tours" : "Active Tours"}
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </CardTitle>
          <CardDescription>
            {showAll ? "Complete list of tours" : "Current and upcoming tour departures"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayTours.map((tour) => (
              <div key={tour.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{tour.name}</h3>
                      <Badge className={getStatusColor(tour.status)}>
                        {tour.status.replace("-", " ")}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
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
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{tour.roomsAvailable} rooms available</span>
                      </div>
                    </div>

                    {tour.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{tour.notes}</p>
                    )}
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewTour(tour)}
                    className="ml-4"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TourDetailModal 
        tour={selectedTour} 
        open={showTourDetail} 
        onOpenChange={setShowTourDetail} 
      />
    </>
  );
};
