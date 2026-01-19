
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { useCreateCustomer } from "@/hooks/useCustomers";

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactCreated?: (contact: any) => void;
}

export const AddContactModal = ({ open, onOpenChange, onContactCreated }: AddContactModalProps) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    preferred_name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    spouse_name: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    dietary_requirements: "",
    medical_conditions: "",
    accessibility_needs: "",
    notes: "",
  });

  const createCustomer = useCreateCustomer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const customerData = {
      ...formData,
      // Convert empty strings to null for optional fields
      preferred_name: formData.preferred_name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      city: formData.city || null,
      state: formData.state || null,
      country: formData.country || null,
      spouse_name: formData.spouse_name || null,
      emergency_contact_name: formData.emergency_contact_name || null,
      emergency_contact_phone: formData.emergency_contact_phone || null,
      emergency_contact_relationship: formData.emergency_contact_relationship || null,
      dietary_requirements: formData.dietary_requirements || null,
      medical_conditions: formData.medical_conditions || null,
      accessibility_needs: formData.accessibility_needs || null,
      notes: formData.notes || null,
      // Add missing fields required by Customer interface
      crm_id: null,
      last_synced_at: null,
      avatar_url: null,
    };

    createCustomer.mutate(customerData, {
      onSuccess: (data) => {
        onOpenChange(false);
        if (onContactCreated) {
          onContactCreated(data);
        }
        setFormData({
          first_name: "",
          last_name: "",
          preferred_name: "",
          email: "",
          phone: "",
          city: "",
          state: "",
          country: "",
          spouse_name: "",
          emergency_contact_name: "",
          emergency_contact_phone: "",
          emergency_contact_relationship: "",
          dietary_requirements: "",
          medical_conditions: "",
          accessibility_needs: "",
          notes: "",
        });
      },
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>
            Add a new customer contact to the system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleInputChange("first_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleInputChange("last_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred_name">Preferred Name</Label>
              <Input
                id="preferred_name"
                value={formData.preferred_name}
                onChange={(e) => handleInputChange("preferred_name", e.target.value)}
                placeholder="Nickname or preferred name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <PhoneInput
                value={formData.phone}
                onChange={(value) => handleInputChange("phone", value)}
                label="Phone"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange("state", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => handleInputChange("country", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spouse_name">Spouse Name</Label>
            <Input
              id="spouse_name"
              value={formData.spouse_name}
              onChange={(e) => handleInputChange("spouse_name", e.target.value)}
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3">Emergency Contact</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">Name</Label>
                <Input
                  id="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={(e) => handleInputChange("emergency_contact_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_phone">Phone</Label>
                <Input
                  id="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => handleInputChange("emergency_contact_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                <Input
                  id="emergency_contact_relationship"
                  value={formData.emergency_contact_relationship}
                  onChange={(e) => handleInputChange("emergency_contact_relationship", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3">Medical & Dietary</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dietary_requirements">Dietary Requirements</Label>
                <Textarea
                  id="dietary_requirements"
                  value={formData.dietary_requirements}
                  onChange={(e) => handleInputChange("dietary_requirements", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medical_conditions">Medical Conditions</Label>
                <Textarea
                  id="medical_conditions"
                  value={formData.medical_conditions}
                  onChange={(e) => handleInputChange("medical_conditions", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessibility_needs">Accessibility Needs</Label>
                <Textarea
                  id="accessibility_needs"
                  value={formData.accessibility_needs}
                  onChange={(e) => handleInputChange("accessibility_needs", e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
            >
              Close
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={createCustomer.isPending}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            onClick={handleSubmit}
          >
            {createCustomer.isPending ? "Creating..." : "Create Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
