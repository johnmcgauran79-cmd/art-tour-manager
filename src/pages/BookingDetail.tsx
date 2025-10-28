import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Hotel, MapPin, Heart, FileText, MessageSquare, Mail, ArrowLeft } from "lucide-react";
import { EmailPreviewModal } from "@/components/EmailPreviewModal";
import { useBookings, useDeleteBooking } from "@/hooks/useBookings";
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

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className="text-sm">{value || "—"}</span>
  </div>
);

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: allBookings, isLoading } = useBookings();
  const booking = allBookings?.find(b => b.id === id);
  
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [currentTab, setCurrentTab] = useState("details");
  const deleteBooking = useDeleteBooking();
  const isMobile = useIsMobile();

  const { data: hotelBookings = [] } = useHotelBookings(booking?.id || '');
  const { data: activityBookings = [] } = useActivityBookings(booking?.id || '');
  const { data: activities = [] } = useActivities(booking?.tour_id || '');
  const { data: hotels = [] } = useHotels(booking?.tour_id || '');
  const { data: comments = [] } = useBookingComments(booking?.id || '');
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
        navigate("/");
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to delete booking",
          variant: "destructive",
        });
      },
    });
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
          <Button onClick={() => navigate("/")}>
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
            ...(tour ? [{ label: tour.name, href: `/tours/${tour.id}` }] : []),
            { label: leadPassengerName }
          ]}
        />
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{leadPassengerName}</h1>
            {tour && (
              <p className="text-muted-foreground mt-1">
                {tour.name}
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(tour ? `/tours/${tour.id}` : "/?tab=bookings")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/bookings/${id}/edit`)}
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
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList>
            <TabsTrigger value="details">
              <FileText className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="hotels">
              <Hotel className="h-4 w-4 mr-2" />
              Hotels
            </TabsTrigger>
            <TabsTrigger value="activities">
              <MapPin className="h-4 w-4 mr-2" />
              Activities
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments ({comments.length})
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
                <InfoRow label="Email" value={booking.customers?.email} />
                <InfoRow label="Phone" value={booking.customers?.phone} />
                <InfoRow label="Secondary Contact" value={secondaryContactName} />
                <InfoRow label="Passenger Count" value={booking.passenger_count?.toString()} />
                <InfoRow label="Passenger 2" value={booking.passenger_2_name} />
                <InfoRow label="Passenger 3" value={booking.passenger_3_name} />
                <InfoRow label="Group Name" value={booking.group_name} />
                <InfoRow label="Booking Agent" value={booking.booking_agent} />
              </div>

              {booking.extra_requests && (
                <div className="pt-4 border-t">
                  <InfoRow label="Extra Requests" value={booking.extra_requests} />
                </div>
              )}

              {booking.dietary_restrictions && (
                <div className="pt-4 border-t">
                  <InfoRow label="Dietary Restrictions" value={booking.dietary_restrictions} />
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

            {/* Emergency & Travel Info */}
            {(booking.emergency_contact_name || booking.passport_number) && (
              <div className="bg-card rounded-lg border p-6 space-y-4">
                <h3 className="text-lg font-semibold">Emergency & Travel Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="Emergency Contact" value={booking.emergency_contact_name} />
                  <InfoRow label="Emergency Phone" value={booking.emergency_contact_phone} />
                  <InfoRow label="Relationship" value={booking.emergency_contact_relationship} />
                  <InfoRow label="Passport Number" value={booking.passport_number} />
                  <InfoRow label="Passport Expiry" value={booking.passport_expiry_date ? formatDateToDDMMYYYY(booking.passport_expiry_date) : null} />
                  <InfoRow label="Passport Country" value={booking.passport_country} />
                  <InfoRow label="ID Number" value={booking.id_number} />
                  <InfoRow label="Nationality" value={booking.nationality} />
                </div>
              </div>
            )}

            {/* Medical Info */}
            {(booking.medical_conditions || booking.accessibility_needs) && (
              <div className="bg-card rounded-lg border p-6 space-y-4">
                <h3 className="text-lg font-semibold">Medical & Accessibility</h3>
                <div className="space-y-2">
                  <InfoRow label="Medical Conditions" value={booking.medical_conditions} />
                  <InfoRow label="Accessibility Needs" value={booking.accessibility_needs} />
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
                <div className="space-y-2">
                  {hotelBookings.map((hb: any) => {
                    const hotel = hotels.find(h => h.id === hb.hotel_id);
                    return (
                      <div key={hb.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{hotel?.name || 'Unknown Hotel'}</p>
                          <p className="text-sm text-muted-foreground">
                            {hb.room_type} • {hb.nights} night(s)
                          </p>
                        </div>
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
                <div className="space-y-2">
                  {activityBookings.map((ab: any) => {
                    const activity = activities.find(a => a.id === ab.activity_id);
                    return (
                      <div key={ab.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{activity?.name || 'Unknown Activity'}</p>
                          <p className="text-sm text-muted-foreground">
                            {ab.status}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4 mt-6">
            <BookingCommentsSection bookingId={booking.id} />
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
      </div>
    );
  }
