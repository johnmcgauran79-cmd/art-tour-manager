
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit } from "lucide-react";
import { ContactSearch } from "./ContactSearch";

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
  selectedContactId: string;
}

export const LeadPassengerSection = ({
  formData,
  onInputChange,
  onContactSelect,
  onEditContact,
  selectedContactId
}: LeadPassengerSectionProps) => {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Lead Passenger Details</h3>
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
            placeholder="e.g., +1234567890"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="leadDietary">Dietary Requirements</Label>
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
