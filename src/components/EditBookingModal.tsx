
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Shield, FileText, Heart, MessageSquare } from "lucide-react";
import { useUpdateBooking, useDeleteBooking } from "@/hooks/useBookings";
import { useCancelBooking } from "@/hooks/useCancelBooking";
import { useUpdateCustomer } from "@/hooks/useCustomers";
import { HotelAllocationSection } from "@/components/HotelAllocationSection";
import { ActivityAllocationSection } from "@/components/ActivityAllocationSection";
import { CancelBookingDialog } from "@/components/CancelBookingDialog";
import { EditContactModal } from "@/components/EditContactModal";
import { BookingCommentsSection } from "@/components/BookingCommentsSection";

interface Booking {
  id: string;
  tour_id: string;
  lead_passenger_id: string | null;
  passenger_count: number;
  passenger_2_name: string | null;
  passenger_3_name: string | null;
  group_name: string | null;
  booking_agent: string | null;
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled';
  extra_requests: string | null;
  invoice_notes: string | null;
  accommodation_required: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  total_nights: number | null;
  created_at: string;
  updated_at: string;
  
  // Emergency contact
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  
  // Travel documents
  passport_number: string | null;
  passport_expiry_date: string | null;
  passport_country: string | null;
  id_number: string | null;
  nationality: string | null;
  
  // Medical info
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
}

interface EditBookingModalProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditBookingModal = ({ booking, open, onOpenChange }: EditBookingModalProps) => {
  const [formData, setFormData] = useState({
    // Basic booking info
    lead_passenger_first_name: '',
    lead_passenger_last_name: '',
    lead_passenger_email: '',
    lead_passenger_phone: '',
    lead_passenger_dietary_requirements: '',
    passenger_count: 1,
    passenger_2_name: '',
    passenger_3_name: '',
    group_name: '',
    booking_agent: '',
    status: 'pending' as 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled',
    extra_requests: '',
    invoice_notes: '',
    accommodation_required: true,
    check_in_date: '',
    check_out_date: '',
    
    // Emergency contact
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    
    // Travel documents
    passport_number: '',
    passport_expiry_date: '',
    passport_country: '',
    id_number: '',
    nationality: '',
    
    // Medical info
    medical_conditions: '',
    accessibility_needs: '',
    dietary_restrictions: '',
  });

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<any>(null);

  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const cancelBooking = useCancelBooking();
  const updateCustomer = useUpdateCustomer();

  useEffect(() => {
    if (booking) {
      setFormData({
        // Basic info
        lead_passenger_first_name: booking.customers?.first_name || '',
        lead_passenger_last_name: booking.customers?.last_name || '',
        lead_passenger_email: booking.customers?.email || '',
        lead_passenger_phone: booking.customers?.phone || '',
        lead_passenger_dietary_requirements: booking.customers?.dietary_requirements || '',
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
        
        // Emergency contact
        emergency_contact_name: booking.emergency_contact_name || '',
        emergency_contact_phone: booking.emergency_contact_phone || '',
        emergency_contact_relationship: booking.emergency_contact_relationship || '',
        
        // Travel documents
        passport_number: booking.passport_number || '',
        passport_expiry_date: booking.passport_expiry_date || '',
        passport_country: booking.passport_country || '',
        id_number: booking.id_number || '',
        nationality: booking.nationality || '',
        
        // Medical info
        medical_conditions: booking.medical_conditions || '',
        accessibility_needs: booking.accessibility_needs || '',
        dietary_restrictions: booking.dietary_restrictions || '',
      });
    }
  }, [booking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    // First update the customer dietary requirements if they have changed
    const currentDietary = booking.customers?.dietary_requirements || '';
    if (formData.lead_passenger_dietary_requirements !== currentDietary && booking.customers?.id) {
      updateCustomer.mutate({
        id: booking.customers.id,
        dietary_requirements: formData.lead_passenger_dietary_requirements
      });
    }

    // Then update the booking with all fields except removed payment fields
    updateBooking.mutate({
      id: booking.id,
      // Basic booking fields
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
      
      // Emergency contact
      emergency_contact_name: formData.emergency_contact_name || null,
      emergency_contact_phone: formData.emergency_contact_phone || null,
      emergency_contact_relationship: formData.emergency_contact_relationship || null,
      
      // Travel documents
      passport_number: formData.passport_number || null,
      passport_expiry_date: formData.passport_expiry_date || null,
      passport_country: formData.passport_country || null,
      id_number: formData.id_number || null,
      nationality: formData.nationality || null,
      
      // Medical info
      medical_conditions: formData.medical_conditions || null,
      accessibility_needs: formData.accessibility_needs || null,
      dietary_restrictions: formData.dietary_restrictions || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const handleStatusChange = (newStatus: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled') => {
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
        onOpenChange(false);
      }
    });
  };

  const handleDelete = () => {
    if (!booking) return;
    if (confirm('Are you sure you want to delete this booking?')) {
      deleteBooking.mutate(booking.id);
      onOpenChange(false);
    }
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

  if (!booking) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Edit Booking - {formData.lead_passenger_first_name} {formData.lead_passenger_last_name}
              <Button onClick={handleDelete} variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Booking
              </Button>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="emergency" className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Emergency
              </TabsTrigger>
              <TabsTrigger value="travel" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Travel Docs
              </TabsTrigger>
              <TabsTrigger value="medical" className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                Medical
              </TabsTrigger>
              <TabsTrigger value="accommodation">Hotel</TabsTrigger>
              <TabsTrigger value="communication" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Comments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="border rounded-lg p-4 space-y-4">
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
                        className="bg-gray-100"
                        title="Customer details are managed separately in the Contacts section"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lead_passenger_last_name">Lead Passenger Last Name</Label>
                      <Input
                        id="lead_passenger_last_name"
                        value={formData.lead_passenger_last_name}
                        disabled
                        className="bg-gray-100"
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
                        className="bg-gray-100"
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
                        className="bg-gray-100"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="passenger_count">Passenger Count</Label>
                    <Input
                      id="passenger_count"
                      type="number"
                      min="1"
                      value={formData.passenger_count}
                      onChange={(e) => setFormData(prev => ({ ...prev, passenger_count: parseInt(e.target.value) || 1 }))}
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
                        <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  <div>
                    <Label htmlFor="check_in_date">Check In Date</Label>
                    <Input
                      id="check_in_date"
                      type="date"
                      value={formData.check_in_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, check_in_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="check_out_date">Check Out Date</Label>
                    <Input
                      id="check_out_date"
                      type="date"
                      value={formData.check_out_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, check_out_date: e.target.value }))}
                    />
                  </div>
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

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateBooking.isPending}
                    className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                  >
                    {updateBooking.isPending ? 'Updating...' : 'Update Booking'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="emergency" className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-brand-navy">Emergency Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                    <Input
                      id="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                    <Input
                      id="emergency_contact_phone"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                    <Input
                      id="emergency_contact_relationship"
                      value={formData.emergency_contact_relationship}
                      onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_relationship: e.target.value }))}
                      placeholder="e.g., Spouse, Parent, Sibling"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={updateBooking.isPending}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  {updateBooking.isPending ? 'Updating...' : 'Update Emergency Contact'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="travel" className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-brand-navy">Travel Documents</h3>
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
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={updateBooking.isPending}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  {updateBooking.isPending ? 'Updating...' : 'Update Travel Documents'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="medical" className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-brand-navy">Medical & Accessibility Information</h3>
                <div>
                  <Label htmlFor="medical_conditions">Medical Conditions</Label>
                  <Textarea
                    id="medical_conditions"
                    value={formData.medical_conditions}
                    onChange={(e) => setFormData(prev => ({ ...prev, medical_conditions: e.target.value }))}
                    placeholder="Any medical conditions, allergies, or medications..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="accessibility_needs">Accessibility Needs</Label>
                  <Textarea
                    id="accessibility_needs"
                    value={formData.accessibility_needs}
                    onChange={(e) => setFormData(prev => ({ ...prev, accessibility_needs: e.target.value }))}
                    placeholder="Mobility assistance, wheelchair access, etc..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="dietary_restrictions">Dietary Restrictions</Label>
                  <Textarea
                    id="dietary_restrictions"
                    value={formData.dietary_restrictions}
                    onChange={(e) => setFormData(prev => ({ ...prev, dietary_restrictions: e.target.value }))}
                    placeholder="Food allergies, vegetarian, halal, kosher, etc..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={updateBooking.isPending}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  {updateBooking.isPending ? 'Updating...' : 'Update Medical Info'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="accommodation" className="space-y-4">
              {booking && (
                <>
                  <HotelAllocationSection
                    tourId={booking.tour_id}
                    bookingId={booking.id}
                    accommodationRequired={formData.accommodation_required}
                    defaultCheckIn={formData.check_in_date}
                    defaultCheckOut={formData.check_out_date}
                  />
                  <ActivityAllocationSection
                    tourId={booking.tour_id}
                    bookingId={booking.id}
                    passengerCount={formData.passenger_count}
                  />
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Close
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="communication" className="space-y-4">
              {booking && <BookingCommentsSection bookingId={booking.id} />}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>

        <CancelBookingDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancelConfirm}
          bookingId={booking?.id || ""}
          isLoading={cancelBooking.isPending}
        />
      </Dialog>

      <EditContactModal
        contact={contactToEdit}
        open={showEditContact}
        onOpenChange={setShowEditContact}
        onContactUpdated={handleContactUpdated}
      />
    </>
  );
};
