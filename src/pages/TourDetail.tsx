import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Copy, MapPin, Calendar, Users, FileText, Building, Trash2, Paperclip, Clock, ClipboardList, ArrowLeft, Bus, UserCheck, FormInput, ShieldCheck, Info, Mail, BookOpen } from "lucide-react";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddActivityModal } from "@/components/AddActivityModal";
import { AddHotelModal } from "@/components/AddHotelModal";
import { EditActivityModal } from "@/components/EditActivityModal";
import { EditHotelModal } from "@/components/EditHotelModal";
import { RoomingListModal } from "@/components/RoomingListModal";
import { BulkRoomingEditModal } from "@/components/BulkRoomingEditModal";
import { ActivityPassengerAllocationModal } from "@/components/ActivityPassengerAllocationModal";
import { TourOverviewTab } from "@/components/TourOverviewTab";
import { TourActivitiesTab } from "@/components/TourActivitiesTab";
import { TourHotelsTab } from "@/components/TourHotelsTab";
import { TourBookingsTab } from "@/components/TourBookingsTab";
import { TourOperationsTab } from "@/components/TourOperationsTab";
import { TourAttachmentsSection } from "@/components/TourAttachmentsSection";
import { TourItineraryTab } from "@/components/TourItineraryTab";
import { TourTasksTab } from "@/components/TourTasksTab";
import { RelatedTasksSection } from "@/components/entityLinks/RelatedTasksSection";
import { TourPickupLocationsTab } from "@/components/TourPickupLocationsTab";
import { TourHostsInfoTab } from "@/components/TourHostsInfoTab";
import { TourCustomFormsTab } from "@/components/TourCustomFormsTab";
import { TourPassportDetailsTab } from "@/components/TourPassportDetailsTab";
import { TourAdditionalInfoTab } from "@/components/TourAdditionalInfoTab";
import { TourCommsSettingsTab } from "@/components/TourCommsSettingsTab";
import { TourWaiverStatusSection } from "@/components/TourWaiverStatusSection";
import { Separator } from "@/components/ui/separator";
import { TourAlertsModal } from "@/components/TourAlertsModal";
import { DuplicateTourDialog } from "@/components/DuplicateTourDialog";
import { Tour, useTours } from "@/hooks/useTours";
import { formatDateRange } from "@/lib/utils";
import { TourOperationsReportsModal } from "@/components/TourOperationsReportsModal";
import { useAuth } from "@/hooks/useAuth";
import { useSecureDeleteTour } from "@/hooks/useSecureTours";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { useTourAlerts } from "@/hooks/useTourAlerts";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";

const GuestDocsSubTabs = ({ tour }: { tour: Tour }) => {
  const [subTab, setSubTab] = useState("itinerary");
  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="itinerary" className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Itinerary
        </TabsTrigger>
        <TabsTrigger value="additional-info" className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Additional Info
        </TabsTrigger>
      </TabsList>
      <TabsContent value="itinerary">
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
      <TabsContent value="additional-info">
        <TourAdditionalInfoTab tourId={tour.id} tourName={tour.name} />
      </TabsContent>
    </Tabs>
  );
};

export default function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { goBack } = useNavigationContext();
  const { data: tours, isLoading } = useTours();
  const tour = tours?.find(t => t.id === id);

  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [addActivityModalOpen, setAddActivityModalOpen] = useState(false);
  const [addHotelModalOpen, setAddHotelModalOpen] = useState(false);
  const [editActivityModalOpen, setEditActivityModalOpen] = useState(false);
  const [editHotelModalOpen, setEditHotelModalOpen] = useState(false);
  const [roomingListModalOpen, setEditRoomingListModalOpen] = useState(false);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(searchParams.get('tab') || "overview");
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [newlyCreatedActivity, setNewlyCreatedActivity] = useState<{id: string, name: string} | null>(null);
  const [initialReportType, setInitialReportType] = useState<'passport' | 'pickup' | 'forms' | null>(
    (searchParams.get('report') as 'passport' | 'pickup' | 'forms') || null
  );

  // Update tab when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      setCurrentTab(tabFromUrl);
    }
    const reportFromUrl = searchParams.get('report') as 'passport' | 'pickup' | 'forms' | null;
    if (reportFromUrl) {
      setInitialReportType(reportFromUrl);
    }
  }, [searchParams]);

  const { userRole } = useAuth();
  const isHost = userRole === 'host';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const secureDeleteTour = useSecureDeleteTour();
  const { alerts } = useTourAlerts(id || '', false);
  const { isViewOnly, hasEditAccess } = usePermissions();

  // Transform tour data immediately - don't wait for useEffect
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
    instalmentRequired: tour.instalment_required || false,
    instalmentAmount: tour.instalment_amount || 0,
    instalmentDate: tour.instalment_date || "",
    finalPaymentDate: tour.final_payment_date || "",
    travelDocumentsRequired: tour.travel_documents_required || false,
    totalCapacity: tour.capacity || 0,
    minimumPassengers: tour.minimum_passengers_required || null,
    startDate: tour.start_date,
    endDate: tour.end_date,
    tourHost: tour.tour_host || '',
    keapTagId: tour.keap_tag_id || '',
    xeroProductId: tour.xero_product_id || '',
    xeroReference: (tour as any).xero_reference || '',
  } : null;

  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);

  const handleDeleteTour = async () => {
    if (!tour) return;
    if (deleteConfirmName !== tour.name) return;
    
    secureDeleteTour.mutate(
      { tourId: tour.id, tourName: tour.name },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Tour deleted successfully",
          });
          setDeleteConfirmName('');
          setDeleteStep(1);
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

  const { data: activeBookingCount = 0 } = useQuery({
    queryKey: ['tour-active-booking-count', id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tour_id', id!)
        .not('status', 'eq', 'cancelled');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <AppBreadcrumbs
          items={[
            { label: "Back", onClick: () => goBack("/?tab=tours") },
            { label: tour.name }
          ]}
        />
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{tour.name}</h1>
              {(tour as any).is_test_tour && (
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground px-2 py-1 text-xs font-medium">
                  🧪 TEST TOUR
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDateRange(tour.start_date, tour.end_date)}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goBack("/?tab=tours")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            
            {!isViewOnly && userRole !== 'operations_team' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/tours/${id}/edit`)}
                  className="flex-shrink-0"
                >
                  <Edit className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDuplicateDialogOpen(true)}
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Duplicate</span>
                </Button>
                
                <AlertDialog onOpenChange={(open) => { if (!open) { setDeleteStep(1); setDeleteConfirmName(''); } }}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-shrink-0">
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Tour</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3">
                          {activeBookingCount > 0 && (
                            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-destructive text-sm font-medium">
                              ⚠️ This tour has {activeBookingCount} active booking{activeBookingCount !== 1 ? 's' : ''}. Deleting will permanently remove all associated bookings, hotel allocations, activities, and customer data.
                            </div>
                          )}
                          {deleteStep === 1 ? (
                            <p>Are you sure you want to delete <strong>{tour.name}</strong>? This action cannot be undone and will permanently remove all associated data.</p>
                          ) : (
                            <div className="space-y-2">
                              <p>To confirm deletion, type the tour name exactly:</p>
                              <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{tour.name}</p>
                              <Input
                                value={deleteConfirmName}
                                onChange={(e) => setDeleteConfirmName(e.target.value)}
                                placeholder="Type tour name to confirm..."
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      {deleteStep === 1 ? (
                        <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                          Continue
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          onClick={handleDeleteTour}
                          disabled={deleteConfirmName !== tour.name || secureDeleteTour.isPending}
                        >
                          {secureDeleteTour.isPending ? 'Deleting...' : 'Permanently Delete'}
                        </Button>
                      )}
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
        <div className="sticky top-[52px] z-30 bg-background -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 border-b shadow-sm">
          {isHost ? (
            <TabsList className="w-full overflow-x-auto flex justify-start md:grid md:grid-cols-3 md:max-w-md h-auto p-1 gap-1">
              <TabsTrigger value="overview" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Bookings</span>
              </TabsTrigger>
              <TabsTrigger value="hostsinfo" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Hosts Info</span>
              </TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="w-full overflow-x-auto flex justify-start md:w-auto h-auto p-1 gap-1">
              <TabsTrigger value="overview" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="hotels" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <Building className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Hotels</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Bookings</span>
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Activities</span>
              </TabsTrigger>
              {tour.pickup_location_required && (
                <TabsTrigger value="pickup" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Bus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Pickup</span>
                </TabsTrigger>
              )}
              {tour.travel_documents_required && (
                <TabsTrigger value="passport" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Passport Details</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="hostsinfo" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Hosts Info</span>
              </TabsTrigger>
              <TabsTrigger value="operations" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Operations</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="guest-docs" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Guest Docs</span>
              </TabsTrigger>
              <TabsTrigger value="forms" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <FormInput className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Forms</span>
              </TabsTrigger>
              <TabsTrigger value="comms" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Comms</span>
              </TabsTrigger>
            </TabsList>
          )}
        </div>

        <TabsContent value="overview" className="space-y-4 mt-6">
          {transformedTour && <TourOverviewTab 
            tour={transformedTour} 
            onNavigateToReport={(reportType) => {
              setInitialReportType(reportType);
              setCurrentTab('operations');
            }}
          />}
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4 mt-6">
          <TourBookingsTab 
            tourId={tour.id}
            tourName={tour.name}
            alerts={alerts}
            onAddBooking={() => setAddBookingModalOpen(true)}
            onOpenAlerts={() => setAlertsModalOpen(true)}
            currentTab={currentTab}
          />
        </TabsContent>

        <TabsContent value="guest-docs" className="space-y-4 mt-6">
          <GuestDocsSubTabs tour={tour} />
        </TabsContent>

        <TabsContent value="activities" className="space-y-4 mt-6">
          <TourActivitiesTab
            tourId={tour.id}
            alerts={alerts}
            onAddActivity={() => setAddActivityModalOpen(true)}
            onOpenAlerts={() => setAlertsModalOpen(true)}
            onEditActivity={(activity) => {
              setSelectedActivity(activity);
              setEditActivityModalOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="hotels" className="space-y-4 mt-6">
          <TourHotelsTab
            tourId={tour.id}
            alerts={alerts}
            onAddHotel={() => setAddHotelModalOpen(true)}
            onOpenAlerts={() => setAlertsModalOpen(true)}
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

        <TabsContent value="pickup" className="space-y-4 mt-6">
          <TourPickupLocationsTab
            tourId={tour.id}
            tourName={tour.name}
            pickupLocationRequired={tour.pickup_location_required || false}
            isViewOnly={isViewOnly}
          />
        </TabsContent>

        <TabsContent value="passport" className="space-y-4 mt-6">
          <TourPassportDetailsTab tourId={tour.id} tourName={tour.name} />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 mt-6">
          <TourTasksTab tourId={tour.id} tourName={tour.name} />
          <RelatedTasksSection
            entityType="tour"
            entityId={tour.id}
            title="Tasks Mentioning This Tour"
          />
        </TabsContent>

        <TabsContent value="hostsinfo" className="space-y-4 mt-6">
          <TourHostsInfoTab
            tourId={tour.id}
            tourName={tour.name}
            pickupLocationRequired={tour.pickup_location_required || false}
          />
        </TabsContent>


        <TabsContent value="forms" className="space-y-6 mt-6">
          <TourWaiverStatusSection tourId={tour.id} tourName={tour.name} />
          <Separator />
          <TourCustomFormsTab tourId={tour.id} tourName={tour.name} />
        </TabsContent>

        <TabsContent value="comms" className="space-y-4 mt-6">
          <TourCommsSettingsTab tourId={tour.id} tourName={tour.name} />
        </TabsContent>

        <TabsContent value="operations" className="space-y-4 mt-6">
          <TourOperationsTab
            tourId={tour.id}
            tourName={tour.name}
            travelDocumentsRequired={tour.travel_documents_required}
            pickupLocationRequired={tour.pickup_location_required || false}
            onNavigate={handleNavigate}
            initialReportType={initialReportType}
            onInitialReportHandled={() => setInitialReportType(null)}
          />
          <div className="mt-6">
            <TourAttachmentsSection tourId={tour.id} />
          </div>
        </TabsContent>
      </Tabs>

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
        onActivityCreated={async (activity) => {
          console.log('onActivityCreated callback received:', activity);
          setAddActivityModalOpen(false);
          
          // Always open allocation modal - bookings were auto-allocated
          setNewlyCreatedActivity(activity);
          setAllocationModalOpen(true);
          console.log('Opening allocation modal for activity:', activity);
        }}
      />
      {newlyCreatedActivity && (
        <ActivityPassengerAllocationModal
          open={allocationModalOpen}
          onOpenChange={(open) => {
            setAllocationModalOpen(open);
            if (!open) {
              setNewlyCreatedActivity(null);
            }
          }}
          tourId={tour.id}
          activityId={newlyCreatedActivity.id}
          activityName={newlyCreatedActivity.name}
        />
      )}
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
      <TourAlertsModal
        tourId={tour.id}
        open={alertsModalOpen}
        onOpenChange={setAlertsModalOpen}
      />
    </div>
  );
}
