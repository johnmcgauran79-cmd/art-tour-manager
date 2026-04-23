import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkBookingEmail } from "@/hooks/useBulkBookingEmail";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useScheduleEmail } from "@/hooks/useScheduledEmails";
import { useCustomForms } from "@/hooks/useCustomForms";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserEmails } from "@/hooks/useUserEmails";
import { ScheduleEmailDialog } from "@/components/ScheduleEmailDialog";
import { PendingEmailPreviewModal } from "@/components/operations/PendingEmailPreviewModal";
import { EmailAttachmentPicker, type EmailAttachment } from "@/components/email/EmailAttachmentPicker";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  protectComplexEmailBlocksForEditor,
  registerEmailEditorBlots,
  resolveComplexEmailBlocksFromEditor,
} from "@/lib/emailEditorBlocks";

registerEmailEditorBlots(Quill);

interface BulkEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
  /**
   * Optional: when the modal opens, auto-select the default email template
   * matching this `type` value (e.g. 'custom_form_request'). Lets entry points
   * outside the Bookings tab open this modal pre-configured for a specific
   * use case (Send Form Requests from the Forms tab, etc.).
   */
  initialTemplateType?: string;
  /**
   * Optional: when opening pre-configured for a Custom Form Request, pre-select
   * this published form id so the user lands directly on the editor.
   */
  initialFormId?: string;
}

export const BulkEmailPreviewModal = ({ open, onOpenChange, tourId, initialTemplateType, initialFormId }: BulkEmailPreviewModalProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
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
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [hideCompletedForm, setHideCompletedForm] = useState(false);
  
  const scheduleEmailMutation = useScheduleEmail();
  const bulkEmailMutation = useBulkBookingEmail((current, total) => {
    setSendProgress({ current, total });
  });
  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();
  const { data: userEmails } = useUserEmails();
  const { forms: tourForms } = useCustomForms(tourId || "");
  const publishedForms = (tourForms || []).filter((f: any) => f.is_published);

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);
  const isCustomFormTemplate = selectedTemplate?.type === 'custom_form_request';
  const selectedForm = publishedForms.find((f: any) => f.id === selectedFormId);

  // When opened with an `initialTemplateType` (e.g. from the Forms tab's
  // "Send Form Requests" button), auto-select the default template of that
  // type and pre-select the requested form so the user lands directly in the
  // edit/preview/attachments flow.
  useEffect(() => {
    if (!open || !initialTemplateType || !templates) return;
    if (selectedTemplateId) return;
    const match =
      templates.find((t: any) => t.type === initialTemplateType && t.is_default) ||
      templates.find((t: any) => t.type === initialTemplateType);
    if (match) setSelectedTemplateId(match.id);
  }, [open, initialTemplateType, templates, selectedTemplateId]);

  useEffect(() => {
    if (!open || !initialFormId) return;
    setSelectedFormId(initialFormId);
  }, [open, initialFormId]);

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

  // For custom-form templates, fetch existing responses so we can show
  // completion status and offer an "incomplete only" filter.
  const { data: completedBookingIds } = useQuery({
    queryKey: ['tour-custom-form-completed-bookings', tourId, selectedFormId, selectedForm?.response_mode],
    queryFn: async () => {
      if (!tourId || !selectedFormId || !selectedForm) return new Set<string>();
      const { data: responses } = await supabase
        .from('tour_custom_form_responses' as any)
        .select('booking_id, passenger_slot')
        .eq('form_id', selectedFormId);

      const completed = new Set<string>();
      if (!responses || responses.length === 0) return completed;

      const bySlot = new Map<string, Set<number>>();
      for (const r of responses as any[]) {
        if (!bySlot.has(r.booking_id)) bySlot.set(r.booking_id, new Set());
        bySlot.get(r.booking_id)!.add(r.passenger_slot);
      }

      const responseMode = (selectedForm as any).response_mode;
      for (const b of (allBookingsData || []) as any[]) {
        const slots = bySlot.get(b.id);
        if (!slots) continue;
        if (responseMode === 'per_booking') {
          if (slots.has(1)) completed.add(b.id);
        } else {
          // per_passenger: every passenger with an email must have a response
          let allDone = true;
          if (b.customers?.email && !slots.has(1)) allDone = false;
          if (b.passenger_2?.email && !slots.has(2)) allDone = false;
          if (b.passenger_3?.email && !slots.has(3)) allDone = false;
          if (allDone && b.customers?.email) completed.add(b.id);
        }
      }
      return completed;
    },
    enabled: !!tourId && !!selectedFormId && !!selectedForm && !!allBookingsData && open,
    staleTime: 30 * 1000,
  });

  // Visible bookings respect the "hide completed" toggle for custom forms.
  const visibleBookings = (() => {
    if (!allBookingsData) return [];
    if (!isCustomFormTemplate || !hideCompletedForm || !completedBookingIds) {
      return allBookingsData;
    }
    return allBookingsData.filter((b: any) => !completedBookingIds.has(b.id));
  })();

  const incompleteCount = isCustomFormTemplate && completedBookingIds && allBookingsData
    ? allBookingsData.filter((b: any) => !completedBookingIds.has(b.id)).length
    : 0;

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

  // When switching to/from a custom-form template, reset the chosen form and
  // auto-pick the only published form if there's exactly one.
  useEffect(() => {
    if (!isCustomFormTemplate) {
      setSelectedFormId("");
      return;
    }
    if (publishedForms.length === 1) {
      setSelectedFormId(publishedForms[0].id);
    } else {
      setSelectedFormId("");
    }
  }, [isCustomFormTemplate, publishedForms.length]);

  // When the selected form is "lead_only", default the additional-passengers
  // toggle off so the per-booking expansion mirrors the form's setting. Users
  // can still override.
  useEffect(() => {
    if (!isCustomFormTemplate || !selectedForm) return;
    const recipients = (selectedForm as any).email_recipients || 'all_passengers';
    setIncludeAdditionalPassengers(recipients === 'all_passengers');
  }, [isCustomFormTemplate, selectedForm?.id]);

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
    } else if (type === "incomplete_form") {
      if (!completedBookingIds) return;
      const incompleteIds = allBookingsData
        .filter((b: any) => !completedBookingIds.has(b.id))
        .map((b: any) => b.id);
      setSelectedBookingIds(new Set(incompleteIds));
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
    setSelectedFormId("");
    onOpenChange(false);
  };

  const handleSendClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSend = async () => {
    if (!tourId || !selectedTemplateId || selectedBookingIds.size === 0) return;
    if (isCustomFormTemplate && !selectedFormId) return;
    
    // Reset progress
    setSendProgress(null);
    
    try {
      // Use the edited values - these reflect any changes the user made in the editor
      const subjectTemplate = editedSubject;
      const contentTemplate = editedContent;
      
      console.log(`[Bulk Email UI] Starting bulk send for tour ${tourId} to ${selectedBookingIds.size} bookings`);
      
      const result = await bulkEmailMutation.mutateAsync({
        tourId,
        recipientType: 'selected',
        subjectTemplate,
        contentTemplate,
        fromEmail,
        ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
        bccEmails: bccEmails.split(',').map(e => e.trim()).filter(Boolean),
        selectedBookingIds: Array.from(selectedBookingIds),
        includeAdditionalPassengers,
        emailTemplateId: selectedTemplateId || undefined,
        customFormId: isCustomFormTemplate ? selectedFormId : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      
      console.log(`[Bulk Email UI] Send complete:`, result);
      
      // Brief delay so user sees completion before modal closes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Close dialogs sequentially to prevent Radix from leaving pointer-events:none on body
      setShowConfirmDialog(false);
      setSendProgress(null);
      await new Promise(resolve => setTimeout(resolve, 150));
      onOpenChange(false);
      setSelectedBookingIds(new Set());
      setRecipientType("");
      
      // Safety: ensure body isn't stuck with pointer-events:none from Radix
      setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 300);
    } catch (error) {
      console.error('[Bulk Email UI] Send error:', error);
      setShowConfirmDialog(false);
      setSendProgress(null);
      // Safety: ensure body isn't stuck with pointer-events:none from Radix
      setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 300);
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
          <DialogTitle>Send Email</DialogTitle>
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
                {isCustomFormTemplate && (
                  <div>
                    <Label htmlFor="custom-form">
                      Form to Send: <span className="text-destructive">*</span>
                    </Label>
                    {publishedForms.length === 0 ? (
                      <div className="flex items-center h-9 px-3 border rounded-md bg-muted text-sm text-muted-foreground">
                        No published forms on this tour
                      </div>
                    ) : (
                      <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                        <SelectTrigger className="bg-background border z-50">
                          <SelectValue placeholder="Choose a form..." />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {publishedForms.map((f: any) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.form_title}
                              <span className="text-xs text-muted-foreground ml-2">
                                · {(f.email_recipients || 'all_passengers') === 'lead_only' ? 'Lead only' : 'All passengers'}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {selectedForm && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Each passenger gets a unique secure link — use <code className="text-xs">{`{{custom_form_button}}`}</code> in the content.
                      </p>
                    )}
                  </div>
                )}
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
                    {isCustomFormTemplate && selectedFormId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRecipientTypeChange("incomplete_form")}
                        className="text-xs"
                        title="Select only bookings that haven't completed this form"
                      >
                        Incomplete ({incompleteCount})
                      </Button>
                    )}
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
                      {visibleBookings.map((booking: any) => {
                        const hasAccommodation = booking.hotel_bookings && booking.hotel_bookings.length > 0;
                        const hasAdditionalPax = booking.passenger_2?.email || booking.passenger_3?.email;
                        const isFormCompleted = isCustomFormTemplate && completedBookingIds?.has(booking.id);
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
                                {isFormCompleted && (
                                  <span className="ml-2 text-green-600 font-medium">✓ Done</span>
                                )}
                              </span>
                            </label>
                          </div>
                        );
                      })}
                      {visibleBookings.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          {hideCompletedForm
                            ? 'All bookings have completed this form.'
                            : 'No bookings found.'}
                        </p>
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Hide-completed toggle (only for custom form requests) */}
                {isCustomFormTemplate && selectedFormId && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="hideCompletedForm"
                      checked={hideCompletedForm}
                      onCheckedChange={(checked) => setHideCompletedForm(checked === true)}
                    />
                    <label
                      htmlFor="hideCompletedForm"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Hide bookings that already completed this form
                      {completedBookingIds && completedBookingIds.size > 0 && (
                        <span className="text-muted-foreground font-normal ml-1">
                          — {completedBookingIds.size} completed
                        </span>
                      )}
                    </label>
                  </div>
                )}
                
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
                  value={protectComplexEmailBlocksForEditor(editedContent)}
                  onChange={(content) => {
                    const resolvedContent = resolveComplexEmailBlocksFromEditor(content);
                    if (resolvedContent === editedContent) return;
                    setEditedContent(resolvedContent);
                    setOriginalContentTemplate(resolvedContent);
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

            <EmailAttachmentPicker
              tourId={tourId}
              attachments={attachments}
              onChange={setAttachments}
              disabled={bulkEmailMutation.isPending}
            />

            <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreviewModal(true)}
                disabled={!editedContent.trim() || !previewBooking}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowScheduleDialog(true)}
                disabled={bulkEmailMutation.isPending || selectedBookingIds.size === 0 || !editedContent.trim() || isCustomFormTemplate}
                title={isCustomFormTemplate ? 'Scheduling is not yet supported for Custom Form Requests — send immediately.' : undefined}
              >
                <Clock className="h-4 w-4 mr-1" />
                Schedule
              </Button>
              <Button
                onClick={handleSendClick}
                disabled={bulkEmailMutation.isPending || selectedBookingIds.size === 0 || !editedContent.trim() || (isCustomFormTemplate && !selectedFormId)}
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
              onClick={(e) => {
                e.preventDefault();
                handleConfirmSend();
              }}
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

      {/* Schedule Email Dialog */}
      <ScheduleEmailDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        emailCount={selectedBookingIds.size}
        isPending={scheduleEmailMutation.isPending}
        onSchedule={async (scheduledAt) => {
          if (!tourId) return;
          const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);
          await scheduleEmailMutation.mutateAsync({
            bookingIds: Array.from(selectedBookingIds),
            tourId,
            scheduledSendAt: scheduledAt,
            emailPayload: {
              customSubject: editedSubject,
              customContent: editedContent,
              fromEmail,
              ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
              bccEmails: bccEmails.split(',').map(e => e.trim()).filter(Boolean),
              includeAdditionalPassengers,
              emailTemplateId: selectedTemplateId || undefined,
              emailTemplateName: selectedTemplate?.name || 'Custom',
              attachments: attachments.length > 0 ? attachments : undefined,
            },
          });
          setShowScheduleDialog(false);
          onOpenChange(false);
          setSelectedBookingIds(new Set());
          setRecipientType("");
        }}
      />

      {/* Email Preview Modal */}
      {tourId && (
        <PendingEmailPreviewModal
          open={showPreviewModal}
          onOpenChange={setShowPreviewModal}
          tourId={tourId}
          templateSubject={editedSubject}
          templateContent={editedContent}
          templateFrom={fromEmail}
          ruleName={templates?.find(t => t.id === selectedTemplateId)?.name || 'Custom Email'}
          previewBookingId={previewBooking?.id}
        />
      )}
    </Dialog>
  );
};