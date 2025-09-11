import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useBulkBookingEmail } from "@/hooks/useBulkBookingEmail";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmailTemplateEngine, type EmailMergeData } from "@/utils/emailTemplateEngine";

interface BulkEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
}

export const BulkEmailPreviewModal = ({ open, onOpenChange, tourId }: BulkEmailPreviewModalProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [editedSubject, setEditedSubject] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [previewBooking, setPreviewBooking] = useState<any>(null);
  
  const bulkEmailMutation = useBulkBookingEmail();
  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();

  // Get bookings with emails for this tour and sample booking for preview
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['tour-bulk-email-data', tourId],
    queryFn: async () => {
      if (!tourId) return { count: 0, sampleBooking: null };
      
      // Get bookings with email addresses for this tour
      const { data: bookingsWithEmails, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          customers:lead_passenger_id!inner (
            email
          )
        `)
        .eq('tour_id', tourId)
        .not('customers.email', 'is', null);

      if (bookingsError) {
        console.error('Error fetching bookings with emails:', bookingsError);
        throw bookingsError;
      }

      const count = bookingsWithEmails?.length || 0;

      // Get sample booking for preview if we have bookings
      let sampleBooking = null;
      if (count > 0) {
        const { data, error: sampleError } = await supabase
          .from('bookings')
          .select(`
            *,
            tours:tour_id (
              name, location, start_date, end_date, days, nights, pickup_point,
              notes, inclusions, exclusions, tour_host, price_single, price_double,
              deposit_required, final_payment_date, instalment_date, instalment_amount
            ),
            customers:lead_passenger_id (
              first_name, last_name, email, phone, city, state, country,
              spouse_name, dietary_requirements, notes
            ),
            hotel_bookings (
              check_in_date, check_out_date, nights, room_type, bedding,
              room_upgrade, room_requests, confirmation_number,
              hotels (name, address, contact_name, contact_phone, contact_email)
            ),
            activity_bookings (
              passengers_attending,
              activities (name, activity_date, start_time, end_time, pickup_time, location, guide_name, guide_phone)
            )
          `)
          .eq('tour_id', tourId)
          .not('customers.email', 'is', null)
          .limit(1)
          .maybeSingle();

        if (sampleError) {
          console.error('Error fetching sample booking:', sampleError);
        } else {
          sampleBooking = data;
        }
      }

      return { 
        count, 
        sampleBooking 
      };
    },
    enabled: !!tourId && open,
  });

  // Update preview when template changes
  useEffect(() => {
    console.log('Template or booking data changed:', { 
      selectedTemplateId, 
      hasTemplates: !!templates, 
      hasSampleBooking: !!bookingsData?.sampleBooking,
      bookingCount: bookingsData?.count 
    });
    
    if (selectedTemplateId && selectedTemplateId !== "blank" && templates && bookingsData?.sampleBooking) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        console.log('Processing template:', template.name);
        const mergeData = EmailTemplateEngine.convertBookingToMergeData(bookingsData.sampleBooking);
        const processedSubject = EmailTemplateEngine.processTemplate(template.subject_template, mergeData);
        const processedContent = EmailTemplateEngine.processTemplate(template.content_template, mergeData);
        
        setEditedSubject(processedSubject);
        setEditedContent(processedContent);
        setPreviewBooking(bookingsData.sampleBooking);
      }
    }
  }, [selectedTemplateId, templates, bookingsData?.sampleBooking]);

  // Auto-select blank template
  useEffect(() => {
    if (templates && !selectedTemplateId) {
      setSelectedTemplateId("blank");
    }
  }, [templates, selectedTemplateId]);

  // Generate content when template or booking changes
  useEffect(() => {
    console.log('Blank template effect triggered:', { 
      selectedTemplateId, 
      hasSampleBooking: !!bookingsData?.sampleBooking 
    });
    
    if (bookingsData?.sampleBooking) {
      if (selectedTemplateId === "blank") {
        const customerName = bookingsData.sampleBooking.customers?.first_name || 'Customer';
        console.log('Setting blank template content for customer:', customerName);
        setEditedSubject(`Email for ${customerName}`);
        setEditedContent(`Dear ${customerName},\n\n\n\nBest regards,\nYour Team`);
        setPreviewBooking(bookingsData.sampleBooking);
      }
    }
  }, [selectedTemplateId, bookingsData?.sampleBooking]);

  const handleSendEmails = async () => {
    if (!tourId || !selectedTemplateId) return;
    
    try {
      await bulkEmailMutation.mutateAsync({
        tourId,
        customSubject: editedSubject,
        customContent: editedContent
      });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  if (!tourId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Email Preview & Send</DialogTitle>
        </DialogHeader>

        {isLoading || templatesLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading email preview...</span>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-hidden">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="template">Email Template:</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label>Recipients:</Label>
                <div className="flex items-center h-9 px-3 border rounded-md bg-muted">
                  <span className="text-sm">
                    {bookingsData?.count || 0} booking{(bookingsData?.count || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
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
              <Label htmlFor="subject">Subject Line:</Label>
              <Input
                id="subject"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="content">Email Content:</Label>
              <ScrollArea className="h-80 mt-2 border rounded-md">
                <Textarea
                  id="content"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[300px] border-0 resize-none"
                  placeholder="Email content..."
                />
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
                onClick={handleSendEmails}
                disabled={bulkEmailMutation.isPending || isLoading || !bookingsData?.count || !editedContent.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {bulkEmailMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  `Send ${bookingsData?.count || 0} Email${(bookingsData?.count || 0) !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};