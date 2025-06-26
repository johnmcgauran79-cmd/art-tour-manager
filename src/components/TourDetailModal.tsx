import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Copy, MapPin, Calendar, Users, FileText, Settings, Trash2, Paperclip } from "lucide-react";
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
import { TourAttachmentsSection } from "@/components/TourAttachmentsSection";
import { DuplicateTourDialog } from "@/components/DuplicateTourDialog";
import { Tour } from "@/hooks/useTours";
import { useDuplicateTour } from "@/hooks/useDuplicateTour";
import { formatDateRange } from "@/lib/utils";
import { TourOperationsReportsModal } from "@/components/TourOperationsReportsModal";
import { useAuth } from "@/hooks/useAuth";
import { useSecureDeleteTour } from "@/hooks/useSecureTours";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [tourForEdit, setTourForEdit] = useState<any>(null);
  const [currentTab, setCurrentTab] = useState("overview");
  const [transformedTour, setTransformedTour] = useState<any>(null);

  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const secureDeleteTour = useSecureDeleteTour();

  // Transform tour data whenever ANY tour property changes
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
  }, [
    tour?.id,
    tour?.name,
    tour?.start_date,
    tour?.end_date,
    tour?.days,
    tour?.nights,
    tour?.location,
    tour?.pickup_point,
    tour?.status,
    tour?.notes,
    tour?.inclusions,
    tour?.exclusions,
    tour?.price_single,
    tour?.price_double,
    tour?.price_twin,
    tour?.deposit_required,
    tour?.instalment_amount,
    tour?.instalment_date,
    tour?.final_payment_date,
    tour?.capacity,
    tour?.tour_host,
    tour?.updated_at
  ]);

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

  const handleDuplicateTour = () => {
    if (userRole === 'admin' || userRole === 'manager') {
      setDuplicateDialogOpen(true);
    } else {
      toast({
        title: "Access Denied",
        description: "Only admin and manager users can duplicate tours.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTour = () => {
    if (tour) {
      secureDeleteTour.mutate({
        tourId: tour.id,
        tourName: tour.name
      }, {
        onSuccess: () => {
          // Close the modal after successful deletion
          onOpenChange(false);
        }
      });
    }
  };

  const handleTourCreated = (newTour: any) => {
    const transformedNewTour = {
      id: newTour.id,
      name: newTour.name,
      dates: formatDateRange(newTour.start_date, newTour.end_date),
      duration: `${newTour.days} days / ${newTour.nights} nights`,
      location: newTour.location || "",
      pickupPoint: newTour.pickup_point || "",
      status: newTour.status,
      notes: newTour.notes || "",
      inclusions: newTour.inclusions || "",
      exclusions: newTour.exclusions || "",
      pricing: {
        single: newTour.price_single || 0,
        double: newTour.price_double || 0,
        twin: newTour.price_twin || 0,
      },
      deposit: newTour.deposit_required || 0,
      instalmentAmount: newTour.instalment_amount || 0,
      instalmentDate: newTour.instalment_date || "",
      finalPaymentDate: newTour.final_payment_date || "",
      totalCapacity: newTour.capacity || 0,
      startDate: newTour.start_date,
      endDate: newTour.end_date,
      tourHost: newTour.tour_host,
    };
    
    // Close the current detail modal and open edit modal for the new tour
    onOpenChange(false);
    setTourForEdit(transformedNewTour);
    setEditTourModalOpen(true);
  };

  const handleTourDeleted = () => {
    // Close the modal when tour is deleted from EditTourModal
    onOpenChange(false);
  };

  const handleNavigateFromDeadlines = (destination: { type: 'tab' | 'hotel'; value: string; hotelId?: string }) => {
    setCurrentTab(destination.value);
    
    // If navigating to a specific hotel, we could store the hotelId for future use
    // For now, just switching to the hotels tab is sufficient
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
                {(userRole === 'admin' || userRole === 'manager') && (
                  <Button
                    onClick={handleDuplicateTour}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate Tour
                  </Button>
                )}
                {userRole === 'admin' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Tour
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to delete this tour?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the tour "{tour?.name}" and all associated data including bookings, activities, and hotels. This action will be logged for security audit.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteTour}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={secureDeleteTour.isPending}
                        >
                          {secureDeleteTour.isPending ? "Deleting..." : "Delete Tour"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
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

          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-gray-50">
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
              <TabsTrigger value="operations" className="flex items-center gap-2 data-[state=active]:bg-brand-navy data-[state=active]:text-brand-yellow">
                <Settings className="h-4 w-4" />
                Operations
              </TabsTrigger>
              <TabsTrigger value="attachments" className="flex items-center gap-2 data-[state=active]:bg-brand-navy data-[state=active]:text-brand-yellow">
                <Paperclip className="h-4 w-4" />
                Files
              </TabsTrigger>
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

            <TabsContent value="operations" className="space-y-4">
              <TourOperationsTab
                tourId={tour?.id || ""}
                tourName={tour?.name || ""}
                onNavigate={handleNavigateFromDeadlines}
              />
            </TabsContent>

            <TabsContent value="attachments" className="space-y-4">
              <TourAttachmentsSection tourId={tour?.id || ""} />
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

      <EditTourModal
        open={editTourModalOpen}
        onOpenChange={(open) => {
          setEditTourModalOpen(open);
          if (!open) {
            setTourForEdit(null);
          }
        }}
        tour={tourForEdit || transformedTour}
        onTourDeleted={handleTourDeleted}
      />

      <DuplicateTourDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        originalTour={tour ? { id: tour.id, name: tour.name } : null}
        onTourCreated={handleTourCreated}
      />

      <TourOperationsReportsModal
        tourId={tour?.id || ""}
        tourName={tour?.name || ""}
        open={reportsModalOpen}
        onOpenChange={setReportsModalOpen}
      />
    </>
  );
};
