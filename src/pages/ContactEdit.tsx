import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { useCustomerById } from "@/hooks/useCustomers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

export default function ContactEdit() {
  const { id } = useParams();
  const { goBack } = useNavigationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: contact, isLoading } = useCustomerById(id || null);
  
  const [editedContact, setEditedContact] = useState<any>({});

  useEffect(() => {
    if (contact) {
      setEditedContact({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone || '',
        city: contact.city || '',
        state: contact.state || '',
        country: contact.country || '',
        spouse_name: contact.spouse_name || '',
        dietary_requirements: contact.dietary_requirements || '',
        notes: contact.notes || ''
      });
    }
  }, [contact]);

  const handleSave = async () => {
    if (!contact) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update(editedContact)
        .eq('id', contact.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', contact.id] });
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      goBack(`/contacts/${contact.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
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
          <Button onClick={() => goBack("/?tab=contacts")}>
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
            { label: fullName, href: `/contacts/${contact.id}` },
            { label: "Edit" }
          ]}
        />
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Edit Contact - {fullName}</h1>
            <p className="text-muted-foreground mt-1">{contact.email}</p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goBack(`/contacts/${contact.id}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Contact
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={editedContact.first_name || ''}
                onChange={(e) => setEditedContact({ ...editedContact, first_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={editedContact.last_name || ''}
                onChange={(e) => setEditedContact({ ...editedContact, last_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={editedContact.email || ''}
                onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                required
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
              rows={3}
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

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => goBack(`/contacts/${contact.id}`)}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
