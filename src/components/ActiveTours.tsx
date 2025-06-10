import { useTours } from "@/hooks/useTours";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Plus } from "lucide-react";
import { useState } from "react";
import { TourDetailModal } from "@/components/TourDetailModal";
import { AddTourModal } from "@/components/AddTourModal";

export const ActiveTours = () => {
  const { data: tours, isLoading } = useTours();
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [showTourDetail, setShowTourDetail] = useState(false);
  const [showAddTour, setShowAddTour] = useState(false);

  const activeTours = tours?.filter(tour => 
    tour.status === 'available' || tour.status === 'pending'
  ) || [];

  const handleTourClick = (tour: any) => {
    setSelectedTour(tour);
    setShowTourDetail(true);
  };

  if (isLoading) {
    return <div>Loading tours...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Active Tours</CardTitle>
            <Button 
              onClick={() => setShowAddTour(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tour
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeTours.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No active tours found.</p>
              <Button 
                onClick={() => setShowAddTour(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                Create Your First Tour
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeTours.map((tour) => (
                <Card 
                  key={tour.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleTourClick(tour)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{tour.name}</CardTitle>
                      <Badge variant="secondary">{tour.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(tour.start_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{tour.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{tour.capacity}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TourDetailModal
        tour={selectedTour}
        open={showTourDetail}
        onOpenChange={setShowTourDetail}
      />

      <AddTourModal
        open={showAddTour}
        onOpenChange={setShowAddTour}
      />
    </>
  );
};
