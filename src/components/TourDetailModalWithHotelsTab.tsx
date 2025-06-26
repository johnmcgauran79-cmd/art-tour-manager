
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Edit, MapPin, Calendar, Users, FileText, Settings } from "lucide-react";
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
import { TourOperationsTab } from "@/components/TourOperationsTab";
import { Tour } from "@/hooks/useTours";
import { formatDateRange } from "@/lib/utils";
import { TourOperationsReportsModal } from "@/components/TourOperationsReportsModal";
import { useAuth } from "@/hooks/useAuth";

interface TourDetailModalWithHotelsTabProps {
  tour: Tour | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

export const TourDetailModalWithHotelsTab = ({ 
  tour, 
  open, 
  onOpenChange, 
  defaultTab = "overview" 
}: TourDetailModalWithHotelsTabProps) => {
  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [addActivityModalOpen, setAddActivityModalOpen] = useState(false);
  const [addHotelModalOpen, setAddHotelModalOpen] = useState(false);
  const [editActivityModalOpen, setEditActivityModalOpen] = useState(false);
  const [editHotelModalOpen, setEditHotelModalOpen] = useState(false);
  const [editTourModalOpen, setEditTourModalOpen] = useState(false);
  const [roomingListModalOpen, setRoomingListModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [transformedTour, setTransformedTour] = useState<any>(null);

  const { userRole } = useAuth();
  const canViewOperations = userRole === 'admin' || userRole === 'manager';

  // Transform tour data whenever the tour prop changes
  useEffect(() => {
    if (tour) {
      const transformed = {
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
        tourHost: tour.tour_host,
      };
      setTransformedTour(transformed);
    } else {
      setTransformedTour(null);
    }
  }, [tour]);

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-brand-navy/10 rounded-lg flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-brand-navy" />
                </div>
                <DialogTitle className="text-brand-navy">{tour?.name}</DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setEditTourModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
                >
                  <Edit className="h-4 w-4" />
                  Edit Tour
                </Button>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    Close
                  </Button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue={defaultTab} className={`w-full`}>
            <TabsList className={`grid w-full ${canViewOperations ? 'grid-cols-5' : 'grid-cols-4'} bg-gray-50`}>
              <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-brand-navy data-[state=active]:text-brand-yellow">
                <FileText className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="hotels" className="flex items-center gap-2 data-[state=active]:bg-brand-navy data-[state=active]:text-brand-yellow">
                <MapPin className="h-4 w-4" />
                Hotels
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center gap-2 data-[state=active]:bg-brand-navy data-[state=active]:text-brand-yellow">
                <Calendar className="h-4 w-4" />
                Activities
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex items-center gap-2 data-[state=active]:bg-brand-navy data-[state=active]:text-brand-yellow">
                <Users className="h-4 w-4" />
                Bookings
              </TabsTrigger>
              {canViewOperations && (
                <TabsTrigger value="operations" className="flex items-center gap-2 data-[state=active]:bg-brand-navy data-[state=active]:text-brand-yellow">
                  <Settings className="h-4 w-4" />
                  Operations
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {transformedTour && <TourOverviewTab tour={transformedTour} />}
            </TabsContent>

            <TabsContent value="hotels" className="space-y-4">
              <TourHotelsTab
                tourId={tour?.id || ""}
                onAddHotel={() => setAddHotelModalOpen(true)}
                onEditHotel={handleEditHotel}
                onRoomingList={handleRoomingList}
              />
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <TourActivitiesTab
                tourId={tour?.id || ""}
                onAddActivity={() => setAddActivityModalOpen(true)}
                onEditActivity={handleActivityClick}
              />
            </TabsContent>

            <TabsContent value="bookings" className="space-y-4">
              <TourBookingsTab
                tourId={tour?.id || ""}
                tourName={tour?.name || ""}
                onAddBooking={() => setAddBookingModalOpen(true)}
              />
            </TabsContent>

            {canViewOperations && (
              <TabsContent value="operations" className="space-y-4">
                <TourOperationsTab
                  tourId={tour?.id || ""}
                  tourName={tour?.name || ""}
                />
              </TabsContent>
            )}
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
