import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2, Mail, Phone, User, Save, X } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { ContactBookingsList } from "@/components/ContactBookingsList";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className="text-sm">{value || "—"}</span>
  </div>
);

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: contactsData, isLoading } = useCustomers();
  const contact = contactsData?.customers.find(c => c.id === id);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedContact, setEditedContact] = useState<any>({});

  const handleEdit = () => {
    if (contact) {
      setEditedContact({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone,
        city: contact.city || '',
        state: contact.state || '',
        country: contact.country || '',
        spouse_name: contact.spouse_name || '',
        dietary_requirements: contact.dietary_requirements || '',
        notes: contact.notes || ''
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!contact) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update(editedContact)
        .eq('id', contact.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!contact) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      navigate("/?tab=contacts");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Contact Not Found</h1>
          <Button onClick={() => navigate("/?tab=contacts")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contacts
          </Button>
        </div>
      </div>
    );
  }

  const fullName = `${contact.first_name} ${contact.last_name}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <AppBreadcrumbs
          items={[
            { label: "Contacts", href: "/?tab=contacts" },
            { label: fullName }
          ]}
        />
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{fullName}</h1>
            <p className="text-muted-foreground mt-1">{contact.email}</p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/?tab=contacts")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {isEditing ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this contact? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">
            <User className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <Mail className="h-4 w-4 mr-2" />
            Bookings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-6">
          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={editedContact.first_name || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={editedContact.last_name || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, last_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editedContact.email || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={editedContact.phone || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={editedContact.city || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={editedContact.state || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={editedContact.country || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, country: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spouse_name">Spouse Name</Label>
                    <Input
                      id="spouse_name"
                      value={editedContact.spouse_name || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, spouse_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dietary_requirements">Dietary Requirements</Label>
                  <Textarea
                    id="dietary_requirements"
                    value={editedContact.dietary_requirements || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, dietary_requirements: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={editedContact.notes || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, notes: e.target.value })}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="First Name" value={contact.first_name} />
                  <InfoRow label="Last Name" value={contact.last_name} />
                  <InfoRow label="Email" value={contact.email} />
                  <InfoRow label="Phone" value={contact.phone} />
                  <InfoRow label="Spouse Name" value={contact.spouse_name} />
                  <InfoRow label="City" value={contact.city} />
                  <InfoRow label="State" value={contact.state} />
                  <InfoRow label="Country" value={contact.country} />
                </CardContent>
              </Card>

              {(contact.dietary_requirements || contact.notes) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {contact.dietary_requirements && (
                      <InfoRow label="Dietary Requirements" value={contact.dietary_requirements} />
                    )}
                    {contact.notes && (
                      <InfoRow label="Notes" value={contact.notes} />
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4 mt-6">
          <ContactBookingsList contactId={contact.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
