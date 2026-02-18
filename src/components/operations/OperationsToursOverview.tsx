import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search, Bell } from "lucide-react";
import { useTours, Tour } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";
import { useTourAlerts } from "@/hooks/useTourAlerts";
import { useGlobalTourAlerts } from "@/hooks/useGlobalTourAlerts";
import { formatDisplayDate } from "@/lib/utils";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { TourAlertsModal } from "@/components/TourAlertsModal";
import { GlobalTourAlertsModal } from "@/components/GlobalTourAlertsModal";
import { TourAlertButton } from "./TourAlertButton";


const getDaysUntilTour = (startDate: string) => {
  const start = new Date(startDate);
  const today = new Date();
  const diffTime = start.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getDaysColorClass = (days: number) => {
  if (days > 60) return "bg-green-100 text-green-800";
  if (days >= 31) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
};

const getMilestoneDate = (startDate: string, daysOffset: number) => {
  const start = new Date(startDate);
  const milestone = new Date(start);
  milestone.setDate(milestone.getDate() - daysOffset);
  return milestone.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export const OperationsToursOverview = () => {
  const { data: tours, isLoading } = useTours();
  const { data: bookings } = useBookings();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTourForAlerts, setSelectedTourForAlerts] = useState<string | null>(null);
  const [showGlobalAlerts, setShowGlobalAlerts] = useState(false);
  const { navigateWithContext } = useNavigationContext();
  const { unacknowledgedCount, criticalCount } = useGlobalTourAlerts();

  // Function to get confirmed passenger count for a tour
  const getConfirmedPassengerCount = (tourId: string) => {
    if (!bookings) return 0;
    
    return bookings
      .filter(booking => 
        booking.tour_id === tourId && 
        booking.status !== 'cancelled' && 
        booking.status !== 'waitlisted'
      )
      .reduce((total, booking) => total + booking.passenger_count, 0);
  };

  // Filter tours by search query, exclude archived tours and tours that have already started
  const filteredTours = tours?.filter(tour => {
    // Exclude archived tours (status can be 'past' or 'archived' in database)
    if (tour.status === 'past' || (tour.status as string) === 'archived') {
      return false;
    }
    
    // Exclude tours that have already started
    const tourStartDate = new Date(tour.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
    
    if (tourStartDate < today) {
      return false;
    }
    
    if (!searchQuery.trim()) return true;
    const searchTerm = searchQuery.toLowerCase();
    
    return (
      tour.name.toLowerCase().includes(searchTerm) ||
      tour.tour_host?.toLowerCase().includes(searchTerm) ||
      tour.location?.toLowerCase().includes(searchTerm) ||
      tour.ops_notes?.toLowerCase().includes(searchTerm) ||
      tour.ops_accomm_notes?.toLowerCase().includes(searchTerm) ||
      tour.ops_races_notes?.toLowerCase().includes(searchTerm) ||
      tour.ops_transport_notes?.toLowerCase().includes(searchTerm) ||
      tour.ops_dinner_notes?.toLowerCase().includes(searchTerm) ||
      tour.ops_activities_notes?.toLowerCase().includes(searchTerm) ||
      tour.ops_other_notes?.toLowerCase().includes(searchTerm)
    );
  }) || [];

  const handleTourClick = (tour: Tour) => {
    navigateWithContext(`/tours/${tour.id}?tab=operations`);
  };

  const handleAlertsClick = (e: React.MouseEvent, tourId: string) => {
    e.stopPropagation(); // Prevent tour card click
    setSelectedTourForAlerts(tourId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Current Tours Operations Status
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading tours...</div>
        </CardContent>
      </Card>
    );
  }

  if (!tours || tours.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Current Tours Operations Status
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGlobalAlerts(true)}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              All Alerts
              {unacknowledgedCount > 0 && (
                <Badge 
                  variant={criticalCount > 0 ? "destructive" : "secondary"}
                  className="ml-1"
                >
                  {unacknowledgedCount}
                </Badge>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">No tours available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Current Tours Operations Status
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGlobalAlerts(true)}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              All Alerts
              {unacknowledgedCount > 0 && (
                <Badge 
                  variant={criticalCount > 0 ? "destructive" : "secondary"}
                  className="ml-1"
                >
                  {unacknowledgedCount}
                </Badge>
              )}
            </Button>
          </div>
        <CardDescription>
          Monitor tour status, capacity issues, and operational requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tours by name, location, host, or operations notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-6">
          {filteredTours.map((tour) => {
            const daysUntilTour = getDaysUntilTour(tour.start_date);
            const daysColorClass = getDaysColorClass(daysUntilTour);
            const confirmedPax = getConfirmedPassengerCount(tour.id);
            
            return (
              <div 
                key={tour.id} 
                className="border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-accent/20 hover:border-primary/30"
                onClick={() => handleTourClick(tour)}
              >
                {/* Tour Name and Date Milestones Row */}
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-lg">{tour.name}</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground bg-accent/50 px-2 py-1 rounded">
                        Pax: {confirmedPax}
                      </span>
                      <TourAlertButton 
                        tourId={tour.id} 
                        onClick={(e) => handleAlertsClick(e, tour.id)}
                      />
                    </div>
                      <div className="flex gap-4 text-xs">
                        <div className="text-center">
                          <div className="font-medium">6mths out:</div>
                          <div>{getMilestoneDate(tour.start_date, 180)}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">90 days:</div>
                          <div>{getMilestoneDate(tour.start_date, 90)}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">60 days:</div>
                          <div>{getMilestoneDate(tour.start_date, 60)}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">30 days:</div>
                          <div>{getMilestoneDate(tour.start_date, 30)}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Start date:</div>
                          <div>{formatDisplayDate(tour.start_date).split(',')[0]}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                {/* Main Operations Table */}
                <div className="flex gap-2 text-sm min-h-32">
                  {/* Column 1: Days Remaining (10% width) */}
                  <div className="w-[10%] flex items-center justify-center">
                    <div className={`w-full h-full flex items-center justify-center rounded text-center font-bold text-xl ${daysColorClass}`}>
                      {daysUntilTour}
                    </div>
                  </div>
                  
                  {/* Column 2: Operations Notes Breakdown (50% width) */}
                  <div className="w-[50%] space-y-1 pr-2">
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Accomm:</span>
                      <span className="text-muted-foreground whitespace-pre-wrap">{tour.ops_accomm_notes || "No notes"}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Races:</span>
                      <span className="text-muted-foreground whitespace-pre-wrap">{tour.ops_races_notes || "No notes"}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Transport:</span>
                      <span className="text-muted-foreground whitespace-pre-wrap">{tour.ops_transport_notes || "No notes"}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Dinner:</span>
                      <span className="text-muted-foreground whitespace-pre-wrap">{tour.ops_dinner_notes || "No notes"}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Activities:</span>
                      <span className="text-muted-foreground whitespace-pre-wrap">{tour.ops_activities_notes || "No notes"}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Other:</span>
                      <span className="text-muted-foreground whitespace-pre-wrap">{tour.ops_other_notes || "No notes"}</span>
                    </div>
                  </div>
                  
                  {/* Column 3: General Operations Notes (40% width) */}
                  <div className="w-[40%]">
                    <div className="bg-gray-100 p-3 rounded h-full">
                      <div className="font-medium mb-2">General Operations Notes:</div>
                      <div className="text-muted-foreground text-sm whitespace-pre-wrap">
                        {tour.ops_notes || "No general operations notes"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredTours.length === 0 && searchQuery && (
            <div className="text-center py-8 text-muted-foreground">
              No tours found matching "{searchQuery}"
            </div>
          )}
        </div>
      </CardContent>

      {selectedTourForAlerts && (
        <TourAlertsModal
          tourId={selectedTourForAlerts}
          open={!!selectedTourForAlerts}
          onOpenChange={(open) => !open && setSelectedTourForAlerts(null)}
        />
      )}

      <GlobalTourAlertsModal
        open={showGlobalAlerts}
        onOpenChange={setShowGlobalAlerts}
      />
    </Card>
  );
};