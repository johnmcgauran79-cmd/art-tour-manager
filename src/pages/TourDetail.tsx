import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Copy, MapPin, Calendar, Users, FileText, Settings, Trash2, Paperclip, Clock, ClipboardList, ArrowLeft } from "lucide-react";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddActivityModal } from "@/components/AddActivityModal";
import { AddHotelModal } from "@/components/AddHotelModal";
import { EditActivityModal } from "@/components/EditActivityModal";
import { EditHotelModal } from "@/components/EditHotelModal";
import { EditTourModal } from "@/components/EditTourModal";
import { RoomingListModal } from "@/components/RoomingListModal";
import { BulkRoomingEditModal } from "@/components/BulkRoomingEditModal";
import { TourOverviewTab } from "@/components/TourOverviewTab";
import { TourActivitiesTab } from "@/components/TourActivitiesTab";
import { TourHotelsTab } from "@/components/TourHotelsTab";
import { TourBookingsTab } from "@/components/TourBookingsTab";
import { TourOperationsTab } from "@/components/TourOperationsTab";
import { TourAttachmentsSection } from "@/components/TourAttachmentsSection";
import { TourItineraryTab } from "@/components/TourItineraryTab";
import { TourTasksTab } from "@/components/TourTasksTab";
import { DuplicateTourDialog } from "@/components/DuplicateTourDialog";
import { Tour, useTours } from "@/hooks/useTours";
import { formatDateRange } from "@/lib/utils";
import { TourOperationsReportsModal } from "@/components/TourOperationsReportsModal";
import { useAuth } from "@/hooks/useAuth";
import { useSecureDeleteTour } from "@/hooks/useSecureTours";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

export default function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: tours, isLoading } = useTours();
  const tour = tours?.find(t => t.id === id);

  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [addActivityModalOpen, setAddActivityModalOpen] = useState(false);
  const [addHotelModalOpen, setAddHotelModalOpen] = useState(false);
  const [editActivityModalOpen, setEditActivityModalOpen] = useState(false);
  const [editHotelModalOpen, setEditHotelModalOpen] = useState(false);
  const [editTourModalOpen, setEditTourModalOpen] = useState(false);
  const [roomingListModalOpen, setEditRoomingListModalOpen] = useState(false);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
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

  // Transform tour data
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
        minimumPassengersRequired: tour.minimum_passengers_required || null
      };
      setTransformedTour(transformed);
      setTourForEdit(tour);
    }
  }, [tour]);

  const handleDeleteTour = async () => {
    if (!tour) return;
    
    secureDeleteTour.mutate(
      { tourId: tour.id, tourName: tour.name },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Tour deleted successfully",
          });
          navigate("/");
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Failed to delete tour",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleNavigate = (destination: { type: 'tab' | 'hotel'; value: string; hotelId?: string }) => {
    if (destination.type === 'tab') {
      setCurrentTab(destination.value);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Tour Not Found</h1>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <AppBreadcrumbs
            items={[
              { label: "Tours", href: "/" },
              { label: tour.name }
            ]}
          />
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{tour.name}</h1>
              <p className="text-muted-foreground mt-1">
                {formatDateRange(tour.start_date, tour.end_date)}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              
              {userRole !== 'operations_team' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditTourModalOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDuplicateDialogOpen(true)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tour</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this tour? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTour}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Bookings</span>
            </TabsTrigger>
            <TabsTrigger value="itinerary" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Itinerary</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Activities</span>
            </TabsTrigger>
            <TabsTrigger value="hotels" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Hotels</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Operations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-6">
            <TourOverviewTab tour={{
              ...transformedTour,
              startDate: tour.start_date,
              endDate: tour.end_date,
              minimumPassengers: tour.minimum_passengers_required,
              tourHost: ''
            }} />
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4 mt-6">
            <TourBookingsTab 
              tourId={tour.id}
              tourName={tour.name}
              onAddBooking={() => setAddBookingModalOpen(true)}
            />
          </TabsContent>

          <TabsContent value="itinerary" className="space-y-4 mt-6">
            <TourItineraryTab tour={{
              id: tour.id,
              name: tour.name,
              startDate: tour.start_date,
              endDate: tour.end_date,
              days: tour.days,
              nights: tour.nights,
              location: tour.location || ''
            }} />
          </TabsContent>

          <TabsContent value="activities" className="space-y-4 mt-6">
            <TourActivitiesTab
              tourId={tour.id}
              onAddActivity={() => setAddActivityModalOpen(true)}
              onEditActivity={(activity) => {
                setSelectedActivity(activity);
                setEditActivityModalOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="hotels" className="space-y-4 mt-6">
            <TourHotelsTab
              tourId={tour.id}
              onAddHotel={() => setAddHotelModalOpen(true)}
              onEditHotel={(hotel) => {
                setSelectedHotel(hotel);
                setEditHotelModalOpen(true);
              }}
              onRoomingList={(hotel) => {
                setSelectedHotel(hotel);
                setEditRoomingListModalOpen(true);
              }}
              onBulkEdit={(hotel) => {
                setSelectedHotel(hotel);
                setBulkEditModalOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 mt-6">
            <TourTasksTab tourId={tour.id} tourName={tour.name} />
          </TabsContent>

          <TabsContent value="operations" className="space-y-4 mt-6">
            <TourOperationsTab
              tourId={tour.id}
              tourName={tour.name}
              onNavigate={handleNavigate}
            />
            <div className="mt-6">
              <TourAttachmentsSection tourId={tour.id} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AddBookingModal
        open={addBookingModalOpen}
        onOpenChange={setAddBookingModalOpen}
        preSelectedTourId={tour.id}
        preSelectedTourStartDate={tour.start_date}
        preSelectedTourEndDate={tour.end_date}
      />
      <AddActivityModal
        open={addActivityModalOpen}
        onOpenChange={setAddActivityModalOpen}
        tourId={tour.id}
      />
      <AddHotelModal
        open={addHotelModalOpen}
        onOpenChange={setAddHotelModalOpen}
        tourId={tour.id}
      />
      {editActivityModalOpen && selectedActivity && (
        <EditActivityModal
          open={editActivityModalOpen}
          onOpenChange={setEditActivityModalOpen}
          activity={selectedActivity}
        />
      )}
      {editHotelModalOpen && selectedHotel && (
        <EditHotelModal
          open={editHotelModalOpen}
          onOpenChange={setEditHotelModalOpen}
          hotel={selectedHotel}
        />
      )}
      {editTourModalOpen && tourForEdit && (
        <EditTourModal
          open={editTourModalOpen}
          onOpenChange={setEditTourModalOpen}
          tour={tourForEdit}
        />
      )}
      {roomingListModalOpen && selectedHotel && (
        <RoomingListModal
          open={roomingListModalOpen}
          onOpenChange={setEditRoomingListModalOpen}
          hotel={selectedHotel}
          tourId={tour.id}
        />
      )}
      {bulkEditModalOpen && selectedHotel && (
        <BulkRoomingEditModal
          open={bulkEditModalOpen}
          onOpenChange={setBulkEditModalOpen}
          hotel={selectedHotel}
          tourId={tour.id}
        />
      )}
      <DuplicateTourDialog
        originalTour={tour}
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        onTourCreated={() => {}}
      />
      <TourOperationsReportsModal
        tourId={tour.id}
        tourName={tour.name}
        open={reportsModalOpen}
        onOpenChange={setReportsModalOpen}
      />
    </div>
  );
}
