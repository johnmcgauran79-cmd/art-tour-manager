import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Shield, FileText, Heart, MessageSquare, Hotel, MapPin, Info, UserPlus, ArrowLeft, Save } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBookings, useUpdateBooking } from "@/hooks/useBookings";
import { useCancelBooking } from "@/hooks/useCancelBooking";
import { useUpdateCustomer } from "@/hooks/useCustomers";
import { HotelAllocationSection } from "@/components/HotelAllocationSection";
import { ActivityAllocationSection } from "@/components/ActivityAllocationSection";
import { CancelBookingDialog } from "@/components/CancelBookingDialog";
import { EditContactModal } from "@/components/EditContactModal";
import { AddContactModal } from "@/components/AddContactModal";
import { BookingCommentsSection } from "@/components/BookingCommentsSection";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContactSearch } from "@/components/booking/ContactSearch";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useTours } from "@/hooks/useTours";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function BookingEdit() {
  const { id } = useParams();
  const { goBack, navigateWithContext } = useNavigationContext();
  const { toast } = useToast();
  const { data: allBookings, isLoading } = useBookings();
  const booking = allBookings?.find(b => b.id === id);
  const { data: tours = [] } = useTours();
  const tour = tours.find(t => t.id === booking?.tour_id);
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState({
    lead_passenger_first_name: '',
    lead_passenger_last_name: '',
    lead_passenger_email: '',
    lead_passenger_phone: '',
    lead_passenger_dietary_requirements: '',
    lead_passenger_medical_conditions: '',
    lead_passenger_accessibility_needs: '',
    lead_passenger_emergency_contact_name: '',
    lead_passenger_emergency_contact_phone: '',
    lead_passenger_emergency_contact_relationship: '',
    passenger_count: 1,
    passenger_2_name: '',
    passenger_3_name: '',
    group_name: '',
    booking_agent: '',
    status: 'pending' as 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host' | 'racing_breaks_invoice',
    extra_requests: '',
    invoice_notes: '',
    accommodation_required: true,
    check_in_date: '',
    check_out_date: '',
    secondary_contact_id: '',
    
    passport_number: '',
    passport_expiry_date: '',
    passport_country: '',
    id_number: '',
    nationality: '',
  });

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [selectedSecondaryContact, setSelectedSecondaryContact] = useState<any>(null);
  const [secondaryContactName, setSecondaryContactName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showNoHotelsWarning, setShowNoHotelsWarning] = useState(false);

  const updateBooking = useUpdateBooking();
  const cancelBooking = useCancelBooking();
  const updateCustomer = useUpdateCustomer();

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (booking) {
      setFormData({
        lead_passenger_first_name: booking.customers?.first_name || '',
        lead_passenger_last_name: booking.customers?.last_name || '',
        lead_passenger_email: booking.customers?.email || '',
        lead_passenger_phone: booking.customers?.phone || '',
        lead_passenger_dietary_requirements: booking.customers?.dietary_requirements || '',
        lead_passenger_medical_conditions: booking.customers?.medical_conditions || '',
        lead_passenger_accessibility_needs: booking.customers?.accessibility_needs || '',
        lead_passenger_emergency_contact_name: booking.customers?.emergency_contact_name || '',
        lead_passenger_emergency_contact_phone: booking.customers?.emergency_contact_phone || '',
        lead_passenger_emergency_contact_relationship: booking.customers?.emergency_contact_relationship || '',
        passenger_count: booking.passenger_count,
        passenger_2_name: booking.passenger_2_name || '',
        passenger_3_name: booking.passenger_3_name || '',
        group_name: booking.group_name || '',
        booking_agent: booking.booking_agent || '',
        status: booking.status,
        extra_requests: booking.extra_requests || '',
        invoice_notes: booking.invoice_notes || '',
        accommodation_required: booking.accommodation_required || false,
        check_in_date: booking.check_in_date || '',
        check_out_date: booking.check_out_date || '',
        secondary_contact_id: booking.secondary_contact_id || '',
        
        passport_number: booking.passport_number || '',
        passport_expiry_date: booking.passport_expiry_date || '',
        passport_country: booking.passport_country || '',
        id_number: booking.id_number || '',
        nationality: booking.nationality || '',
      });

      if (booking.secondary_contact) {
        setSelectedSecondaryContact(booking.secondary_contact);
        setSecondaryContactName(`${booking.secondary_contact.first_name} ${booking.secondary_contact.last_name}`);
      }
    }
  }, [booking]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!booking) return;

    // Validate second passenger name when passenger count is 2 or more
    if (formData.passenger_count >= 2) {
      if (!formData.passenger_2_name || formData.passenger_2_name.trim() === '') {
        setValidationError("Second passenger name is required when booking for 2 or more passengers. Please add the second passenger's name in the Details tab.");
        return;
      }
    }

    // Validate bedding types match passenger count for allocated hotels
    if (formData.accommodation_required) {
      // Fetch current hotel bookings for this booking
      const { data: hotelBookings, error } = await supabase
        .from('hotel_bookings')
        .select('*')
        .eq('booking_id', booking.id)
        .eq('allocated', true);

      if (error) {
        console.error('Error fetching hotel bookings:', error);
      } else {
        // Check if tour has hotels
        const { data: tourHotels } = await supabase
          .from('hotels')
          .select('*')
          .eq('tour_id', booking.tour_id);

        // Check if we're activating a waitlisted booking without allocated hotels
        const isActivatingBooking = booking.status === 'waitlisted' && formData.status !== 'waitlisted' && formData.status !== 'cancelled';
        const needsHotelAllocation = tourHotels && tourHotels.length > 0 && (!hotelBookings || hotelBookings.length === 0);

        if (needsHotelAllocation) {
          if (isActivatingBooking) {
            // Auto-allocate hotels for activating waitlisted bookings
            console.log('Auto-allocating hotels for activated waitlisted booking');
            for (const hotel of tourHotels) {
              const { error: insertError } = await supabase
                .from('hotel_bookings')
                .insert({
                  booking_id: booking.id,
                  hotel_id: hotel.id,
                  allocated: true,
                  check_in_date: hotel.default_check_in || tour?.start_date,
                  check_out_date: hotel.default_check_out || tour?.end_date,
                  bedding: formData.passenger_count === 1 ? 'single' : 'double',
                  room_type: hotel.default_room_type,
                  required: true,
                });
              if (insertError) {
                console.error('Error auto-allocating hotel:', insertError);
              }
            }
            // Proceed with update after auto-allocation
            performUpdate();
            return;
          } else {
            setValidationError("Hotel must be allocated if accommodation is required for this booking. Please allocate at least one hotel in the Hotels tab.");
            return;
          }
        }

        // Check if tour has no hotels loaded at all - still allow saving but show warning
        if (!tourHotels || tourHotels.length === 0) {
          // Allow save to proceed - the recalculateBookingDates function will fall back to tour dates
          console.log('No hotels on tour - will use tour dates for check-in/check-out');
        }

        if (hotelBookings && hotelBookings.length > 0) {
          if (formData.passenger_count === 1) {
            const invalidBedding = hotelBookings.find(hb => hb.bedding !== 'single');
            if (invalidBedding) {
              setValidationError("Single passenger bookings can only have Single bedding. Please update the Hotels tab before saving changes.");
              return;
            }
          } else if (formData.passenger_count >= 2) {
            const singleBedding = hotelBookings.find(hb => hb.bedding === 'single');
            if (singleBedding) {
              setValidationError(`You have ${formData.passenger_count} passengers but Single bedding selected. Please update to Double, Twin, Triple, or Family in the Hotels tab before saving changes.`);
              return;
            }
          }
        }
      }
    }

    // Proceed with the actual update
    performUpdate();
  };

  const performUpdate = () => {
    if (!booking) return;

    // Check if any customer fields have changed
    if (booking.customers?.id) {
      const customerUpdates: Record<string, string | null> = {};
      
      if (formData.lead_passenger_dietary_requirements !== (booking.customers?.dietary_requirements || '')) {
        customerUpdates.dietary_requirements = formData.lead_passenger_dietary_requirements || null;
      }
      if (formData.lead_passenger_medical_conditions !== (booking.customers?.medical_conditions || '')) {
        customerUpdates.medical_conditions = formData.lead_passenger_medical_conditions || null;
      }
      if (formData.lead_passenger_accessibility_needs !== (booking.customers?.accessibility_needs || '')) {
        customerUpdates.accessibility_needs = formData.lead_passenger_accessibility_needs || null;
      }
      if (formData.lead_passenger_emergency_contact_name !== (booking.customers?.emergency_contact_name || '')) {
        customerUpdates.emergency_contact_name = formData.lead_passenger_emergency_contact_name || null;
      }
      if (formData.lead_passenger_emergency_contact_phone !== (booking.customers?.emergency_contact_phone || '')) {
        customerUpdates.emergency_contact_phone = formData.lead_passenger_emergency_contact_phone || null;
      }
      if (formData.lead_passenger_emergency_contact_relationship !== (booking.customers?.emergency_contact_relationship || '')) {
        customerUpdates.emergency_contact_relationship = formData.lead_passenger_emergency_contact_relationship || null;
      }

      if (Object.keys(customerUpdates).length > 0) {
        updateCustomer.mutate({
          id: booking.customers.id,
          ...customerUpdates
        });
      }
    }

    updateBooking.mutate({
      id: booking.id,
      passenger_count: formData.passenger_count,
      passenger_2_name: formData.passenger_2_name,
      passenger_3_name: formData.passenger_3_name,
      group_name: formData.group_name,
      booking_agent: formData.booking_agent,
      status: formData.status,
      extra_requests: formData.extra_requests,
      invoice_notes: formData.invoice_notes,
      accommodation_required: formData.accommodation_required,
      check_in_date: formData.check_in_date,
      check_out_date: formData.check_out_date,
      secondary_contact_id: formData.secondary_contact_id || null,
      passport_number: formData.passport_number || null,
      passport_expiry_date: formData.passport_expiry_date || null,
      passport_country: formData.passport_country || null,
      id_number: formData.id_number || null,
      nationality: formData.nationality || null,
    }, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Booking updated successfully",
        });
        goBack(`/bookings/${booking.id}`);
      }
    });
  };

  const handleStatusChange = (newStatus: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host' | 'racing_breaks_invoice') => {
    if (newStatus === 'cancelled' && booking?.status !== 'cancelled') {
      setShowCancelDialog(true);
    } else {
      setFormData(prev => ({ ...prev, status: newStatus }));
    }
  };

  const handleCancelConfirm = (reason: string) => {
    if (!booking) return;
    
    cancelBooking.mutate({
      bookingId: booking.id,
      cancellationReason: reason
    }, {
      onSuccess: () => {
        setShowCancelDialog(false);
        goBack(`/bookings/${booking.id}`);
      }
    });
  };

  const handleEditContact = () => {
    if (!booking?.customers) return;
    
    const contact = {
      id: booking.lead_passenger_id,
      first_name: formData.lead_passenger_first_name,
      last_name: formData.lead_passenger_last_name,
      email: formData.lead_passenger_email,
      phone: formData.lead_passenger_phone,
      dietary_requirements: formData.lead_passenger_dietary_requirements,
    };
    setContactToEdit(contact);
    setShowEditContact(true);
  };

  const handleContactUpdated = (updatedContact: any) => {
    setFormData(prev => ({
      ...prev,
      lead_passenger_first_name: updatedContact.first_name,
      lead_passenger_last_name: updatedContact.last_name,
      lead_passenger_email: updatedContact.email,
      lead_passenger_phone: updatedContact.phone || '',
      lead_passenger_dietary_requirements: updatedContact.dietary_requirements || '',
    }));
  };

  const handleSecondaryContactSelect = (contact: any) => {
    setSelectedSecondaryContact(contact);
    setSecondaryContactName(`${contact.first_name} ${contact.last_name}`);
    setFormData(prev => ({ ...prev, secondary_contact_id: contact.id }));
  };

  const handleContactCreated = (newContact: any) => {
    setSelectedSecondaryContact(newContact);
    setSecondaryContactName(`${newContact.first_name} ${newContact.last_name}`);
    setFormData(prev => ({ ...prev, secondary_contact_id: newContact.id }));
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

  const leadPassengerName = booking.customers
    ? `${booking.customers.first_name} ${booking.customers.last_name}`
    : 'No lead passenger';

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <AppBreadcrumbs
          items={[
            { label: "Bookings", href: "/?tab=bookings" },
            ...(tour ? [{ label: tour.name, href: `/tours/${tour.id}` }] : []),
            { label: leadPassengerName, href: `/bookings/${booking.id}` },
            { label: "Edit" }
          ]}
        />
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Edit Booking - {leadPassengerName}</h1>
            {formData.status === 'waitlisted' && (
              <Badge className="bg-orange-100 text-orange-800">WAITLISTED</Badge>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goBack(`/bookings/${booking.id}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSubmit}
              disabled={updateBooking.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateBooking.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1 h-auto p-1">
          <TabsTrigger value="details" className="text-xs md:text-sm px-2 py-2">Details</TabsTrigger>
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
          <TabsTrigger value="travel" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
            {!isMobile && <FileText className="h-4 w-4" />}
            <span>Travel</span>
          </TabsTrigger>
          <TabsTrigger value="communication" className="flex items-center gap-1 text-xs md:text-sm px-2 py-2">
            {!isMobile && <MessageSquare className="h-4 w-4" />}
            <span>Comments</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {formData.status === 'waitlisted' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This booking is currently waitlisted. Change the status to confirm the booking when spots become available.
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-card border rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Lead Passenger Details</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEditContact}
                  disabled={!booking?.lead_passenger_id}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Contact
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lead_passenger_first_name">Lead Passenger First Name</Label>
                  <Input
                    id="lead_passenger_first_name"
                    value={formData.lead_passenger_first_name}
                    disabled
                    className="bg-muted"
                    title="Customer details are managed separately in the Contacts section"
                  />
                </div>
                <div>
                  <Label htmlFor="lead_passenger_last_name">Lead Passenger Last Name</Label>
                  <Input
                    id="lead_passenger_last_name"
                    value={formData.lead_passenger_last_name}
                    disabled
                    className="bg-muted"
                    title="Customer details are managed separately in the Contacts section"
                  />
                </div>
                <div>
                  <Label htmlFor="lead_passenger_email">Lead Passenger Email</Label>
                  <Input
                    id="lead_passenger_email"
                    type="email"
                    value={formData.lead_passenger_email}
                    disabled
                    className="bg-muted"
                    title="Customer details are managed separately in the Contacts section"
                  />
                </div>
                <div>
                  <Label htmlFor="lead_passenger_phone">Lead Passenger Phone</Label>
                  <Input
                    id="lead_passenger_phone"
                    type="tel"
                    value={formData.lead_passenger_phone}
                    disabled
                    className="bg-muted"
                    title="Customer details are managed separately in the Contacts section"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="lead_passenger_dietary_requirements">Dietary Requirements</Label>
                <Textarea
                  id="lead_passenger_dietary_requirements"
                  value={formData.lead_passenger_dietary_requirements}
                  onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_dietary_requirements: e.target.value }))}
                  placeholder="Enter dietary requirements..."
                  rows={3}
                />
              </div>
            </div>

            <div className="bg-card border rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">Secondary Contact (Optional)</h3>
                  <p className="text-sm text-muted-foreground">Add another contact who will receive booking communications</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddContact(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add New Contact
                </Button>
              </div>

              <ContactSearch
                value={secondaryContactName}
                onValueChange={setSecondaryContactName}
                onContactSelect={handleSecondaryContactSelect}
                selectedContactId={selectedSecondaryContact?.id || ''}
                placeholder="Search for secondary contact..."
                required={false}
              />
              
              {selectedSecondaryContact && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium">
                    {selectedSecondaryContact.first_name} {selectedSecondaryContact.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedSecondaryContact.email}</p>
                  {selectedSecondaryContact.phone && (
                    <p className="text-sm text-muted-foreground">{selectedSecondaryContact.phone}</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-card border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-medium">Booking Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="passenger_count">Passenger Count</Label>
                  <Input
                    id="passenger_count"
                    type="number"
                    min="1"
                    value={formData.passenger_count}
                    onChange={(e) => {
                      const value = Math.max(1, Number(e.target.value) || 1);
                      setFormData(prev => ({ ...prev, passenger_count: value }));
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                      <SelectItem value="deposited">Deposited</SelectItem>
                      <SelectItem value="instalment_paid">Instalment Paid</SelectItem>
                      <SelectItem value="fully_paid">Fully Paid</SelectItem>
                      <SelectItem value="waitlisted">Waitlisted</SelectItem>
                      <SelectItem value="host">Host</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="racing_breaks_invoice">RB Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="passenger_2_name">Passenger 2 Name</Label>
                  <Input
                    id="passenger_2_name"
                    value={formData.passenger_2_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, passenger_2_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="passenger_3_name">Passenger 3 Name</Label>
                  <Input
                    id="passenger_3_name"
                    value={formData.passenger_3_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, passenger_3_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="group_name">Group Name</Label>
                  <Input
                    id="group_name"
                    value={formData.group_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, group_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="booking_agent">Booking Agent</Label>
                  <Input
                    id="booking_agent"
                    value={formData.booking_agent}
                    onChange={(e) => setFormData(prev => ({ ...prev, booking_agent: e.target.value }))}
                  />
                </div>
                {formData.accommodation_required && (
                  <>
                    <div>
                      <Label htmlFor="check_in_date">Check In Date (Auto-calculated)</Label>
                      <Input
                        id="check_in_date"
                        type="date"
                        value={formData.check_in_date}
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                        title="This date is automatically calculated from your hotel bookings"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically set from earliest hotel check-in
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="check_out_date">Check Out Date (Auto-calculated)</Label>
                      <Input
                        id="check_out_date"
                        type="date"
                        value={formData.check_out_date}
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                        title="This date is automatically calculated from your hotel bookings"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically set from latest hotel check-out
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="accommodation_required"
                  checked={formData.accommodation_required}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, accommodation_required: checked }))}
                />
                <Label htmlFor="accommodation_required">Accommodation Required</Label>
              </div>

              <div>
                <Label htmlFor="extra_requests">Extra Requests</Label>
                <Textarea
                  id="extra_requests"
                  value={formData.extra_requests}
                  onChange={(e) => setFormData(prev => ({ ...prev, extra_requests: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="invoice_notes">Invoice Notes</Label>
                <Textarea
                  id="invoice_notes"
                  value={formData.invoice_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoice_notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => goBack(`/bookings/${booking.id}`)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateBooking.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {updateBooking.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="hotels" className="space-y-4 mt-6">
          {booking && (
            <div className="space-y-4">
              <HotelAllocationSection
                tourId={booking.tour_id}
                bookingId={booking.id}
                accommodationRequired={formData.accommodation_required}
                defaultCheckIn={formData.check_in_date}
                defaultCheckOut={formData.check_out_date}
                onDatesChange={(checkIn, checkOut) => {
                  setFormData(prev => ({
                    ...prev,
                    check_in_date: checkIn,
                    check_out_date: checkOut,
                  }));
                }}
              />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => goBack(`/bookings/${booking.id}`)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleSubmit()}
                  disabled={updateBooking.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateBooking.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activities" className="space-y-4 mt-6">
          {booking && (
            <div className="space-y-4">
              <ActivityAllocationSection
                tourId={booking.tour_id}
                bookingId={booking.id}
                passengerCount={formData.passenger_count}
              />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => goBack(`/bookings/${booking.id}`)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleSubmit()}
                  disabled={updateBooking.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateBooking.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="medical" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 gap-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Medical and emergency contact information is stored on the contact profile and applies to all bookings for this passenger.
              </AlertDescription>
            </Alert>

            <div className="bg-card border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Medical & Dietary Information
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="dietary_requirements">Dietary Requirements</Label>
                  <Textarea
                    id="dietary_requirements"
                    value={formData.lead_passenger_dietary_requirements}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_dietary_requirements: e.target.value }))}
                    placeholder="e.g., Vegetarian, Gluten-free, No nuts..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="medical_conditions">Medical Conditions</Label>
                  <Textarea
                    id="medical_conditions"
                    value={formData.lead_passenger_medical_conditions}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_medical_conditions: e.target.value }))}
                    placeholder="Any medical conditions we should be aware of..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="accessibility_needs">Accessibility Needs</Label>
                  <Textarea
                    id="accessibility_needs"
                    value={formData.lead_passenger_accessibility_needs}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_accessibility_needs: e.target.value }))}
                    placeholder="Any mobility or accessibility requirements..."
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergency_contact_name">Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={formData.lead_passenger_emergency_contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_emergency_contact_name: e.target.value }))}
                    placeholder="Emergency contact name"
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_phone">Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={formData.lead_passenger_emergency_contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_emergency_contact_phone: e.target.value }))}
                    placeholder="Emergency contact phone"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                <Input
                  id="emergency_contact_relationship"
                  value={formData.lead_passenger_emergency_contact_relationship}
                  onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_emergency_contact_relationship: e.target.value }))}
                  placeholder="e.g., Spouse, Partner, Parent, Child..."
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => goBack(`/bookings/${booking.id}`)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleSubmit()}
              disabled={updateBooking.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateBooking.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="travel" className="space-y-4 mt-6">
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-medium">Travel Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="passport_number">Passport Number</Label>
                <Input
                  id="passport_number"
                  value={formData.passport_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, passport_number: e.target.value }))}
                  placeholder="Passport number"
                />
              </div>
              <div>
                <Label htmlFor="passport_expiry_date">Passport Expiry Date</Label>
                <Input
                  id="passport_expiry_date"
                  type="date"
                  value={formData.passport_expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, passport_expiry_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="passport_country">Passport Issuing Country</Label>
                <Input
                  id="passport_country"
                  value={formData.passport_country}
                  onChange={(e) => setFormData(prev => ({ ...prev, passport_country: e.target.value }))}
                  placeholder="Country"
                />
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                  placeholder="Nationality"
                />
              </div>
              <div>
                <Label htmlFor="id_number">National ID Number</Label>
                <Input
                  id="id_number"
                  value={formData.id_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value }))}
                  placeholder="National ID or driver's license"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => goBack(`/bookings/${booking.id}`)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleSubmit()}
              disabled={updateBooking.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateBooking.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="communication" className="space-y-4 mt-6">
          <BookingCommentsSection bookingId={booking.id} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CancelBookingDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleCancelConfirm}
        bookingId={booking.id}
      />
      
      {showEditContact && contactToEdit && (
        <EditContactModal
          contact={contactToEdit}
          open={showEditContact}
          onOpenChange={setShowEditContact}
          onContactUpdated={handleContactUpdated}
        />
      )}
      
      {showAddContact && (
        <AddContactModal
          open={showAddContact}
          onOpenChange={setShowAddContact}
          onContactCreated={handleContactCreated}
        />
      )}

      <AlertDialog open={!!validationError} onOpenChange={() => setValidationError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Validation Error</AlertDialogTitle>
            <AlertDialogDescription>
              {validationError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setValidationError(null)}>
              OK, I'll fix it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNoHotelsWarning} onOpenChange={() => setShowNoHotelsWarning(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Hotels Loaded</AlertDialogTitle>
            <AlertDialogDescription>
              This tour does not have any hotels loaded in the system yet. Please load hotels when ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowNoHotelsWarning(false);
              performUpdate();
            }}>
              OK, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
