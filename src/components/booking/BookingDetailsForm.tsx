
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTours } from "@/hooks/useTours";
import { LeadPassengerSection } from "./LeadPassengerSection";

interface BookingDetailsFormProps {
  formData: any;
  onInputChange: (field: string, value: string | boolean | number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onContactSelect: (contact: any) => void;
  onEditContact: () => void;
  onAddNewContact: () => void;
  selectedContactId: string;
  isLoading: boolean;
}

export const BookingDetailsForm = ({
  formData,
  onInputChange,
  onSubmit,
  onClose,
  onContactSelect,
  onEditContact,
  onAddNewContact,
  selectedContactId,
  isLoading
}: BookingDetailsFormProps) => {
  const { data: tours } = useTours();

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="tourId">Select Tour</Label>
        <Select value={formData.tourId} onValueChange={(value) => onInputChange("tourId", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a tour..." />
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

      <LeadPassengerSection
        formData={formData}
        onInputChange={onInputChange}
        onContactSelect={onContactSelect}
        onEditContact={onEditContact}
        onAddNewContact={onAddNewContact}
        selectedContactId={selectedContactId}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="passengers">Number of Passengers</Label>
          <Select value={formData.passengers} onValueChange={(value) => onInputChange("passengers", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="groupName">Group Name (Optional)</Label>
          <Input
            id="groupName"
            value={formData.groupName}
            onChange={(e) => onInputChange("groupName", e.target.value)}
            placeholder="e.g., Smith Family"
          />
        </div>
      </div>

      {parseInt(formData.passengers) >= 2 && (
        <div className="space-y-2">
          <Label htmlFor="passenger2Name">Passenger 2 Name</Label>
          <Input
            id="passenger2Name"
            value={formData.passenger2Name}
            onChange={(e) => onInputChange("passenger2Name", e.target.value)}
            placeholder="e.g., Mary Smith"
          />
        </div>
      )}

      {parseInt(formData.passengers) >= 3 && (
        <div className="space-y-2">
          <Label htmlFor="passenger3Name">Passenger 3 Name</Label>
          <Input
            id="passenger3Name"
            value={formData.passenger3Name}
            onChange={(e) => onInputChange("passenger3Name", e.target.value)}
            placeholder="e.g., Sarah Smith"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bookingAgent">Booking Agent</Label>
          <Input
            id="bookingAgent"
            value={formData.bookingAgent}
            onChange={(e) => onInputChange("bookingAgent", e.target.value)}
            placeholder="e.g., Travel Agent Name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Booking Status</Label>
          <Select value={formData.status} onValueChange={(value) => onInputChange("status", value)}>
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

        <div className="space-y-2">
          <Label htmlFor="checkInDate">Check In Date</Label>
          <Input
            id="checkInDate"
            type="date"
            value={formData.checkInDate}
            onChange={(e) => onInputChange("checkInDate", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkOutDate">Check Out Date</Label>
          <Input
            id="checkOutDate"
            type="date"
            value={formData.checkOutDate}
            onChange={(e) => onInputChange("checkOutDate", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="accommodationRequired"
          checked={formData.accommodationRequired}
          onCheckedChange={(checked) => onInputChange("accommodationRequired", checked as boolean)}
        />
        <Label htmlFor="accommodationRequired">Accommodation Required</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="extraRequests">Extra Requests</Label>
        <Textarea
          id="extraRequests"
          value={formData.extraRequests}
          onChange={(e) => onInputChange("extraRequests", e.target.value)}
          placeholder="Any special requests or requirements..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invoiceNotes">Invoice Notes</Label>
        <Textarea
          id="invoiceNotes"
          value={formData.invoiceNotes}
          onChange={(e) => onInputChange("invoiceNotes", e.target.value)}
          placeholder="Notes to be included on the invoice..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
        >
          {isLoading ? "Creating..." : "Create Booking"}
        </Button>
      </div>
    </form>
  );
};
