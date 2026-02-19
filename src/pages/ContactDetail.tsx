import { useParams, useSearchParams, Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2, Mail, User } from "lucide-react";
import { useCustomerById } from "@/hooks/useCustomers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { ContactBookingsList } from "@/components/ContactBookingsList";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState, useEffect, type ReactNode } from "react";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ContactAvatar } from "@/components/ContactAvatar";
import { SendProfileUpdateButton } from "@/components/SendProfileUpdateButton";
const InfoRow = ({ label, value, extra }: { label: string; value: string | null | undefined; extra?: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-sm">{value || "—"}</span>
      {extra}
    </div>
  </div>
);

export default function ContactDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { navigateWithContext, goBack } = useNavigationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: contactData, isLoading } = useCustomerById(id || null);
  const { isViewOnly } = usePermissions();
  const contact = contactData;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentTab, setCurrentTab] = useState(searchParams.get('tab') || "details");

  // Update tab when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      setCurrentTab(tabFromUrl);
    }
  }, [searchParams]);
  

  const checkForBookings = async () => {
    if (!contact) return false;

    try {
      // Check all booking references: lead, passenger_2, passenger_3, secondary_contact
      const [leadRes, p2Res, p3Res, secRes] = await Promise.all([
        supabase.from('bookings').select('id, tours(name)').eq('lead_passenger_id', contact.id).limit(1),
        supabase.from('bookings').select('id').eq('passenger_2_id', contact.id).limit(1),
        supabase.from('bookings').select('id').eq('passenger_3_id', contact.id).limit(1),
        supabase.from('bookings').select('id').eq('secondary_contact_id', contact.id).limit(1),
      ]);

      if (leadRes.error || p2Res.error || p3Res.error || secRes.error) {
        setDeleteError('Unable to verify if contact has bookings. Please try again.');
        return true;
      }

      const hasBookings = (leadRes.data?.length || 0) > 0 || (p2Res.data?.length || 0) > 0 ||
                          (p3Res.data?.length || 0) > 0 || (secRes.data?.length || 0) > 0;

      if (hasBookings) {
        const tourName = leadRes.data?.[0]?.tours?.name || 'a tour';
        setDeleteError(`This contact cannot be deleted as they have existing bookings${leadRes.data?.length ? ` (including ${tourName})` : ''}. Please cancel or remove their bookings first.`);
        return true;
      }

      return false;
    } catch (error: any) {
      setDeleteError(error.message || "Failed to check for bookings.");
      return true;
    }
  };

  const handleDeleteClick = async () => {
    if (!contact) return;

    try {
      // Clean up related records before deleting the customer
      // xero_sync_log has NO ACTION delete rule, must clean up manually
      await supabase.from('xero_sync_log').delete().eq('customer_id', contact.id);
      // booking_travel_docs and booking_waivers SET NULL on customer_id, but clean up anyway
      await supabase.from('booking_travel_docs').update({ customer_id: null }).eq('customer_id', contact.id);
      await supabase.from('booking_waivers').update({ customer_id: null }).eq('customer_id', contact.id);
      // customer_access_tokens and customer_profile_updates CASCADE, no action needed

      const { error, count } = await supabase
        .from('customers')
        .delete({ count: 'exact' })
        .eq('id', contact.id);

      if (error) throw error;
      
      if (count === 0) {
        setDeleteError('Failed to delete contact. You may not have permission to delete this contact.');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowDeleteDialog(false);
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      goBack("/?tab=contacts");
    } catch (error: any) {
      console.error('Delete contact error:', error);
      setDeleteError(error.message || "Failed to delete contact. Please try again.");
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
            { label: fullName }
          ]}
        />
        
        {/* Mobile action buttons - shown at top on mobile */}
        <div className="flex flex-wrap gap-2 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goBack("/?tab=contacts")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          {!isViewOnly && (
            <>
              <SendProfileUpdateButton
                customerId={contact.id}
                customerName={fullName}
                customerEmail={contact.email || null}
                size="sm"
              />
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWithContext(`/contacts/${id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              
              <Button variant="destructive" size="sm" onClick={async () => {
                    setDeleteError(null);
                    await checkForBookings();
                    setShowDeleteDialog(true);
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
              
              <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
                if (!open) {
                  setDeleteError(null);
                }
                setShowDeleteDialog(open);
              }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div>
                        {deleteError ? (
                          <div className="text-destructive font-semibold text-base">
                            {deleteError}
                          </div>
                        ) : (
                          <span>Are you sure you want to delete this contact? This action cannot be undone.</span>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    {!deleteError && (
                      <Button onClick={handleDeleteClick} variant="destructive">
                        Delete
                      </Button>
                    )}
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <ContactAvatar
              contactId={contact.id}
              avatarUrl={contact.avatar_url || null}
              firstName={contact.first_name}
              lastName={contact.last_name}
              editable={true}
              size="lg"
            />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{fullName}</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base truncate">{contact.email}</p>
            </div>
          </div>
          
          {/* Desktop action buttons - hidden on mobile */}
          <div className="hidden sm:flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goBack("/?tab=contacts")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {!isViewOnly && (
              <>
                <SendProfileUpdateButton
                  customerId={contact.id}
                  customerName={fullName}
                  customerEmail={contact.email || null}
                />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWithContext(`/contacts/${id}/edit`)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                
                <Button variant="destructive" size="sm" onClick={async () => {
                    setDeleteError(null);
                    await checkForBookings();
                    setShowDeleteDialog(true);
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
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
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="First Name" value={contact.first_name} />
              <InfoRow label="Last Name" value={contact.last_name} />
              <InfoRow label="Preferred Name" value={contact.preferred_name} />
              <InfoRow label="Email" value={contact.email} />
              <InfoRow 
                label="Phone" 
                value={contact.phone} 
                extra={<WhatsAppButton phone={contact.phone} name={contact.first_name} size="icon" showLabel={false} variant="ghost" className="h-6 w-6 p-0" />}
              />
              <InfoRow label="Spouse Name" value={contact.spouse_name} />
              <InfoRow label="City" value={contact.city} />
              <InfoRow label="State" value={contact.state} />
              <InfoRow label="Country" value={contact.country} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoRow label="Name" value={contact.emergency_contact_name} />
              <InfoRow label="Phone" value={contact.emergency_contact_phone} />
              <InfoRow label="Relationship" value={contact.emergency_contact_relationship} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medical & Dietary Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="Dietary Requirements" value={contact.dietary_requirements} />
              <InfoRow label="Medical Conditions" value={contact.medical_conditions} />
              <InfoRow label="Accessibility Needs" value={contact.accessibility_needs} />
            </CardContent>
          </Card>

          {contact.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Notes" value={contact.notes} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4 mt-6">
          <ContactBookingsList contactId={contact.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
