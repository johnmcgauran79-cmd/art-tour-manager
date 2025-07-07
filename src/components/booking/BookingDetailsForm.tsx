
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface BookingDetailsFormProps {
  formData: any;
  setFormData: (data: any) => void;
  tours?: any[];
  preSelectedTourId?: string;
  isWaitlistMode?: boolean;
}

export const BookingDetailsForm = ({ 
  formData, 
  setFormData, 
  tours, 
  preSelectedTourId,
  isWaitlistMode = false 
}: BookingDetailsFormProps) => {
  return (
    <div className="space-y-4">
      {isWaitlistMode && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This booking will be added to the waitlist. You can convert it to a confirmed booking later when spots become available.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tour_id">Tour *</Label>
          <Select 
            value={formData.tour_id} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, tour_id: value }))}
            disabled={!!preSelectedTourId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a tour" />
            </SelectTrigger>
            <SelectContent>
              {tours?.map((tour) => (
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
            onChange={(e) => setFormData(prev => ({ ...prev, passenger_count: parseInt(e.target.value) || 1 }))}
          />
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

        {!isWaitlistMode && (
          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
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
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
          placeholder="Any special requests or notes..."
        />
      </div>

      <div>
        <Label htmlFor="invoice_notes">Invoice Notes</Label>
        <Textarea
          id="invoice_notes"
          value={formData.invoice_notes}
          onChange={(e) => setFormData(prev => ({ ...prev, invoice_notes: e.target.value }))}
          placeholder="Notes for invoicing..."
        />
      </div>
    </div>
  );
};
