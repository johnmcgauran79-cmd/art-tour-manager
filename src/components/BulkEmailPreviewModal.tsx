import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkBookingEmail } from "@/hooks/useBulkBookingEmail";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserEmails } from "@/hooks/useUserEmails";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface BulkEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
}

export const BulkEmailPreviewModal = ({ open, onOpenChange, tourId }: BulkEmailPreviewModalProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [editedSubject, setEditedSubject] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [originalSubjectTemplate, setOriginalSubjectTemplate] = useState("");
  const [originalContentTemplate, setOriginalContentTemplate] = useState("");
  
  const [recipientType, setRecipientType] = useState<string>("");
  const [fromEmail, setFromEmail] = useState<string>("bookings@australianracingtours.com.au");
  const [ccEmails, setCcEmails] = useState<string>("");
  const [bccEmails, setBccEmails] = useState<string>("");
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
  const [includeAdditionalPassengers, setIncludeAdditionalPassengers] = useState(true);
  
  const bulkEmailMutation = useBulkBookingEmail((current, total) => {
    setSendProgress({ current, total });
  });
  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();
  const { data: userEmails } = useUserEmails();

  // Quill modules configuration
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link'],
      ['clean']
    ],
  };

  // Get all bookings for selection
  const { data: allBookingsData, isLoading: allBookingsLoading } = useQuery({
    queryKey: ['tour-all-bookings', tourId],
    queryFn: async () => {
      if (!tourId) return [];
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          accommodation_required,
          customers:customers!lead_passenger_id (
            id,
            first_name,
            last_name,
            email
          ),
          passenger_2:customers!passenger_2_id (
            id,
            first_name,
            last_name,
            email
          ),
          passenger_3:customers!passenger_3_id (
            id,
            first_name,
            last_name,
            email
          ),
          hotel_bookings (
            id
          )
        `)
        .eq('tour_id', tourId)
        .neq('status', 'cancelled')
        .not('customers.email', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tourId && open,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const previewBooking = allBookingsData?.find((booking: any) => selectedBookingIds.has(booking.id)) || allBookingsData?.[0] || null;

  // Keep template content responsive even before any preview data loads
  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== "blank" && templates) {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        setOriginalSubjectTemplate(template.subject_template);
        setOriginalContentTemplate(template.content_template);
        setEditedSubject(template.subject_template);
        setEditedContent(template.content_template);
      }
      return;
    }

    if (selectedTemplateId === "blank") {
      const blankSubject = `Email for {{customer.first_name}}`;
      const blankContent = `<p>Dear {{customer.first_name}},</p><p><br></p><p><br></p><p>Best regards,<br>Your Team</p>`;
      setOriginalSubjectTemplate(blankSubject);
      setOriginalContentTemplate(blankContent);
      setEditedSubject(blankSubject);
      setEditedContent(blankContent);
    }
  }, [selectedTemplateId, templates]);

  const handleRecipientTypeChange = (type: string) => {
    setRecipientType(type);
    
    if (!allBookingsData) return;
    
    if (type === "with_accommodation") {
      const withAccomm = allBookingsData
        .filter(b => b.hotel_bookings && b.hotel_bookings.length > 0)
        .map(b => b.id);
      setSelectedBookingIds(new Set(withAccomm));
    } else if (type === "activities_only") {
      const activitiesOnly = allBookingsData
        .filter(b => (!b.hotel_bookings || b.hotel_bookings.length === 0) && b.accommodation_required === false)
        .map(b => b.id);
      setSelectedBookingIds(new Set(activitiesOnly));
    } else if (type === "all") {
      const allIds = allBookingsData.map(b => b.id);
      setSelectedBookingIds(new Set(allIds));
    }
  };

  const toggleBookingSelection = (bookingId: string) => {
    setSelectedBookingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
    setRecipientType("");
  };

  const handleCancel = () => {
    setSelectedBookingIds(new Set());
    setRecipientType("");
    setEditedSubject("");
    setEditedContent("");
    setOriginalSubjectTemplate("");
    setOriginalContentTemplate("");
    setSelectedTemplateId("");
    onOpenChange(false);
  };

  const handleSendClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSend = async () => {
    if (!tourId || !selectedTemplateId || selectedBookingIds.size === 0) return;
    
    // Reset progress
    setSendProgress(null);
    
    try {
      // Use the edited values - these reflect any changes the user made in the editor
      const subjectTemplate = editedSubject;
      const contentTemplate = editedContent;
      
      await bulkEmailMutation.mutateAsync({
        tourId,
        recipientType: 'selected',
        subjectTemplate,
        contentTemplate,
        fromEmail,
        ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
        bccEmails: bccEmails.split(',').map(e => e.trim()).filter(Boolean),
        selectedBookingIds: Array.from(selectedBookingIds),
        includeAdditionalPassengers
      });
      setShowConfirmDialog(false);
      setSendProgress(null);
      onOpenChange(false);
      setSelectedBookingIds(new Set());
      setRecipientType("");
    } catch (error) {
      // Error handling is done in the hook
      setShowConfirmDialog(false);
      setSendProgress(null);
    }
  };

  // Get selected recipients' names for confirmation dialog
  const selectedRecipients = allBookingsData?.filter(b => selectedBookingIds.has(b.id)) || [];
  
  // Calculate additional passengers count for selected bookings
  const additionalPassengersCount = selectedRecipients.reduce((count, booking: any) => {
    let additionalEmails = 0;
    if (booking.passenger_2?.email && booking.passenger_2.email !== booking.customers?.email) {
      additionalEmails++;
    }
    if (booking.passenger_3?.email && booking.passenger_3.email !== booking.customers?.email && booking.passenger_3.email !== booking.passenger_2?.email) {
      additionalEmails++;
    }
    return count + additionalEmails;
  }, 0);
  
  // Total potential emails
  const totalPotentialEmails = selectedBookingIds.size + (includeAdditionalPassengers ? additionalPassengersCount : 0);

  if (!tourId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Send Email</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {templatesLoading || allBookingsLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading email preview...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="template">Email Template:</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="bg-background border z-50">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="blank">Blank Email</SelectItem>
                      {templates?.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>From Email:</Label>
                  <Select value={fromEmail} onValueChange={setFromEmail}>
                    <SelectTrigger className="bg-background border z-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {userEmails?.map((email) => (
                        <SelectItem key={email} value={email}>
                          {email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preview Based On:</Label>
                  <div className="flex items-center h-9 px-3 border rounded-md bg-muted">
                    <span className="text-sm">
                      {previewBooking?.customers?.first_name} {previewBooking?.customers?.last_name}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col gap-1">
                    <Label>
                      {selectedBookingIds.size} bookings
                      {includeAdditionalPassengers && additionalPassengersCount > 0 && (
                        <span className="text-muted-foreground font-normal">
                          {' '}(up to {totalPotentialEmails} emails incl. additional passengers)
                        </span>
                      )}
                    </Label>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleRecipientTypeChange("all")}
                      className="text-xs"
                    >
                      All
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleRecipientTypeChange("with_accommodation")}
                      className="text-xs"
                    >
                      With Accomm
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleRecipientTypeChange("activities_only")}
                      className="text-xs"
                    >
                      Activities Only
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedBookingIds(new Set())}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[180px] border rounded-md p-2">
                  {allBookingsLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allBookingsData?.map((booking: any) => {
                        const hasAccommodation = booking.hotel_bookings && booking.hotel_bookings.length > 0;
                        const hasAdditionalPax = booking.passenger_2?.email || booking.passenger_3?.email;
                        return (
                          <div key={booking.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={booking.id}
                              checked={selectedBookingIds.has(booking.id)}
                              onCheckedChange={() => toggleBookingSelection(booking.id)}
                            />
                            <label
                              htmlFor={booking.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {booking.customers?.first_name} {booking.customers?.last_name}
                              <span className="text-muted-foreground ml-2 text-xs">
                                {hasAccommodation ? '🏨' : '🎯'}
                                {hasAdditionalPax && ' 👥'}
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                
                {/* Additional passengers toggle */}
                <div className="flex items-center space-x-2 mt-3 pt-3 border-t">
                  <Checkbox
                    id="includeAdditionalPassengers"
                    checked={includeAdditionalPassengers}
                    onCheckedChange={(checked) => setIncludeAdditionalPassengers(checked === true)}
                  />
                  <label
                    htmlFor="includeAdditionalPassengers"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Include additional passengers (Pax 2 & 3)
                    {additionalPassengersCount > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        — {additionalPassengersCount} additional {additionalPassengersCount === 1 ? 'email' : 'emails'}
                      </span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cc">CC (comma-separated for multiple):</Label>
                <Input
                  id="cc"
                  type="text"
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>

              <div>
                <Label htmlFor="bcc">BCC (comma-separated for multiple):</Label>
                <Input
                  id="bcc"
                  type="text"
                  value={bccEmails}
                  onChange={(e) => setBccEmails(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="subject">Subject Line:</Label>
              <Input
                id="subject"
                value={editedSubject}
                onChange={(e) => {
                  setEditedSubject(e.target.value);
                  setOriginalSubjectTemplate(e.target.value);
                }}
                placeholder="Email subject..."
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="content">Email Content (use merge fields for personalization):</Label>
              <div className="mt-2 border rounded-md">
                <ReactQuill
                  theme="snow"
                  value={editedContent}
                  onChange={(content) => {
                    setEditedContent(content);
                    setOriginalContentTemplate(content);
                  }}
                  modules={quillModules}
                  className="bg-white"
                  style={{ minHeight: '300px' }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use merge fields like {`{{customer.first_name}}`}, {`{{tour.name}}`}, {`{{booking.passenger_count}}`}. Each recipient will receive a personalized version. Preview based on: {previewBooking?.customers?.first_name} {previewBooking?.customers?.last_name}
              </p>
            </div>


            <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendClick}
                disabled={bulkEmailMutation.isPending || selectedBookingIds.size === 0 || !editedContent.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Send {selectedBookingIds.size} Email{selectedBookingIds.size !== 1 ? 's' : ''}
              </Button>
            </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={(open) => {
        if (!bulkEmailMutation.isPending) {
          setShowConfirmDialog(open);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkEmailMutation.isPending ? 'Sending Emails...' : 'Confirm Send Emails'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              {bulkEmailMutation.isPending && sendProgress ? (
                <div className="space-y-3">
                  <p className="text-center font-medium">
                    Sending email {sendProgress.current} of {sendProgress.total}...
                  </p>
                  <Progress 
                    value={(sendProgress.current / sendProgress.total) * 100} 
                    className="h-3"
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    Please wait, this may take a moment to avoid rate limits.
                  </p>
                </div>
              ) : (
                <>
                  <p>Are you sure you want to send email to:</p>
                  <ScrollArea className="max-h-[200px] border rounded-md p-3 bg-muted/50">
                    <ul className="space-y-1">
                      {selectedRecipients.map((booking: any) => (
                        <li key={booking.id} className="text-sm font-medium">
                          • {booking.customers?.first_name} {booking.customers?.last_name} ({booking.customers?.email})
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkEmailMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmSend}
              disabled={bulkEmailMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {bulkEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                'Confirm Send'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};