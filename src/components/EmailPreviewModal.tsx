import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendBookingConfirmation } from "@/hooks/useBookingEmail";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";
import { useAuth } from "@/hooks/useAuth";
import { useUserEmails } from "@/hooks/useUserEmails";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
}

interface BookingEmailData {
  subject: string;
  recipientEmail: string;
  recipientName: string;
  htmlContent: string;
}

export const EmailPreviewModal = ({ open, onOpenChange, bookingId }: EmailPreviewModalProps) => {
  const [emailData, setEmailData] = useState<BookingEmailData | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState<string>("bookings@australianracingtours.com.au");
  const [ccEmails, setCcEmails] = useState<string>("");
  const [bccEmails, setBccEmails] = useState<string>("");
  const sendEmail = useSendBookingConfirmation();
  const { data: emailTemplates, isLoading: templatesLoading } = useEmailTemplates();
  const { profile } = useAuth();
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

  // Fetch booking details to generate email preview
  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-email-preview', bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          tours:tour_id (name, start_date, end_date, days, nights, location, pickup_point, notes, inclusions, exclusions, tour_host, price_single, price_double, deposit_required, final_payment_date, instalment_date, instalment_amount),
          customers!lead_passenger_id (first_name, last_name, email, phone, city, state, country, spouse_name, dietary_requirements, notes),
          secondary_contact:customers!secondary_contact_id (first_name, last_name, email, phone),
          hotel_bookings (
            check_in_date,
            check_out_date,
            nights,
            room_type,
            room_upgrade,
            bedding,
            room_requests,
            confirmation_number,
            hotels (name, address, contact_name, contact_phone, contact_email)
          ),
          activity_bookings (
            passengers_attending,
            activities (name, activity_date, start_time, end_time, pickup_time, location, guide_name, guide_phone)
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bookingId && open,
  });

  // Auto-select blank template as default
  useEffect(() => {
    if (selectedTemplateId === null) {
      setSelectedTemplateId("blank");
    }
  }, [selectedTemplateId]);

  // Generate email content when booking or template changes
  useEffect(() => {
    if (booking) {
      const recipientEmail = booking.customers?.email || '';
      const recipientName = `${booking.customers?.first_name} ${booking.customers?.last_name}`;

      if (selectedTemplateId && selectedTemplateId !== "blank" && emailTemplates) {
        const template = emailTemplates.find(t => t.id === selectedTemplateId);
        if (template) {
          // Convert booking data to merge format
          const mergeData = EmailTemplateEngine.convertBookingToMergeData(booking);

          // Process template with merge data
          const processedSubject = EmailTemplateEngine.processTemplate(template.subject_template, mergeData);
          const processedContent = EmailTemplateEngine.processTemplate(template.content_template, mergeData);

          setEmailData({
            subject: processedSubject,
            recipientEmail,
            recipientName,
            htmlContent: processedContent
          });
          setEditedSubject(processedSubject);
          setEditedContent(processedContent);
        }
      } else {
        // Default blank email template - convert line breaks to HTML
        const defaultSubject = `Email for ${recipientName}`;
        const defaultContent = `<p>Dear ${booking.customers?.first_name || 'Customer'},</p><p><br></p><p><br></p><p>Best regards,<br>Your Team</p>`;

        setEmailData({
          subject: defaultSubject,
          recipientEmail,
          recipientName,
          htmlContent: defaultContent
        });
        setEditedSubject(defaultSubject);
        setEditedContent(defaultContent);
      }
    }
  }, [booking, selectedTemplateId, emailTemplates]);

  const handleSendEmail = async () => {
    if (!bookingId) return;
    
    try {
      await sendEmail.mutateAsync({
        bookingId,
        customSubject: editedSubject,
        customContent: editedContent,
        fromEmail,
        ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
        bccEmails: bccEmails.split(',').map(e => e.trim()).filter(Boolean),
      });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  if (!bookingId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Email Preview & Approval</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading email preview...</span>
          </div>
        ) : emailData ? (
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
                  value={`${emailData.recipientName} <${emailData.recipientEmail}>`}
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
                onChange={(e) => setEditedSubject(e.target.value)}
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="content">Email Content:</Label>
              <div className="mt-2 border rounded-md">
                <ReactQuill
                  theme="snow"
                  value={editedContent}
                  onChange={setEditedContent}
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