
import { Button } from "@/components/ui/button";
import { TourBookingsList } from "@/components/TourBookingsList";

interface TourBookingsTabProps {
  tourId: string;
  tourName: string;
  onAddBooking: () => void;
}

export const TourBookingsTab = ({ tourId, tourName, onAddBooking }: TourBookingsTabProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bookings</h3>
        <Button 
          onClick={onAddBooking}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Add Booking
        </Button>
      </div>
      <TourBookingsList tourId={tourId} tourName={tourName} />
    </div>
  );
};
