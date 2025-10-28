import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { TourItineraryTab } from "@/components/TourItineraryTab";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

export default function TourItinerary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: tours, isLoading } = useTours();
  const tour = tours?.find(t => t.id === id);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!tour) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Tour Not Found</h1>
        <Button onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const transformedTour = {
    id: tour.id,
    name: tour.name,
    startDate: tour.start_date,
    endDate: tour.end_date,
    days: tour.days || 0,
    nights: tour.nights || 0,
    location: tour.location
  };

  return (
    <div className="space-y-6 p-6">
      <AppBreadcrumbs
        items={[
          { label: "Tours", href: "/?tab=tours" },
          { label: tour.name, href: `/tours/${tour.id}` },
          { label: "Itinerary" }
        ]}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{tour.name} - Itinerary</h1>
        <Button
          variant="outline"
          onClick={() => navigate(`/tours/${id}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tour
        </Button>
      </div>

      <TourItineraryTab tour={transformedTour} />
    </div>
  );
}