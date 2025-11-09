import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Hotel, MapPin, Heart, FileText, MessageSquare, Mail } from "lucide-react";
import { EmailPreviewModal } from "@/components/EmailPreviewModal";
import { useDeleteBooking } from "@/hooks/useBookings";
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
import { useAuth } from "@/hooks/useAuth";

interface Booking {
  id: string;
  tour_id: string;
  lead_passenger_id: string | null;
  secondary_contact_id: string | null;
  passenger_count: number;
  passenger_2_name: string | null;
  passenger_3_name: string | null;
  group_name: string | null;
  booking_agent: string | null;
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host';
  extra_requests: string | null;
  invoice_notes: string | null;
  accommodation_required: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  total_nights: number | null;
  created_at: string;
  updated_at: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  passport_number: string | null;
  passport_expiry_date: string | null;
  passport_country: string | null;
  id_number: string | null;
  nationality: string | null;
  medical_conditions: string | null;
  accessibility_needs: string | null;
  dietary_restrictions: string | null;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    dietary_requirements?: string;
  };
  secondary_contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
}

interface BookingDetailModalProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className="text-sm">{value || "—"}</span>
  </div>
);

export const BookingDetailModal = ({ booking, open, onOpenChange, defaultTab = "details" }: BookingDetailModalProps) => {
  const navigate = useNavigate();
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [currentTab, setCurrentTab] = useState(defaultTab);
  const deleteBooking = useDeleteBooking();
  const isMobile = useIsMobile();
  const { userRole } = useAuth();

  // Fetch related data for read-only display
  const { data: hotelBookings = [] } = useHotelBookings(booking?.id || '');
  const { data: activityBookings = [] } = useActivityBookings(booking?.id || '');
  const { data: activities = [] } = useActivities(booking?.tour_id || '');
  const { data: hotels = [] } = useHotels(booking?.tour_id || '');
  const { data: comments = [] } = useBookingComments(booking?.id || '');
  const { data: tours = [] } = useTours();
  
  const tour = tours.find(t => t.id === booking?.tour_id);
  
  // Agent users have view-only access
  const isAgent = userRole === 'agent';

  const handleDelete = () => {
    if (!booking) return;
    if (confirm('Are you sure you want to delete this booking?')) {
      deleteBooking.mutate(booking.id);
      onOpenChange(false);
    }
  };

  const handleEdit = () => {
    navigate(`/bookings/${booking?.id}/edit`);
    onOpenChange(false);
  };

  if (!booking) return null;

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    invoiced: "bg-blue-100 text-blue-800",
    deposited: "bg-purple-100 text-purple-800",
    instalment_paid: "bg-indigo-100 text-indigo-800",
    fully_paid: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    waitlisted: "bg-orange-100 text-orange-800",
    host: "bg-pink-100 text-pink-800",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="space-y-3">
              <AppBreadcrumbs
                items={[
                  { label: "Bookings" },
                  ...(tour ? [{ label: tour.name }] : []),
                  { label: `${booking.customers?.first_name} ${booking.customers?.last_name}` },
                ]}
              />
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                Booking Details - {booking.customers?.first_name} {booking.customers?.last_name}
                <Badge className={statusColors[booking.status]}>{booking.status.toUpperCase()}</Badge>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowEmailPreview(true)}
                  variant="outline"
                  size="sm"
                  disabled={!booking.customers?.email || isAgent}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button onClick={handleEdit} variant="outline" size="sm" disabled={isAgent}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Booking
                </Button>
                <Button onClick={handleDelete} variant="destructive" size="sm" disabled={isAgent}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Close</Button>
                </DialogClose>
              </div>
            </div>
            </div>
          </DialogHeader>

          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className={`w-full mb-4 ${isMobile ? 'h-auto grid grid-cols-3 gap-1' : 'grid grid-cols-6'}`}>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="hotels" className="flex items-center gap-1">
                <Hotel className="h-4 w-4" />
                Hotels
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Activities
              </TabsTrigger>
              <TabsTrigger value="medical" className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                Medical
              </TabsTrigger>
              <TabsTrigger value="travel" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Travel Docs
              </TabsTrigger>
              <TabsTrigger value="communication" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Comments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold">Lead Passenger</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="First Name" value={booking.customers?.first_name} />
                  <InfoRow label="Last Name" value={booking.customers?.last_name} />
                  <InfoRow label="Email" value={booking.customers?.email} />
                  <InfoRow label="Phone" value={booking.customers?.phone} />
                  <InfoRow label="Dietary Requirements" value={booking.customers?.dietary_requirements} />
                </div>
              </div>

              {booking.secondary_contact && (
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="text-lg font-semibold">Secondary Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow label="First Name" value={booking.secondary_contact.first_name} />
                    <InfoRow label="Last Name" value={booking.secondary_contact.last_name} />
                    <InfoRow label="Email" value={booking.secondary_contact.email} />
                    <InfoRow label="Phone" value={booking.secondary_contact.phone} />
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold">Booking Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="Passenger Count" value={booking.passenger_count.toString()} />
                  <InfoRow label="Status" value={booking.status} />
                  {booking.passenger_2_name && <InfoRow label="Passenger 2" value={booking.passenger_2_name} />}
                  {booking.passenger_3_name && <InfoRow label="Passenger 3" value={booking.passenger_3_name} />}
                  {booking.group_name && <InfoRow label="Group Name" value={booking.group_name} />}
                  {booking.booking_agent && <InfoRow label="Booking Agent" value={booking.booking_agent} />}
                </div>
                {booking.extra_requests && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Special Requests</h4>
                    <p className="text-sm whitespace-pre-wrap">{booking.extra_requests}</p>
                  </div>
                )}
                {booking.invoice_notes && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Invoice Notes</h4>
                    <p className="text-sm whitespace-pre-wrap">{booking.invoice_notes}</p>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold">Accommodation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="Accommodation Required" value={booking.accommodation_required ? "Yes" : "No"} />
                  {booking.accommodation_required && (
                    <>
                      <InfoRow label="Check-in Date" value={booking.check_in_date} />
                      <InfoRow label="Check-out Date" value={booking.check_out_date} />
                      <InfoRow label="Total Nights" value={booking.total_nights?.toString()} />
                    </>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hotels" className="space-y-4">
              {hotelBookings.length === 0 ? (
                <Alert>
                  <Hotel className="h-4 w-4" />
                  <AlertDescription>
                    No hotel allocations for this booking.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {hotelBookings.map((hotelBooking) => {
                    const hotel = hotels.find(h => h.id === hotelBooking.hotel_id);
                    return (
                      <div key={hotelBooking.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{hotel?.name || 'Hotel'}</h3>
                          {hotelBooking.allocated && (
                            <Badge className="bg-green-100 text-green-800">Allocated</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InfoRow label="Check-in" value={formatDateToDDMMYYYY(hotelBooking.check_in_date)} />
                          <InfoRow label="Check-out" value={formatDateToDDMMYYYY(hotelBooking.check_out_date)} />
                          <InfoRow label="Nights" value={hotelBooking.nights?.toString()} />
                          <InfoRow label="Bedding" value={hotelBooking.bedding} />
                          <InfoRow label="Room Type" value={hotelBooking.room_type} />
                          <InfoRow label="Room Upgrade" value={hotelBooking.room_upgrade} />
                          {hotelBooking.confirmation_number && (
                            <InfoRow label="Confirmation #" value={hotelBooking.confirmation_number} />
                          )}
                          {hotelBooking.room_requests && (
                            <div className="md:col-span-2">
                              <InfoRow label="Room Requests" value={hotelBooking.room_requests} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              {activityBookings.length === 0 ? (
                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertDescription>
                    No activity allocations for this booking.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {activityBookings.map((activityBooking) => {
                    const activity = activities.find(a => a.id === activityBooking.activity_id);
                    return (
                      <div key={activityBooking.id} className="border rounded-lg p-4 space-y-3">
                        <h3 className="text-lg font-semibold">{activity?.name || 'Activity'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InfoRow label="Date" value={formatDateToDDMMYYYY(activity?.activity_date)} />
                          <InfoRow label="Passengers Attending" value={activityBooking.passengers_attending.toString()} />
                          {activity?.start_time && <InfoRow label="Start Time" value={activity.start_time} />}
                          {activity?.location && <InfoRow label="Location" value={activity.location} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="medical" className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="Name" value={booking.emergency_contact_name} />
                  <InfoRow label="Phone" value={booking.emergency_contact_phone} />
                  <InfoRow label="Relationship" value={booking.emergency_contact_relationship} />
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold">Medical Information</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Medical Conditions</h4>
                    <p className="text-sm whitespace-pre-wrap">{booking.medical_conditions || "—"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Accessibility Needs</h4>
                    <p className="text-sm whitespace-pre-wrap">{booking.accessibility_needs || "—"}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="travel" className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold">Travel Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="Passport Number" value={booking.passport_number} />
                  <InfoRow label="Passport Expiry" value={booking.passport_expiry_date} />
                  <InfoRow label="Passport Country" value={booking.passport_country} />
                  <InfoRow label="ID Number" value={booking.id_number} />
                  <InfoRow label="Nationality" value={booking.nationality} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="communication" className="space-y-4">
              {comments.length === 0 ? (
                <Alert>
                  <MessageSquare className="h-4 w-4" />
                  <AlertDescription>
                    No comments for this booking yet.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={comment.is_internal ? "secondary" : "outline"}>
                            {comment.is_internal ? 'Internal' : 'Public'}
                          </Badge>
                          {comment.comment_type && comment.comment_type !== 'general' && (
                            <Badge variant="outline" className="capitalize">
                              {comment.comment_type}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                      {comment.profiles && (
                        <div className="text-xs text-muted-foreground">
                          By: {comment.profiles.first_name} {comment.profiles.last_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {booking && (
        <EmailPreviewModal
          open={showEmailPreview}
          onOpenChange={setShowEmailPreview}
          bookingId={booking.id}
        />
      )}
    </>
  );
};
