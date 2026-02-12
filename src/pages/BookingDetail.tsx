import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Edit, Trash2, Hotel, MapPin, Heart, FileText, MessageSquare, Mail, ArrowLeft, X, ExternalLink, Shield, Plane } from "lucide-react";
import { EmailPreviewModal } from "@/components/EmailPreviewModal";
import { useBookings, useDeleteBooking, useUpdateBooking } from "@/hooks/useBookings";
import { useHotelBookings } from "@/hooks/useHotelBookings";
import { useActivityBookings } from "@/hooks/useActivityBookings";
import { useActivities } from "@/hooks/useActivities";
import { useHotels } from "@/hooks/useHotels";
import { useBookingComments } from "@/hooks/useBookingComments";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow } from "date-fns";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useTours } from "@/hooks/useTours";
import { BookingCommentsSection } from "@/components/BookingCommentsSection";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBookingAuditLog } from "@/hooks/useBookingAuditLog";
import { BookingAuditTrail } from "@/components/BookingAuditTrail";
import { Separator } from "@/components/ui/separator";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ContactAvatar } from "@/components/ContactAvatar";
import { SendProfileUpdateButton } from "@/components/SendProfileUpdateButton";
import { SendTravelDocsRequestButton } from "@/components/SendTravelDocsRequestButton";
import { PassengerDetailsSection } from "@/components/booking/PassengerDetailsSection";
import { BookingTravelDocsDisplay } from "@/components/booking/BookingTravelDocsDisplay";
import { SendWaiverRequestButton } from "@/components/SendWaiverRequestButton";
import { WaiverStatusDisplay } from "@/components/WaiverStatusDisplay";

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className="text-sm">{value || "—"}</span>
  </div>
);

export default function BookingDetail() {
  const { id } = useParams();
  const { goBack, navigateWithContext, getReturnPath, currentState } = useNavigationContext();
  const { toast } = useToast();
  const { userRole } = useAuth();
  const { data: allBookings, isLoading } = useBookings();
  const booking = allBookings?.find(b => b.id === id);
  
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [currentTab, setCurrentTab] = useState("details");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRemoveSecondaryContactDialog, setShowRemoveSecondaryContactDialog] = useState(false);
  const deleteBooking = useDeleteBooking();
  const updateBooking = useUpdateBooking();
  const isMobile = useIsMobile();
  
  // Agent users have view-only access
  const isAgent = userRole === 'agent';

  const { data: hotelBookings = [] } = useHotelBookings(booking?.id || '');
  const { data: activityBookings = [] } = useActivityBookings(booking?.id || '');
  const { data: activities = [] } = useActivities(booking?.tour_id || '');
  const { data: hotels = [] } = useHotels(booking?.tour_id || '');
  const { data: comments = [] } = useBookingComments(booking?.id || '');
  const { data: auditLog = [] } = useBookingAuditLog(booking?.id);
  const { data: tours = [] } = useTours();
  
  const tour = tours.find(t => t.id === booking?.tour_id);

  const handleDelete = () => {
    if (!booking) return;
    deleteBooking.mutate(booking.id, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Booking deleted successfully",
        });
        setShowDeleteDialog(false);
        goBack("/?tab=bookings");
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to delete booking",
          variant: "destructive",
        });
        setShowDeleteDialog(false);
      },
    });
  };

  const handleRemoveSecondaryContact = () => {
    if (!booking) return;
    updateBooking.mutate(
      { id: booking.id, secondary_contact_id: null },
      {
        onSuccess: () => {
          toast({
            title: "Secondary Contact Removed",
            description: "The secondary contact has been removed from this booking.",
          });
          setShowRemoveSecondaryContactDialog(false);
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Failed to remove secondary contact",
            variant: "destructive",
          });
          setShowRemoveSecondaryContactDialog(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Booking Not Found</h1>
          <Button onClick={() => goBack("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      invoiced: 'bg-blue-100 text-blue-800',
      deposited: 'bg-purple-100 text-purple-800',
      instalment_paid: 'bg-indigo-100 text-indigo-800',
      fully_paid: 'bg-green-100 text-green-800',
      complimentary: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      waitlisted: 'bg-orange-100 text-orange-800',
      host: 'bg-pink-100 text-pink-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const leadPassengerName = booking.customers
    ? `${booking.customers.first_name} ${booking.customers.last_name}`
    : 'No lead passenger';

  const secondaryContactName = booking.secondary_contact
    ? `${booking.secondary_contact.first_name} ${booking.secondary_contact.last_name}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <AppBreadcrumbs
          items={[
            { label: "Bookings", href: "/?tab=bookings" },
            ...(tour && currentState?.from?.includes(`/tours/${tour.id}`) 
              ? [{ label: tour.name, href: getReturnPath(`/tours/${tour.id}`) }] 
              : tour 
                ? [{ label: tour.name, href: `/tours/${tour.id}` }] 
                : []
            ),
            { label: leadPassengerName }
          ]}
        />
        
        {/* Mobile action buttons */}
        <div className="flex flex-wrap gap-2 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goBack(tour ? `/tours/${tour.id}` : "/?tab=bookings")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <WhatsAppButton 
            phone={booking.customers?.phone} 
            name={booking.customers?.first_name}
          />
          
          {!isAgent && booking.customers && (
            <>
              <SendProfileUpdateButton
                customerId={booking.customers.id}
                customerName={`${booking.customers.first_name} ${booking.customers.last_name}`}
                customerEmail={booking.customers.email || null}
                bookingId={booking.id}
                size="sm"
              />
              <SendTravelDocsRequestButton
                bookingId={booking.id}
                customerName={`${booking.customers.first_name} ${booking.customers.last_name}`}
                customerEmail={booking.customers.email || null}
                tourName={tour?.name || 'Unknown Tour'}
                travelDocsRequired={tour?.travel_documents_required || false}
                size="sm"
              />
              <SendWaiverRequestButton
                bookingId={booking.id}
                customerName={`${booking.customers.first_name} ${booking.customers.last_name}`}
                customerEmail={booking.customers.email || null}
                tourName={tour?.name || 'Unknown Tour'}
                size="sm"
              />
            </>
          )}
          
          {!isAgent && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWithContext(`/bookings/${id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailPreview(true)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
            {booking.customers && (
              <ContactAvatar
                contactId={booking.customers.id}
                avatarUrl={booking.customers.avatar_url || null}
                firstName={booking.customers.first_name}
                lastName={booking.customers.last_name}
                editable={false}
                size="lg"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{leadPassengerName}</h1>
              {tour && (
                <p className="text-muted-foreground mt-1 text-sm sm:text-base truncate">
                  {tour.name}
                </p>
              )}
            </div>
        </div>
          
        {/* Desktop action buttons */}
        <div className="hidden sm:flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goBack(tour ? `/tours/${tour.id}` : "/?tab=bookings")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <WhatsAppButton 
              phone={booking.customers?.phone} 
              name={booking.customers?.first_name}
            />
            
            {!isAgent && booking.customers && (
              <>
                <SendProfileUpdateButton
                  customerId={booking.customers.id}
                  customerName={`${booking.customers.first_name} ${booking.customers.last_name}`}
                  customerEmail={booking.customers.email || null}
                  bookingId={booking.id}
                />
                <SendTravelDocsRequestButton
                  bookingId={booking.id}
                  customerName={`${booking.customers.first_name} ${booking.customers.last_name}`}
                  customerEmail={booking.customers.email || null}
                  tourName={tour?.name || 'Unknown Tour'}
                  travelDocsRequired={tour?.travel_documents_required || false}
                />
                <SendWaiverRequestButton
                  bookingId={booking.id}
                  customerName={`${booking.customers.first_name} ${booking.customers.last_name}`}
                  customerEmail={booking.customers.email || null}
                  tourName={tour?.name || 'Unknown Tour'}
                />
              </>
            )}
            
            {!isAgent && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWithContext(`/bookings/${id}/edit`)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailPreview(true)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-1 h-auto p-1">
            <TabsTrigger value="details" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
              {!isMobile && <FileText className="h-4 w-4" />}
              <span>Details</span>
            </TabsTrigger>
            <TabsTrigger value="hotels" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
              {!isMobile && <Hotel className="h-4 w-4" />}
              <span>Hotels</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
              {!isMobile && <MapPin className="h-4 w-4" />}
              <span>Activities</span>
            </TabsTrigger>
            <TabsTrigger value="medical" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
              {!isMobile && <Heart className="h-4 w-4" />}
              <span>Medical</span>
            </TabsTrigger>
            {tour?.travel_documents_required && (
              <TabsTrigger value="travel" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
                {!isMobile && <Plane className="h-4 w-4" />}
                <span>Passport Details</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="waiver" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
              {!isMobile && <Shield className="h-4 w-4" />}
              <span>Waiver</span>
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
              {!isMobile && <MessageSquare className="h-4 w-4" />}
              <span>History ({comments.length + auditLog.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-6">
            <div className="bg-card rounded-lg border p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Booking Information</h3>
                <Badge className={getStatusColor(booking.status)}>
                  {booking.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow label="Lead Passenger" value={leadPassengerName} />
                <InfoRow label="Preferred Name" value={booking.customers?.preferred_name} />
                <InfoRow label="Email" value={booking.customers?.email} />
                <InfoRow label="Phone" value={booking.customers?.phone} />
                <InfoRow label="Dietary Requirements" value={booking.customers?.dietary_requirements} />
                {/* Secondary Contact with View/Remove */}
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Secondary Contact</span>
                  {booking.secondary_contact ? (
                    <div className="flex items-center gap-2">
                      <Link 
                        to={`/contacts/${booking.secondary_contact.id}`}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {secondaryContactName}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {!isAgent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setShowRemoveSecondaryContactDialog(true)}
                          title="Remove secondary contact"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm">—</span>
                  )}
                </div>
                <InfoRow label="Passenger Count" value={booking.passenger_count?.toString()} />
                <InfoRow label="Group Name" value={booking.group_name} />
                <InfoRow label="Booking Agent" value={booking.booking_agent} />
              </div>

              {/* Passenger Details with Expandable Sections */}
              {(booking.passenger_2_name || (booking as any).passenger_2 || booking.passenger_3_name || (booking as any).passenger_3) && (
                <div className="pt-4 border-t space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Additional Passengers</h4>
                  <PassengerDetailsSection
                    passenger={(booking as any).passenger_2}
                    passengerNumber={2}
                    fallbackName={booking.passenger_2_name}
                    bookingId={booking.id}
                    isAgent={isAgent}
                  />
                  <PassengerDetailsSection
                    passenger={(booking as any).passenger_3}
                    passengerNumber={3}
                    fallbackName={booking.passenger_3_name}
                    bookingId={booking.id}
                    isAgent={isAgent}
                  />
                </div>
              )}

              {booking.extra_requests && (
                <div className="pt-4 border-t">
                  <InfoRow label="Extra Requests" value={booking.extra_requests} />
                </div>
              )}

              {booking.invoice_notes && (
                <div className="pt-4 border-t">
                  <InfoRow label="Invoice Notes" value={booking.invoice_notes} />
                </div>
              )}
            </div>

            {/* Accommodation Info */}
            {booking.accommodation_required && (
              <div className="bg-card rounded-lg border p-6 space-y-4">
                <h3 className="text-lg font-semibold">Accommodation Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="Check-in" value={booking.check_in_date ? formatDateToDDMMYYYY(booking.check_in_date) : null} />
                  <InfoRow label="Check-out" value={booking.check_out_date ? formatDateToDDMMYYYY(booking.check_out_date) : null} />
                  <InfoRow label="Total Nights" value={booking.total_nights?.toString()} />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="hotels" className="space-y-4 mt-6">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">Hotel Allocations</h3>
              {hotelBookings.length === 0 ? (
                <p className="text-muted-foreground">No hotel allocations yet</p>
              ) : (
                <div className="space-y-4">
                  {hotelBookings.map((hb: any) => {
                    const hotel = hotels.find(h => h.id === hb.hotel_id);
                    return (
                      <div key={hb.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{hotel?.name || 'Unknown Hotel'}</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InfoRow label="Check-in" value={hb.check_in_date ? formatDateToDDMMYYYY(hb.check_in_date) : null} />
                          <InfoRow label="Check-out" value={hb.check_out_date ? formatDateToDDMMYYYY(hb.check_out_date) : null} />
                          <InfoRow label="Nights" value={hb.nights?.toString()} />
                          <InfoRow label="Room Type" value={hb.room_type} />
                          <InfoRow label="Bedding" value={hb.bedding} />
                          <InfoRow label="Room Upgrade" value={hb.room_upgrade} />
                          <InfoRow label="Confirmation Number" value={hb.confirmation_number} />
                          <InfoRow label="Allocated" value={hb.allocated ? 'Yes' : 'No'} />
                        </div>
                        {hb.room_requests && (
                          <div className="mt-3 pt-3 border-t">
                            <InfoRow label="Room Requests" value={hb.room_requests} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activities" className="space-y-4 mt-6">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">Activity Allocations</h3>
              {activityBookings.length === 0 ? (
                <p className="text-muted-foreground">No activity allocations yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-sm">Activity</th>
                        <th className="text-left py-3 px-4 font-medium text-sm">Passengers Attending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityBookings.map((ab: any) => {
                        const activity = activities.find(a => a.id === ab.activity_id);
                        return (
                          <tr key={ab.id} className="border-b last:border-b-0">
                            <td className="py-3 px-4 text-sm">{activity?.name || 'Unknown Activity'}</td>
                            <td className="py-3 px-4 text-sm">{ab.passengers_attending}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="medical" className="space-y-4 mt-6">
            <div className="bg-card rounded-lg border p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Medical & Dietary Information</h3>
                <p className="text-sm text-muted-foreground mb-4">This information is linked to the contact profile and applies to all bookings.</p>
                <div className="space-y-4">
                  <InfoRow label="Dietary Requirements" value={booking.customers?.dietary_requirements} />
                  <InfoRow label="Medical Conditions" value={booking.customers?.medical_conditions} />
                  <InfoRow label="Accessibility Needs" value={booking.customers?.accessibility_needs} />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InfoRow label="Name" value={booking.customers?.emergency_contact_name} />
                  <InfoRow label="Phone" value={booking.customers?.emergency_contact_phone} />
                  <InfoRow label="Relationship" value={booking.customers?.emergency_contact_relationship} />
                </div>
              </div>
            </div>
          </TabsContent>

          {tour?.travel_documents_required && (
            <TabsContent value="travel" className="space-y-4 mt-6">
              <div className="bg-card rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Passport Details</h3>
                <BookingTravelDocsDisplay
                  bookingId={booking.id}
                  passengerCount={booking.passenger_count}
                  leadPassenger={booking.customers}
                  passenger2={(booking as any).passenger_2}
                  passenger3={(booking as any).passenger_3}
                />
              </div>
            </TabsContent>
          )}

          <TabsContent value="waiver" className="space-y-4 mt-6">
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Waiver Status</h3>
                {!isAgent && booking.customers && (
                  <SendWaiverRequestButton
                    bookingId={booking.id}
                    customerName={`${booking.customers.first_name} ${booking.customers.last_name}`}
                    customerEmail={booking.customers.email || null}
                    tourName={tour?.name || 'Unknown Tour'}
                  />
                )}
              </div>
              <WaiverStatusDisplay
                bookingId={booking.id}
                passengerCount={booking.passenger_count}
                leadPassenger={booking.customers}
                passenger2={(booking as any).passenger_2}
                passenger3={(booking as any).passenger_3}
              />
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-6 mt-6">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">Audit Trail</h3>
              <BookingAuditTrail entries={auditLog} />
            </div>
            
            <Separator />
            
            <div className="bg-card rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">Comments</h3>
              <BookingCommentsSection bookingId={booking.id} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Modals */}        
        {showEmailPreview && (
          <EmailPreviewModal
            open={showEmailPreview}
            onOpenChange={setShowEmailPreview}
            bookingId={booking.id}
          />
        )}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the booking for {leadPassengerName}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showRemoveSecondaryContactDialog} onOpenChange={setShowRemoveSecondaryContactDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Secondary Contact?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove {secondaryContactName} as the secondary contact from this booking. They will no longer be CC'd on emails sent to the lead passenger.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveSecondaryContact}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
