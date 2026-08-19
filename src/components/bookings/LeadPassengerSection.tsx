
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Plus, Info } from "lucide-react";
import { ContactSearch } from "./ContactSearch";
import { formatPhoneForWhatsApp } from "@/utils/phoneFormatter";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LeadPassengerSectionProps {
  formData: {
    leadPassenger: string;
    leadEmail: string;
    leadPhone: string;
    leadDietary: string;
  };
  onInputChange: (field: string, value: string) => void;
  onContactSelect: (contact: any) => void;
  onEditContact: () => void;
  onAddNewContact: () => void;
  selectedContactId: string;
  selectedContact?: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    dietary_requirements: string | null;
  } | null;
}

export const LeadPassengerSection = ({
  formData,
  onInputChange,
  onContactSelect,
  onEditContact,
  onAddNewContact,
  selectedContactId,
  selectedContact
}: LeadPassengerSectionProps) => {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Lead Passenger Details</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddNewContact}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Contact
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditContact}
            disabled={!formData.leadPassenger}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Contact
          </Button>
        </div>
      </div>

      {selectedContact && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1 text-sm">
              <p><strong>Name:</strong> {selectedContact.first_name} {selectedContact.last_name}</p>
              {selectedContact.email && <p><strong>Email:</strong> {selectedContact.email}</p>}
              {selectedContact.phone && <p><strong>Phone:</strong> {selectedContact.phone}</p>}
              {selectedContact.dietary_requirements && (
                <p><strong>Dietary Requirements:</strong> {selectedContact.dietary_requirements}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ContactSearch
          value={formData.leadPassenger}
          onValueChange={(value) => onInputChange("leadPassenger", value)}
          onContactSelect={onContactSelect}
          selectedContactId={selectedContactId}
        />

        <div className="space-y-2">
          <Label htmlFor="leadEmail">Lead Passenger Email</Label>
          <Input
            id="leadEmail"
            type="email"
            value={formData.leadEmail}
            onChange={(e) => onInputChange("leadEmail", e.target.value)}
            placeholder="e.g., john@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="leadPhone">Lead Passenger Phone</Label>
          <Input
            id="leadPhone"
            type="tel"
            value={formData.leadPhone}
            onChange={(e) => onInputChange("leadPhone", e.target.value)}
            onBlur={(e) => {
              const formatted = formatPhoneForWhatsApp(e.target.value);
              if (formatted && formatted !== e.target.value) {
                onInputChange("leadPhone", formatted);
              }
            }}
            placeholder="e.g., +61412345678"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="leadDietary">
          Dietary Requirements
          <span className="text-xs text-muted-foreground ml-2">
            (stored at passenger level, applies to all bookings)
          </span>
        </Label>
        <Textarea
          id="leadDietary"
          value={formData.leadDietary}
          onChange={(e) => onInputChange("leadDietary", e.target.value)}
          placeholder="Enter dietary requirements..."
          rows={3}
        />
      </div>
    </div>
  );
};
