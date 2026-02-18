import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ContactSearch } from "@/components/booking/ContactSearch";
import { PassengerContactSearch } from "@/components/booking/PassengerContactSearch";
import { PassengerContactData } from "@/hooks/useBookingFormState";

interface BookingDetailsFormProps {
  formData: any;
  setFormData: (field: string, value: any) => void;
  tours: any[];
  preSelectedTourId?: string;
  isWaitlistMode?: boolean;
  onSecondaryContactSelect?: (contact: any) => void;
  selectedSecondaryContact?: any;
  selectedPassenger2?: PassengerContactData | null;
  selectedPassenger3?: PassengerContactData | null;
  onPassenger2Select?: (contact: PassengerContactData | null) => void;
  onPassenger3Select?: (contact: PassengerContactData | null) => void;
}

export const BookingDetailsForm = ({ 
  formData, 
  setFormData, 
  tours = [], 
  preSelectedTourId,
  isWaitlistMode = false,
  onSecondaryContactSelect,
  selectedSecondaryContact,
  selectedPassenger2,
  selectedPassenger3,
  onPassenger2Select,
  onPassenger3Select,
}: BookingDetailsFormProps) => {
  // Clear check-in/out dates when accommodation is not required
  useEffect(() => {
    if (!formData.accommodation_required) {
      if (formData.check_in_date || formData.check_out_date) {
        setFormData('check_in_date', '');
        setFormData('check_out_date', '');
      }
    }
  }, [formData.accommodation_required, formData.check_in_date, formData.check_out_date, setFormData]);

  const handlePassenger2Select = (contact: PassengerContactData | null) => {
    if (contact) {
      setFormData('passenger_2_id', contact.id);
      setFormData('passenger_2_name', `${contact.first_name} ${contact.last_name}`);
    } else {
      setFormData('passenger_2_id', '');
      setFormData('passenger_2_name', '');
    }
    onPassenger2Select?.(contact);
  };

  const handlePassenger3Select = (contact: PassengerContactData | null) => {
    if (contact) {
      setFormData('passenger_3_id', contact.id);
      setFormData('passenger_3_name', `${contact.first_name} ${contact.last_name}`);
    } else {
      setFormData('passenger_3_id', '');
      setFormData('passenger_3_name', '');
    }
    onPassenger3Select?.(contact);
  };

  return (
    <div className="space-y-6">
      {/* Tour Selection */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-medium text-brand-navy">Tour Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tour_id">Tour *</Label>
            <Select 
              value={formData.tour_id} 
              onValueChange={(value) => setFormData('tour_id', value)}
              disabled={!!preSelectedTourId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a tour" />
              </SelectTrigger>
              <SelectContent>
                {tours.map((tour) => (
                  <SelectItem key={tour.id} value={tour.id}>
                    {tour.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="passenger_count">Passenger Count *</Label>
            <Input
              id="passenger_count"
              type="number"
              min="1"
              value={formData.passenger_count}
              onChange={(e) => {
                const value = Math.max(1, Number(e.target.value) || 1);
                setFormData('passenger_count', value);
              }}
              required
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="space-y-0.5">
            <Label htmlFor="whatsapp_group_comms" className="text-sm font-medium">
              WhatsApp Group Communications
            </Label>
            <p className="text-xs text-muted-foreground">
              Include this booking in the tour's WhatsApp group
            </p>
          </div>
          <Switch
            id="whatsapp_group_comms"
            checked={formData.whatsapp_group_comms ?? true}
            onCheckedChange={(checked) => setFormData('whatsapp_group_comms', checked)}
          />
        </div>
      </div>

      {/* Additional Passengers */}
      {formData.passenger_count > 1 && (
        <div className="border rounded-lg p-4 space-y-4">
          <div>
            <h3 className="text-lg font-medium text-brand-navy">Additional Passengers</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Search for existing contacts or enter a name to create a new contact. Each passenger with an email can receive their own booking communications.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.passenger_count >= 2 && (
              <PassengerContactSearch
                label="Passenger 2"
                selectedContact={selectedPassenger2 || null}
                onContactSelect={handlePassenger2Select}
                fallbackName={formData.passenger_2_name}
                onFallbackNameChange={(name) => setFormData('passenger_2_name', name)}
                showExpandedDetails={true}
                required={false}
                placeholder="Search or enter passenger name..."
              />
            )}
            
            {formData.passenger_count >= 3 && (
              <PassengerContactSearch
                label="Passenger 3"
                selectedContact={selectedPassenger3 || null}
                onContactSelect={handlePassenger3Select}
                fallbackName={formData.passenger_3_name}
                onFallbackNameChange={(name) => setFormData('passenger_3_name', name)}
                showExpandedDetails={true}
                required={false}
                placeholder="Search or enter passenger name..."
              />
            )}
          </div>
        </div>
      )}

      {/* Secondary Contact */}
      <div className="border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-lg font-medium text-brand-navy">Secondary Contact (Optional)</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add a contact who manages this booking (e.g., agent, family member). They will be CC'd on all emails sent to the lead passenger.
          </p>
        </div>
        {selectedSecondaryContact ? (
          <div className="bg-muted/30 p-3 rounded border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedSecondaryContact.first_name} {selectedSecondaryContact.last_name}</p>
                <p className="text-sm text-muted-foreground">{selectedSecondaryContact.email}</p>
                {selectedSecondaryContact.phone && (
                  <p className="text-sm text-muted-foreground">{selectedSecondaryContact.phone}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSecondaryContactSelect?.(null)}
                className="text-sm text-destructive hover:text-destructive/80"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <ContactSearch
            value={formData.secondary_contact_search || ''}
            onValueChange={(value) => setFormData('secondary_contact_search', value)}
            onContactSelect={(contact) => onSecondaryContactSelect?.(contact)}
            selectedContactId={formData.secondary_contact_id || ''}
            required={false}
            label="Secondary Contact Name"
          />
        )}
      </div>

      {/* Booking Information */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-medium text-brand-navy">Booking Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="group_name">Group Name</Label>
            <Input
              id="group_name"
              value={formData.group_name}
              onChange={(e) => setFormData('group_name', e.target.value)}
              placeholder="Optional group name"
            />
          </div>
          
          <div>
            <Label htmlFor="booking_agent">Booking Agent</Label>
            <Input
              id="booking_agent"
              value={formData.booking_agent}
              onChange={(e) => setFormData('booking_agent', e.target.value)}
              placeholder="Agent name"
            />
          </div>
          
          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData('status', value)}
              disabled={isWaitlistMode}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="deposited">Deposited</SelectItem>
                <SelectItem value="instalment_paid">Instalment Paid</SelectItem>
                <SelectItem value="fully_paid">Fully Paid</SelectItem>
                <SelectItem value="complimentary">Complimentary</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
                <SelectItem value="host">Host</SelectItem>
                <SelectItem value="racing_breaks_invoice">RB Invoice</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label htmlFor="extra_requests">Extra Requests</Label>
          <Textarea
            id="extra_requests"
            value={formData.extra_requests}
            onChange={(e) => setFormData('extra_requests', e.target.value)}
            placeholder="Any special requests or notes..."
            rows={3}
          />
        </div>
        
        <div>
          <Label htmlFor="invoice_reference">Invoice Reference (Xero) *</Label>
          <Input
            id="invoice_reference"
            value={formData.invoice_reference || ''}
            onChange={(e) => setFormData('invoice_reference', e.target.value)}
            placeholder="e.g. 1234 or INV-1234"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Required — enter <strong>0</strong> for host or complimentary bookings. Separate multiple invoices with commas (e.g. 1234, 5678).
          </p>
        </div>

        <div>
          <Label htmlFor="invoice_notes">Invoice Notes</Label>
          <Textarea
            id="invoice_notes"
            value={formData.invoice_notes}
            onChange={(e) => setFormData('invoice_notes', e.target.value)}
            placeholder="Notes for invoicing..."
            rows={3}
          />
        </div>
      </div>

      {/* Accommodation */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-medium text-brand-navy">Accommodation</h3>
        <div className="flex items-center space-x-2">
          <Switch
            id="accommodation_required"
            checked={formData.accommodation_required}
            onCheckedChange={(checked) => setFormData('accommodation_required', checked)}
          />
          <Label htmlFor="accommodation_required">Accommodation Required</Label>
        </div>
        
        {formData.accommodation_required && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        )}
      </div>
    </div>
  );
};
