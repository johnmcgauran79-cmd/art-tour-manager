import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneInput } from "@/components/ui/phone-input";
import { Trash2, Calendar, X } from "lucide-react";
import { useUpdateCustomer, useDeleteCustomer } from "@/hooks/useCustomers";
import { Customer } from "@/hooks/useCustomers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContactBookingsList } from "@/components/ContactBookingsList";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

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
    preferred_name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    spouse_name: "",
    dietary_requirements: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    emergency_contact_email: "",
    medical_conditions: "",
    accessibility_needs: "",
    notes: "",
  });
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasBookings, setHasBookings] = useState(false);

  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const { toast } = useToast();

  // Check user role
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        setUserRole(roleData?.role || null);
      }
    };
    
    checkUserRole();
  }, []);

  // Check if contact has bookings
  useEffect(() => {
    const checkBookings = async () => {
      if (contact?.id) {
        const { data } = await supabase
          .from('bookings')
          .select('id')
          .eq('lead_passenger_id', contact.id)
          .limit(1);
        
        setHasBookings(data && data.length > 0);
      }
    };
    
    checkBookings();
  }, [contact?.id]);

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        preferred_name: contact.preferred_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        city: contact.city || "",
        state: contact.state || "",
        country: contact.country || "",
        spouse_name: contact.spouse_name || "",
        dietary_requirements: contact.dietary_requirements || "",
        emergency_contact_name: contact.emergency_contact_name || "",
        emergency_contact_phone: contact.emergency_contact_phone || "",
        emergency_contact_relationship: contact.emergency_contact_relationship || "",
        emergency_contact_email: contact.emergency_contact_email || "",
        medical_conditions: contact.medical_conditions || "",
        accessibility_needs: contact.accessibility_needs || "",
        notes: contact.notes || "",
      });
    }
  }, [contact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact?.id) return;
    
    const customerData = {
      ...formData,
      preferred_name: formData.preferred_name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      city: formData.city || null,
      state: formData.state || null,
      country: formData.country || null,
      spouse_name: formData.spouse_name || null,
      dietary_requirements: formData.dietary_requirements || null,
      emergency_contact_name: formData.emergency_contact_name || null,
      emergency_contact_phone: formData.emergency_contact_phone || null,
      emergency_contact_relationship: formData.emergency_contact_relationship || null,
      emergency_contact_email: formData.emergency_contact_email || null,
      medical_conditions: formData.medical_conditions || null,
      accessibility_needs: formData.accessibility_needs || null,
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

  const handleDelete = () => {
    if (!contact?.id) return;
    
    // Check if contact has bookings
    if (hasBookings) {
      toast({
        title: "Cannot Delete Contact",
        description: "This contact has tour bookings and cannot be deleted. Please cancel or transfer their bookings first.",
        variant: "destructive",
      });
      return;
    }
    
    deleteCustomer.mutate(contact.id, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  // Check if user can delete (only admin or manager)
  const canDelete = userRole === 'admin' || userRole === 'manager';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-3">
            <AppBreadcrumbs
              items={[
                { label: "Contacts" },
                { label: `${contact?.first_name} ${contact?.last_name}` },
              ]}
            />
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Edit Contact</DialogTitle>
                <DialogDescription>
                  Update contact information and view their bookings.
                </DialogDescription>
              </div>
            <div className="flex items-center gap-2">
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                      <AlertDialogDescription>
                        {hasBookings ? (
                          <>
                            This contact has tour bookings and cannot be deleted. Please cancel or transfer their bookings first.
                          </>
                        ) : (
                          <>
                            Are you sure you want to delete {contact?.first_name} {contact?.last_name}? 
                            This action cannot be undone.
                          </>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      {!hasBookings && (
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleteCustomer.isPending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteCustomer.isPending ? "Deleting..." : "Delete Contact"}
                        </AlertDialogAction>
                      )}
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
            </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Contact Details</TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Bookings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
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
                <div className="mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_email">Email</Label>
                    <Input
                      id="emergency_contact_email"
                      type="email"
                      value={formData.emergency_contact_email}
                      onChange={(e) => handleInputChange("emergency_contact_email", e.target.value)}
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
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            {contact?.id && <ContactBookingsList contactId={contact.id} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
