import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendBookingConfirmation } from "@/hooks/useBookingEmail";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Clock } from "lucide-react";
import { useScheduleEmail } from "@/hooks/useScheduledEmails";
import { ScheduleEmailDialog } from "@/components/ScheduleEmailDialog";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";
import { useUserEmails } from "@/hooks/useUserEmails";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  protectComplexEmailBlocksForEditor,
  registerEmailEditorBlots,
  resolveComplexEmailBlocksFromEditor,
} from "@/lib/emailEditorBlocks";

registerEmailEditorBlots(Quill);

interface EmailPreviewRecipient {
  name?: string | null;
  email?: string | null;
}

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  initialRecipient?: EmailPreviewRecipient | null;
}

export const EmailPreviewModal = ({ open, onOpenChange, bookingId, initialRecipient }: EmailPreviewModalProps) => {
  const [editedSubject, setEditedSubject] = useState("");
  const [editedContent, setEditedContent] = useState("");
  // Store original templates with merge fields for server-side processing
  const [originalSubjectTemplate, setOriginalSubjectTemplate] = useState("");
  const [originalContentTemplate, setOriginalContentTemplate] = useState("");
  // Track if user has manually edited the content (if so, send their edits as-is)
  const [userHasEdited, setUserHasEdited] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState<string>("bookings@australianracingtours.com.au");
  const [ccEmails, setCcEmails] = useState<string>("");
  const [bccEmails, setBccEmails] = useState<string>("");
  const sendEmail = useSendBookingConfirmation();
  const { data: emailTemplates, isLoading: templatesLoading } = useEmailTemplates();
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

  // Fast recipient query for immediate "To" field hydration
  const { data: recipientData, isLoading: isRecipientLoading, isError: hasRecipientError } = useQuery({
    queryKey: ['booking-email-recipient', bookingId],
    queryFn: async () => {
      if (!bookingId) return null;

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          customers:lead_passenger_id (first_name, last_name, email)
        `)
        .eq('id', bookingId)
        .maybeSingle();

      if (error) throw error;

      const leadPassenger = (data as any)?.customers;
      if (!leadPassenger?.email) return null;

      return {
        recipientEmail: leadPassenger.email as string,
        recipientName: `${leadPassenger.first_name ?? ''} ${leadPassenger.last_name ?? ''}`.trim(),
      };
    },
    enabled: !!bookingId && open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch full booking details for merge-field preview generation
  const { data: booking } = useQuery({
    queryKey: ['booking-email-preview', bookingId],
    queryFn: async () => {
      if (!bookingId) return null;

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          tours:tour_id (name, start_date, end_date, days, nights, location, pickup_point, notes, inclusions, exclusions, tour_host, price_single, price_double, deposit_required, final_payment_date, instalment_date, instalment_amount),
          customers!lead_passenger_id (first_name, last_name, email, phone, city, state, country, spouse_name, dietary_requirements, notes, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
          secondary_contact:customers!secondary_contact_id (first_name, last_name, email, phone),
          passenger_2:customers!passenger_2_id (first_name, last_name, email, phone, dietary_requirements, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
          passenger_3:customers!passenger_3_id (first_name, last_name, email, phone, dietary_requirements, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
          hotel_bookings (
            check_in_date,
            check_out_date,
            nights,
            room_type,
            room_upgrade,
            bedding,
            room_requests,
            confirmation_number,
            hotels (name, address, contact_name, contact_phone, contact_email, extra_night_price)
          ),
          activity_bookings (
            passengers_attending,
            activities (name, activity_date, start_time, end_time, location, contact_name, contact_phone, depart_for_activity, transport_mode, driver_name, driver_phone, transport_company, transport_contact_name, transport_phone, transport_email, activity_journeys (journey_number, pickup_time, pickup_location, destination, sort_order))
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bookingId && open,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Auto-select blank template as default
  useEffect(() => {
    if (selectedTemplateId === null) {
      setSelectedTemplateId("blank");
    }
  }, [selectedTemplateId]);

  // Generate email content when booking or template changes
  // IMPORTANT: Keep original templates with merge fields for server-side processing
  // The preview shows personalized content, but we send raw templates to the Edge Function
  // Populate template content when template selection changes (independent of booking data)
  useEffect(() => {
    setUserHasEdited(false);

    if (selectedTemplateId && selectedTemplateId !== "blank" && emailTemplates) {
      const template = emailTemplates.find(t => t.id === selectedTemplateId);
      if (template) {
        setOriginalSubjectTemplate(template.subject_template);
        setOriginalContentTemplate(template.content_template);

        if (booking) {
          const mergeData = EmailTemplateEngine.convertBookingToMergeData(booking);
          const processedSubject = EmailTemplateEngine.processTemplate(template.subject_template, mergeData);
          const processedContent = EmailTemplateEngine.processTemplate(template.content_template, mergeData);
          setEditedSubject(processedSubject);
          setEditedContent(processedContent);
        } else {
          setEditedSubject(template.subject_template);
          setEditedContent(template.content_template);
        }
      }
    } else {
      const defaultSubjectTemplate = `Email for {{customer_first_name}}`;
      const defaultContentTemplate = `<p>Dear {{customer_first_name}},</p><p><br></p><p><br></p><p>Best regards,<br>Your Team</p>`;
      setOriginalSubjectTemplate(defaultSubjectTemplate);
      setOriginalContentTemplate(defaultContentTemplate);

      if (booking) {
        const defaultSubject = `Email for ${booking.customers?.first_name || 'Customer'}`;
        const defaultContent = `<p>Dear ${booking.customers?.first_name || 'Customer'},</p><p><br></p><p><br></p><p>Best regards,<br>Your Team</p>`;
        setEditedSubject(defaultSubject);
        setEditedContent(defaultContent);
      } else {
        setEditedSubject(defaultSubjectTemplate);
        setEditedContent(defaultContentTemplate);
      }
    }
  }, [selectedTemplateId, emailTemplates, booking]);

  const handleSendEmail = async () => {
    if (!bookingId) return;
    
    try {
      // IMPORTANT: If user hasn't edited, send original templates with merge fields.
      // The Edge Function will process these with proper recipient-specific data.
      // This ensures lead passenger gets correct data and additional passengers get personalized emails.
      // If user has edited, originalSubjectTemplate/originalContentTemplate have been updated
      // to match their edits, so we send those.
      const subjectToSend = originalSubjectTemplate || editedSubject;
      const contentToSend = originalContentTemplate || editedContent;
      
      console.log('[EmailPreviewModal] Sending email:', { 
        userHasEdited, 
        hasOriginalTemplate: !!originalContentTemplate,
        subjectPreview: subjectToSend.substring(0, 50) 
      });
      
      await sendEmail.mutateAsync({
        bookingId,
        customSubject: subjectToSend,
        customContent: contentToSend,
        fromEmail,
        ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
        bccEmails: bccEmails.split(',').map(e => e.trim()).filter(Boolean),
        emailTemplateId: selectedTemplateId && selectedTemplateId !== "blank" ? selectedTemplateId : undefined,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const fallbackRecipient = initialRecipient?.email
    ? {
        recipientEmail: initialRecipient.email,
        recipientName: initialRecipient.name?.trim() || initialRecipient.email,
      }
    : null;

  const activeRecipient = recipientData ?? fallbackRecipient;

  const recipientDisplayValue = activeRecipient
    ? `${activeRecipient.recipientName} <${activeRecipient.recipientEmail}>`
    : isRecipientLoading
      ? 'Loading recipient...'
      : hasRecipientError
        ? 'Unable to load recipient'
        : 'No recipient email available';

  if (!bookingId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Email Preview & Approval</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {templatesLoading && !editedSubject && !editedContent ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading email editor...</span>
          </div>
        ) : (editedContent || editedSubject || booking) ? (
          <div className="flex-1 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-4 p-1">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="template">Email Template:</Label>
                <Select value={selectedTemplateId || ""} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">Blank Email</SelectItem>
                    {emailTemplates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fromEmail">From Email:</Label>
                <Select value={fromEmail} onValueChange={setFromEmail}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bookings@australianracingtours.com.au">
                      bookings@australianracingtours.com.au
                    </SelectItem>
                    <SelectItem value="info@australianracingtours.com.au">
                      info@australianracingtours.com.au
                    </SelectItem>
                    {userEmails?.map((email) => (
                      <SelectItem key={email} value={email}>
                        {email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recipient">To:</Label>
                <Input
                  id="recipient"
                  value={recipientDisplayValue}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>

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

            <div>
              <Label htmlFor="subject">Subject:</Label>
              <Input
                id="subject"
                value={editedSubject}
                onChange={(e) => {
                  setEditedSubject(e.target.value);
                  setUserHasEdited(true);
                  // When user edits, update the original template as well
                  // This means user edits will be sent as-is (already personalized)
                  setOriginalSubjectTemplate(e.target.value);
                }}
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="content">Email Content:</Label>
              <div className="mt-2 border rounded-md">
                <ReactQuill
                  theme="snow"
                  value={protectComplexEmailBlocksForEditor(editedContent)}
                  onChange={(value) => {
                    const resolvedValue = resolveComplexEmailBlocksFromEditor(value);
                    if (resolvedValue === editedContent) return;
                    setEditedContent(resolvedValue);
                    setUserHasEdited(true);
                    // When user edits, update the original template as well
                    // This means user edits will be sent as-is (already personalized)
                    setOriginalContentTemplate(resolvedValue);
                  }}
                  modules={quillModules}
                  className="bg-white"
                  style={{ minHeight: '300px' }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sendEmail.isPending || !editedContent.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendEmail.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  'Approve & Send Email'
                )}
              </Button>
            </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No booking data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};