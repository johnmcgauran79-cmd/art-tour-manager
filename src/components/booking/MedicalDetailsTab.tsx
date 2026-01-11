import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface MedicalFormData {
  dietary_requirements: string;
  medical_conditions: string;
  accessibility_needs: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
}

interface MedicalDetailsTabProps {
  medicalFormData: MedicalFormData;
  setMedicalFormData: React.Dispatch<React.SetStateAction<MedicalFormData>>;
  hasSelectedContact: boolean;
  onBack: () => void;
  onContinue: () => void;
}

export const MedicalDetailsTab = ({
  medicalFormData,
  setMedicalFormData,
  hasSelectedContact,
  onBack,
  onContinue,
}: MedicalDetailsTabProps) => {
  const handleChange = (field: keyof MedicalFormData, value: string) => {
    setMedicalFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!hasSelectedContact) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Medical & Emergency Contact</h3>
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Please select or create a contact first to manage medical and emergency contact information.
            </p>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button 
            type="button"
            onClick={onContinue}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            Continue to Travel Documents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Medical & Emergency Contact</h3>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medical & Dietary Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="dietary_requirements">Dietary Requirements</Label>
            <Textarea
              id="dietary_requirements"
              value={medicalFormData.dietary_requirements}
              onChange={(e) => handleChange('dietary_requirements', e.target.value)}
              placeholder="e.g., Vegetarian, Gluten-free, No nuts..."
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="medical_conditions">Medical Conditions</Label>
            <Textarea
              id="medical_conditions"
              value={medicalFormData.medical_conditions}
              onChange={(e) => handleChange('medical_conditions', e.target.value)}
              placeholder="Any medical conditions we should be aware of..."
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="accessibility_needs">Accessibility Needs</Label>
            <Textarea
              id="accessibility_needs"
              value={medicalFormData.accessibility_needs}
              onChange={(e) => handleChange('accessibility_needs', e.target.value)}
              placeholder="Any mobility or accessibility requirements..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergency_contact_name">Name</Label>
              <Input
                id="emergency_contact_name"
                value={medicalFormData.emergency_contact_name}
                onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                placeholder="Emergency contact name"
              />
            </div>
            <div>
              <Label htmlFor="emergency_contact_phone">Phone</Label>
              <Input
                id="emergency_contact_phone"
                value={medicalFormData.emergency_contact_phone}
                onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                placeholder="Emergency contact phone"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="emergency_contact_relationship">Relationship</Label>
            <Input
              id="emergency_contact_relationship"
              value={medicalFormData.emergency_contact_relationship}
              onChange={(e) => handleChange('emergency_contact_relationship', e.target.value)}
              placeholder="e.g., Spouse, Partner, Parent, Child..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          type="button"
          onClick={onContinue}
          className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
        >
          Continue to Travel Documents
        </Button>
      </div>
    </div>
  );
};
