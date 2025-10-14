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
import { useAuth } from "@/hooks/useAuth";
import { useUserEmails } from "@/hooks/useUserEmails";

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
  const [previewBooking, setPreviewBooking] = useState<any>(null);
  const [recipientType, setRecipientType] = useState<string>("with_accommodation");
  const [fromEmail, setFromEmail] = useState<string>("bookings@australianracingtours.com.au");
  
  const bulkEmailMutation = useBulkBookingEmail();
  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();
  const { profile } = useAuth();
  const { data: userEmails } = useUserEmails();

  // Get bookings with emails for this tour and sample booking for preview
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['tour-bulk-email-data', tourId],
    queryFn: async () => {
      if (!tourId) return { count: 0, sampleBooking: null };
      
      // Get bookings with accommodation (have hotel_bookings)
      const { data: accommodationBookings, error: accommError } = await supabase
        .from('bookings')
        .select(`
          id,
          accommodation_required,
          customers:lead_passenger_id!inner (
            email
          ),
          hotel_bookings!inner (
            id
          )
        `)
        .eq('tour_id', tourId)
        .neq('status', 'cancelled')
        .not('customers.email', 'is', null);

      // Get bookings without accommodation (no hotel_bookings or accommodation_required = false)
      const { data: activityOnlyBookings, error: activityError } = await supabase
        .from('bookings')
        .select(`
          id,
          accommodation_required,
          customers:lead_passenger_id!inner (
            email
          ),
          hotel_bookings (
            id
          )
        `)
        .eq('tour_id', tourId)
        .neq('status', 'cancelled')
        .eq('accommodation_required', false)
        .not('customers.email', 'is', null);

      if (accommError) {
        console.error('Error fetching accommodation bookings:', accommError);
        throw accommError;
      }
      if (activityError) {
        console.error('Error fetching activity-only bookings:', activityError);
        throw activityError;
      }

      const accommodationCount = accommodationBookings?.length || 0;
      const activityOnlyCount = activityOnlyBookings?.filter(booking => 
        !booking.hotel_bookings || booking.hotel_bookings.length === 0
      ).length || 0;

      // Get sample booking based on selected recipient type
      let sampleBooking = null;
      const targetBookings = recipientType === "with_accommodation" ? accommodationBookings : activityOnlyBookings;
      
      if (targetBookings && targetBookings.length > 0) {
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
          .eq('id', targetBookings[0].id)
          .maybeSingle();

        if (sampleError) {
          console.error('Error fetching sample booking:', sampleError);
        } else {
          sampleBooking = data;
        }
      }

      return { 
        accommodationCount,
        activityOnlyCount,
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
        console.log('Sample booking hotel_bookings:', bookingsData.sampleBooking.hotel_bookings);
        
        // Store original templates for mail merge
        setOriginalSubjectTemplate(template.subject_template);
        setOriginalContentTemplate(template.content_template);
        
        // Process for preview only
        const mergeData = EmailTemplateEngine.convertBookingToMergeData(bookingsData.sampleBooking);
        console.log('Merge data hotel_bookings array:', mergeData.hotel_bookings);
        console.log('Template content contains hotel_bookings loop:', template.content_template.includes('{{#hotel_bookings}}'));
        
        const processedSubject = EmailTemplateEngine.processTemplate(template.subject_template, mergeData);
        const processedContent = EmailTemplateEngine.processTemplate(template.content_template, mergeData);
        
        console.log('Processed content preview:', processedContent.substring(0, 300));
        
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
        // Store original templates for mail merge (with placeholders)
        setOriginalSubjectTemplate(`Email for {{customer.first_name}}`);
        setOriginalContentTemplate(`Dear {{customer.first_name}},\n\n\n\nBest regards,\nYour Team`);
        
        // Set preview content (processed)
        setEditedSubject(`Email for ${customerName}`);
        setEditedContent(`Dear ${customerName},\n\n\n\nBest regards,\nYour Team`);
        setPreviewBooking(bookingsData.sampleBooking);
      }
    }
  }, [selectedTemplateId, bookingsData?.sampleBooking]);

  const getCurrentCount = () => {
    return recipientType === "with_accommodation" 
      ? bookingsData?.accommodationCount || 0 
      : bookingsData?.activityOnlyCount || 0;
  };

  const handleSendEmails = async () => {
    if (!tourId || !selectedTemplateId || !recipientType) return;
    
    try {
      // Use original templates with placeholders for mail merge, or edited content if manually modified
      const subjectTemplate = originalSubjectTemplate || editedSubject;
      const contentTemplate = originalContentTemplate || editedContent;
      
      await bulkEmailMutation.mutateAsync({
        tourId,
        recipientType,
        subjectTemplate,
        contentTemplate,
        fromEmail
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
            <div className="grid grid-cols-4 gap-4">
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
                <Label>Recipients:</Label>
                <Select value={recipientType} onValueChange={setRecipientType}>
                  <SelectTrigger className="bg-background border z-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="with_accommodation">
                      {bookingsData?.accommodationCount || 0} booking{(bookingsData?.accommodationCount || 0) !== 1 ? 's' : ''} with accommodation
                    </SelectItem>
                    <SelectItem value="activities_only">
                      {bookingsData?.activityOnlyCount || 0} booking{(bookingsData?.activityOnlyCount || 0) !== 1 ? 's' : ''} with activities only
                    </SelectItem>
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
                onChange={(e) => {
                  setEditedSubject(e.target.value);
                  // Update original template when manually edited
                  setOriginalSubjectTemplate(e.target.value);
                }}
                placeholder="Email subject..."
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="content">Email Content:</Label>
              <ScrollArea className="h-80 mt-2 border rounded-md">
                <Textarea
                  id="content"
                  value={editedContent}
                  onChange={(e) => {
                    setEditedContent(e.target.value);
                    // Update original template when manually edited
                    setOriginalContentTemplate(e.target.value);
                  }}
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
                disabled={bulkEmailMutation.isPending || isLoading || !getCurrentCount() || !editedContent.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {bulkEmailMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  `Send ${getCurrentCount()} Email${getCurrentCount() !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};