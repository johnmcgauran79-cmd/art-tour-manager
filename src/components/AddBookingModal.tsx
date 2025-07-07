
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Heart, Shield } from "lucide-react";
import { useCreateBooking } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { ContactSearch } from "@/components/booking/ContactSearch";
import { BookingDetailsForm } from "@/components/booking/BookingDetailsForm";

interface AddBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedTourId?: string;
  defaultStatus?: string;
}

export const AddBookingModal = ({ open, onOpenChange, preSelectedTourId, defaultStatus = "pending" }: AddBookingModalProps) => {
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [leadPassengerName, setLeadPassengerName] = useState('');
  const [formData, setFormData] = useState({
    // Basic booking info
    tour_id: preSelectedTourId || '',
    lead_passenger_name: '',
    lead_passenger_email: '',
    lead_passenger_phone: '',
    passenger_count: 1,
    passenger_2_name: '',
    passenger_3_name: '',
    group_name: '',
    booking_agent: '',
    status: defaultStatus,
    extra_requests: '',
    accommodation_required: true,
    check_in_date: '',
    check_out_date: '',
    invoice_notes: '',
    
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

  const { data: tours } = useTours();
  const createBooking = useCreateBooking();

  useEffect(() => {
    if (preSelectedTourId) {
      setFormData(prev => ({ ...prev, tour_id: preSelectedTourId }));
    }
    if (defaultStatus) {
      setFormData(prev => ({ ...prev, status: defaultStatus }));
    }
  }, [preSelectedTourId, defaultStatus]);

  useEffect(() => {
    if (selectedContact) {
      const fullName = `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        lead_passenger_name: fullName,
        lead_passenger_email: selectedContact.email || '',
        lead_passenger_phone: selectedContact.phone || '',
        dietary_restrictions: selectedContact.dietary_requirements || '',
      }));
      setLeadPassengerName(fullName);
    }
  }, [selectedContact]);

  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tour_id) {
      alert('Please select a tour');
      return;
    }
    
    if (!formData.lead_passenger_name || !formData.lead_passenger_email) {
      alert('Please provide lead passenger name and email');
      return;
    }

    createBooking.mutate(formData, {
      onSuccess: () => {
        onOpenChange(false);
        // Reset form
        setFormData({
          tour_id: preSelectedTourId || '',
          lead_passenger_name: '',
          lead_passenger_email: '',
          lead_passenger_phone: '',
          passenger_count: 1,
          passenger_2_name: '',
          passenger_3_name: '',
          group_name: '',
          booking_agent: '',
          status: defaultStatus,
          extra_requests: '',
          accommodation_required: true,
          check_in_date: '',
          check_out_date: '',
          invoice_notes: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
          emergency_contact_relationship: '',
          passport_number: '',
          passport_expiry_date: '',
          passport_country: '',
          id_number: '',
          nationality: '',
          medical_conditions: '',
          accessibility_needs: '',
          dietary_restrictions: '',
        });
        setSelectedContact(null);
        setLeadPassengerName('');
      }
    });
  };

  const isWaitlistMode = defaultStatus === 'waitlisted';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isWaitlistMode ? 'Add to Waitlist' : 'Add New Booking'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="medical" className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              Medical & Emergency
            </TabsTrigger>
            <TabsTrigger value="travel" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Travel Docs
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Contact Search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Lead Passenger Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-brand-navy">Lead Passenger Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lead_passenger_name">Lead Passenger Name *</Label>
                    <Input
                      id="lead_passenger_name"
                      value={formData.lead_passenger_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead_passenger_email">Email *</Label>
                    <Input
                      id="lead_passenger_email"
                      type="email"
                      value={formData.lead_passenger_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead_passenger_phone">Phone</Label>
                    <Input
                      id="lead_passenger_phone"
                      value={formData.lead_passenger_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_passenger_phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <BookingDetailsForm 
                formData={formData}
                setFormData={setFormData}
                tours={tours}
                preSelectedTourId={preSelectedTourId}
                isWaitlistMode={isWaitlistMode}
              />

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBooking.isPending}
                  className={isWaitlistMode ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"}
                >
                  {createBooking.isPending ? 'Creating...' : (isWaitlistMode ? 'Add to Waitlist' : 'Create Booking')}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="medical" className="space-y-4">
            <div className="grid grid-cols-1 gap-6">
              {/* Emergency Contact Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-brand-navy flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Emergency Contact Information
                </h3>
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

              {/* Medical & Accessibility Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-brand-navy flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Medical & Accessibility Information
                </h3>
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
                  <Label htmlFor="dietary_restrictions">Dietary Requirements</Label>
                  <Textarea
                    id="dietary_restrictions"
                    value={formData.dietary_restrictions}
                    onChange={(e) => setFormData(prev => ({ ...prev, dietary_restrictions: e.target.value }))}
                    placeholder="Food allergies, dietary preferences, etc..."
                    rows={3}
                  />
                </div>
              </div>
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
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <ContactSearch 
              value={leadPassengerName}
              onValueChange={setLeadPassengerName}
              onContactSelect={handleContactSelect}
              selectedContactId={selectedContact?.id || ''}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
