import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Edit, MapPin, Calendar, Users, FileText, Settings } from "lucide-react";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddActivityModal } from "@/components/AddActivityModal";
import { AddHotelModal } from "@/components/AddHotelModal";
import { EditActivityModal } from "@/components/EditActivityModal";
import { EditHotelModal } from "@/components/EditHotelModal";
import { RoomingListModal } from "@/components/RoomingListModal";
import { BulkRoomingEditModal } from "@/components/BulkRoomingEditModal";
import { TourOverviewTab } from "@/components/TourOverviewTab";
import { TourActivitiesTab } from "@/components/TourActivitiesTab";
import { TourHotelsTab } from "@/components/TourHotelsTab";
import { TourBookingsTab } from "@/components/TourBookingsTab";
import { TourOperationsTab } from "@/components/TourOperationsTab";
import { Tour, useTours } from "@/hooks/useTours";
import { formatDateRange } from "@/lib/utils";
import { TourOperationsReportsModal } from "@/components/TourOperationsReportsModal";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

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
  const [roomingListModalOpen, setRoomingListModalOpen] = useState(false);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [transformedTour, setTransformedTour] = useState<any>(null);
  const [currentTab, setCurrentTab] = useState(defaultTab);

  const navigate = useNavigate();
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const canViewOperations = userRole === 'admin' || userRole === 'manager';
  
  // Get fresh tour data from the query cache
  const { data: tours } = useTours();
  const currentTour = tours?.find(t => t.id === tour?.id) || tour;

  // Use the defaultTab directly and add debugging
  console.log('TourDetailModal defaultTab received:', defaultTab);
  const actualDefaultTab = defaultTab;
  console.log('TourDetailModal actualDefaultTab set to:', actualDefaultTab);

  // Sync the current tab whenever the modal opens or defaultTab changes
  useEffect(() => {
    if (open && currentTour) {
      setCurrentTab(defaultTab);
    }
  }, [defaultTab, open, currentTour?.id]);

  useEffect(() => {
    console.log('Hotels tab tour data transformation triggered:', {
      tourId: currentTour?.id,
      tourName: currentTour?.name,
      startDate: currentTour?.start_date,
      endDate: currentTour?.end_date,
      updatedAt: currentTour?.updated_at,
      fullTour: currentTour
    });
    
    if (currentTour) {
      const transformed = {
        id: currentTour.id,
        name: currentTour.name,
        dates: formatDateRange(currentTour.start_date, currentTour.end_date),
        duration: `${currentTour.days} days / ${currentTour.nights} nights`,
        location: currentTour.location || "",
        pickupPoint: currentTour.pickup_point || "",
        status: currentTour.status,
        notes: currentTour.notes || "",
        inclusions: currentTour.inclusions || "",
        exclusions: currentTour.exclusions || "",
        pricing: {
          single: currentTour.price_single || 0,
          double: currentTour.price_double || 0,
          twin: currentTour.price_twin || 0,
        },
        deposit: currentTour.deposit_required || 0,
        instalmentAmount: currentTour.instalment_amount || 0,
        instalmentDate: currentTour.instalment_date || "",
        finalPaymentDate: currentTour.final_payment_date || "",
        totalCapacity: currentTour.capacity || 0,
        minimumPassengers: currentTour.minimum_passengers_required || null,
        startDate: currentTour.start_date,
        endDate: currentTour.end_date,
        tourHost: currentTour.tour_host,
      };
      console.log('Hotels tab tour transformed successfully:', transformed);
      setTransformedTour(transformed);
    } else {
      console.log('No tour provided to hotels tab, clearing transformed tour');
      setTransformedTour(null);
    }
  }, [currentTour]);

  // Force refresh when modal opens
  useEffect(() => {
    if (open && tour?.id) {
      console.log('Hotels tab modal opened, forcing refresh for tour:', tour.id);
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', tour.id] });
      queryClient.invalidateQueries({ queryKey: ['activities', tour.id] });
      queryClient.invalidateQueries({ queryKey: ['hotels', tour.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    }
  }, [open, tour?.id, queryClient]);

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

  const handleBulkEdit = (hotel: any) => {
    setSelectedHotel(hotel);
    setBulkEditModalOpen(true);
  };

  // Don't render modal content if no tour is provided or modal is not open
  if (!open || !currentTour) {
    return null;
  }

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
                <DialogTitle className="text-brand-navy">{currentTour?.name}</DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    navigate(`/tours/${currentTour?.id}/edit`);
                    onOpenChange(false);
                  }}
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

          <Tabs value={currentTab} onValueChange={setCurrentTab} className={`w-full`}>
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
                tourId={currentTour?.id || ""}
                onAddHotel={() => setAddHotelModalOpen(true)}
                onEditHotel={handleEditHotel}
                onBulkEdit={handleBulkEdit}
                onRoomingList={handleRoomingList}
              />
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <TourActivitiesTab
                tourId={currentTour?.id || ""}
                onAddActivity={() => setAddActivityModalOpen(true)}
                onEditActivity={handleActivityClick}
              />
            </TabsContent>

            <TabsContent value="bookings" className="space-y-4">
              <TourBookingsTab
                tourId={currentTour?.id || ""}
                tourName={currentTour?.name || ""}
                onAddBooking={() => setAddBookingModalOpen(true)}
              />
            </TabsContent>

            {canViewOperations && (
              <TabsContent value="operations" className="space-y-4">
                <TourOperationsTab
                  tourId={currentTour?.id || ""}
                  tourName={currentTour?.name || ""}
                />
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      <AddBookingModal
        open={addBookingModalOpen}
        onOpenChange={setAddBookingModalOpen}
        preSelectedTourId={currentTour?.id}
      />

      <AddActivityModal
        open={addActivityModalOpen}
        onOpenChange={setAddActivityModalOpen}
        tourId={currentTour?.id}
      />

      <AddHotelModal
        open={addHotelModalOpen}
        onOpenChange={setAddHotelModalOpen}
        tourId={currentTour?.id}
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
          tourId={currentTour?.id || ""}
        />
      )}

      {/* Bulk Rooming Edit Modal */}
      <BulkRoomingEditModal
        hotel={selectedHotel}
        tourId={currentTour?.id || ""}
        open={bulkEditModalOpen}
        onOpenChange={setBulkEditModalOpen}
      />
    </>
  );
};
