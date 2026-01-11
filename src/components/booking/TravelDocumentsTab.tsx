import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TravelDocumentsFormData {
  passport_number: string;
  passport_expiry_date: string;
  passport_country: string;
  nationality: string;
  id_number: string;
}

interface TravelDocumentsTabProps {
  formData: TravelDocumentsFormData;
  onFormChange: (field: string, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isWaitlistMode: boolean;
}

export const TravelDocumentsTab = ({
  formData,
  onFormChange,
  onBack,
  onSubmit,
  isWaitlistMode,
}: TravelDocumentsTabProps) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Travel Documents</h3>
        
        <div>
          <Label htmlFor="passport_number">Passport Number</Label>
          <Input
            id="passport_number"
            value={formData.passport_number}
            onChange={(e) => onFormChange('passport_number', e.target.value)}
            placeholder="Passport number"
          />
        </div>

        <div>
          <Label htmlFor="passport_expiry_date">Passport Expiry Date</Label>
          <Input
            id="passport_expiry_date"
            type="date"
            value={formData.passport_expiry_date}
            onChange={(e) => onFormChange('passport_expiry_date', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="passport_country">Passport Country</Label>
          <Input
            id="passport_country"
            value={formData.passport_country}
            onChange={(e) => onFormChange('passport_country', e.target.value)}
            placeholder="Country of issue"
          />
        </div>

        <div>
          <Label htmlFor="nationality">Nationality</Label>
          <Input
            id="nationality"
            value={formData.nationality}
            onChange={(e) => onFormChange('nationality', e.target.value)}
            placeholder="Nationality"
          />
        </div>

        <div>
          <Label htmlFor="id_number">ID Number</Label>
          <Input
            id="id_number"
            value={formData.id_number}
            onChange={(e) => onFormChange('id_number', e.target.value)}
            placeholder="National ID or other identification number"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          type="button"
          onClick={onSubmit}
          className={isWaitlistMode ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"}
        >
          {isWaitlistMode ? 'Add to Waitlist' : 'Review & Create Booking'}
        </Button>
      </div>
    </div>
  );
};
