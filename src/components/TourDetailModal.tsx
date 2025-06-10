
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddActivityModal } from "@/components/AddActivityModal";
import { AddHotelModal } from "@/components/AddHotelModal";
import { EditActivityModal } from "@/components/EditActivityModal";
import { EditHotelModal } from "@/components/EditHotelModal";
import { EditTourModal } from "@/components/EditTourModal";
import { RoomingListModal } from "@/components/RoomingListModal";
import { TourOverviewTab } from "@/components/TourOverviewTab";
import { TourActivitiesTab } from "@/components/TourActivitiesTab";
import { TourHotelsTab } from "@/components/TourHotelsTab";
import { TourBookingsTab } from "@/components/TourBookingsTab";
import { Tour } from "@/hooks/useTours";
import { formatDateRange } from "@/lib/utils";

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
  const [roomingListModalOpen, setRoomingListModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);

  const handleActivityClick = (activity: any) => {
    setSelectedActivity(activity);
    setEditActivityModalOpen(true);
  };

  const handleEditHotel = (hotel: any) => {
    setSelectedHotel(hotel);
    setEditHotelModalOpen(true);
  };

  const handleRoomingList = (hotel: any) => {
    setSelectedHotel(hotel);
    setRoomingListModalOpen(true);
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
              {transformedTour && <TourOverviewTab tour={transformedTour} />}
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <TourActivitiesTab
                tourId={tour?.id || ""}
                onAddActivity={() => setAddActivityModalOpen(true)}
                onEditActivity={handleActivityClick}
              />
            </TabsContent>

            <TabsContent value="hotels" className="space-y-4">
              <TourHotelsTab
                tourId={tour?.id || ""}
                onAddHotel={() => setAddHotelModalOpen(true)}
                onEditHotel={handleEditHotel}
                onRoomingList={handleRoomingList}
              />
            </TabsContent>

            <TabsContent value="bookings" className="space-y-4">
              <TourBookingsTab
                tourId={tour?.id || ""}
                tourName={tour?.name || ""}
                onAddBooking={() => setAddBookingModalOpen(true)}
              />
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

      {selectedHotel && (
        <RoomingListModal
          open={roomingListModalOpen}
          onOpenChange={setRoomingListModalOpen}
          hotel={selectedHotel}
          tourId={tour?.id || ""}
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
