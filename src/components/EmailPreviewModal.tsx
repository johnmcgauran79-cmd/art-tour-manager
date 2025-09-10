import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendBookingConfirmation } from "@/hooks/useBookingEmail";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";

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
  const sendEmail = useSendBookingConfirmation();
  const { data: emailTemplates, isLoading: templatesLoading } = useEmailTemplates();

  // Fetch booking details to generate email preview
  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-email-preview', bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          tours:tour_id (name, start_date, end_date, location),
          customers:lead_passenger_id (first_name, last_name, email),
          hotel_bookings (
            check_in_date,
            check_out_date,
            room_type,
            room_upgrade,
            bedding,
            hotels (name)
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bookingId && open,
  });

  // Auto-select default template on load
  useEffect(() => {
    if (emailTemplates && emailTemplates.length > 0 && !selectedTemplateId) {
      const defaultTemplate = emailTemplates.find(t => t.is_default) || emailTemplates[0];
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [emailTemplates, selectedTemplateId]);

  // Generate email content when booking or template changes
  useEffect(() => {
    if (booking && selectedTemplateId && emailTemplates) {
      const template = emailTemplates.find(t => t.id === selectedTemplateId);
      if (!template) return;

      const recipientEmail = booking.customers?.email || '';
      const recipientName = `${booking.customers?.first_name} ${booking.customers?.last_name}`;

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
  }, [booking, selectedTemplateId, emailTemplates]);

  const handleSendEmail = async () => {
    if (!bookingId) return;
    
    try {
      await sendEmail.mutateAsync({
        bookingId,
        customSubject: editedSubject,
        customContent: editedContent
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
          <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
            <div className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template">Email Template:</Label>
                <Select value={selectedTemplateId || ""} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
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
              <Label htmlFor="subject">Subject:</Label>
              <Input
                id="subject"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="content">Email Content:</Label>
              <ScrollArea className="h-64 mt-2 border rounded-md">
                <Textarea
                  id="content"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[240px] border-0 resize-none"
                  placeholder="Email content..."
                />
              </ScrollArea>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Preview:</h4>
              <ScrollArea className="h-32 bg-white p-3 rounded border">
                <pre className="text-sm whitespace-pre-wrap font-sans">
                  {editedContent}
                </pre>
              </ScrollArea>
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
          </ScrollArea>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No booking data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};