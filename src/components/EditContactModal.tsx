
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateCustomer } from "@/hooks/useCustomers";
import { Customer } from "@/hooks/useCustomers";

interface EditContactModalProps {
  contact: Partial<Customer> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactUpdated?: (contact: Customer) => void;
}

export const EditContactModal = ({ contact, open, onOpenChange, onContactUpdated }: EditContactModalProps) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    spouse_name: "",
    dietary_requirements: "",
    notes: "",
  });

  const updateCustomer = useUpdateCustomer();

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        city: contact.city || "",
        state: contact.state || "",
        country: contact.country || "",
        spouse_name: contact.spouse_name || "",
        dietary_requirements: contact.dietary_requirements || "",
        notes: contact.notes || "",
      });
    }
  }, [contact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact?.id) return;
    
    const customerData = {
      ...formData,
      // Convert empty strings to null for optional fields
      email: formData.email || null,
      phone: formData.phone || null,
      city: formData.city || null,
      state: formData.state || null,
      country: formData.country || null,
      spouse_name: formData.spouse_name || null,
      dietary_requirements: formData.dietary_requirements || null,
      notes: formData.notes || null,
    };

    updateCustomer.mutate({
      id: contact.id,
      ...customerData,
    }, {
      onSuccess: (updatedContact) => {
        onContactUpdated?.(updatedContact);
        onOpenChange(false);
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
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Update contact information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateCustomer.isPending}
              className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              {updateCustomer.isPending ? "Updating..." : "Update Contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
