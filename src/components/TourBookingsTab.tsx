
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Users, Utensils, UserPlus } from "lucide-react";
import { TourBookingsList } from "@/components/TourBookingsList";
import { BulkBookingStatusModal } from "@/components/BulkBookingStatusModal";
import { BulkDietaryModal } from "@/components/BulkDietaryModal";
import { AddBookingModal } from "@/components/AddBookingModal";

interface TourBookingsTabProps {
  tourId: string;
  tourName: string;
  onAddBooking: () => void;
}

export const TourBookingsTab = ({ tourId, tourName, onAddBooking }: TourBookingsTabProps) => {
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);
  const [bulkDietaryModalOpen, setBulkDietaryModalOpen] = useState(false);
  const [addWaitlistModalOpen, setAddWaitlistModalOpen] = useState(false);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-brand-navy">Tour Bookings</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setBulkDietaryModalOpen(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
            >
              <Utensils className="h-4 w-4" />
              Bulk Update Dietary
            </Button>
            <Button
              onClick={() => setBulkStatusModalOpen(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
            >
              <Users className="h-4 w-4" />
              Bulk Update Status
            </Button>
            <Button
              onClick={() => setAddWaitlistModalOpen(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/5"
            >
              <UserPlus className="h-4 w-4" />
              Add to Waitlist
            </Button>
            <Button
              onClick={onAddBooking}
              size="sm"
              className="flex items-center gap-2 bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              <Plus className="h-4 w-4" />
              Add Booking
            </Button>
          </div>
        </div>

        <TourBookingsList tourId={tourId} tourName={tourName} />
      </div>

      <BulkBookingStatusModal
        open={bulkStatusModalOpen}
        onOpenChange={setBulkStatusModalOpen}
        tourId={tourId}
      />

      <BulkDietaryModal
        open={bulkDietaryModalOpen}
        onOpenChange={setBulkDietaryModalOpen}
        tourId={tourId}
      />

      <AddBookingModal 
        open={addWaitlistModalOpen} 
        onOpenChange={setAddWaitlistModalOpen} 
        preSelectedTourId={tourId}
        defaultStatus="waitlisted"
      />
    </>
  );
};
