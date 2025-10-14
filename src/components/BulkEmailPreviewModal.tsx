import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [recipientType, setRecipientType] = useState<string>("");
  const [fromEmail, setFromEmail] = useState<string>("bookings@australianracingtours.com.au");
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());
  
  const bulkEmailMutation = useBulkBookingEmail();
  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();
  const { profile } = useAuth();
  const { data: userEmails } = useUserEmails();

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
          customers:lead_passenger_id (
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
  });

  // Get sample booking for preview
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['tour-bulk-email-data', tourId],
    queryFn: async () => {
      if (!tourId || !allBookingsData || allBookingsData.length === 0) return { sampleBooking: null };
      
      // Get first booking for preview
      const { data, error: sampleError } = await supabase
        .from('bookings')
        .select(`
          *,
          tours:tour_id (
            name, location, start_date, end_date, days, nights, pickup_point,
            notes, inclusions, exclusions, tour_host, price_single, price_double,
            deposit_required, final_payment_date, instalment_date, instalment_amount
          ),
          customers!lead_passenger_id (
            first_name, last_name, email, phone, city, state, country,
            spouse_name, dietary_requirements, notes
          ),
          secondary_contact:customers!secondary_contact_id (
            first_name, last_name, email, phone
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
        .eq('id', allBookingsData[0].id)
        .maybeSingle();

      if (sampleError) {
        console.error('Error fetching sample booking:', sampleError);
      }

      return { sampleBooking: data };
    },
    enabled: !!tourId && open && !!allBookingsData && allBookingsData.length > 0,
  });

  // Update preview when template changes
  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== "blank" && templates && bookingsData?.sampleBooking) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setOriginalSubjectTemplate(template.subject_template);
        setOriginalContentTemplate(template.content_template);
        
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
    if (bookingsData?.sampleBooking) {
      if (selectedTemplateId === "blank") {
        const customerName = bookingsData.sampleBooking.customers?.first_name || 'Customer';
        setOriginalSubjectTemplate(`Email for {{customer.first_name}}`);
        setOriginalContentTemplate(`Dear {{customer.first_name}},\n\n\n\nBest regards,\nYour Team`);
        
        setEditedSubject(`Email for ${customerName}`);
        setEditedContent(`Dear ${customerName},\n\n\n\nBest regards,\nYour Team`);
        setPreviewBooking(bookingsData.sampleBooking);
      }
    }
  }, [selectedTemplateId, bookingsData?.sampleBooking]);

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

  const handleSendEmails = async () => {
    if (!tourId || !selectedTemplateId || selectedBookingIds.size === 0) return;
    
    try {
      const subjectTemplate = originalSubjectTemplate || editedSubject;
      const contentTemplate = originalContentTemplate || editedContent;
      
      await bulkEmailMutation.mutateAsync({
        tourId,
        recipientType: 'selected',
        subjectTemplate,
        contentTemplate,
        fromEmail,
        selectedBookingIds: Array.from(selectedBookingIds)
      });
      onOpenChange(false);
      setSelectedBookingIds(new Set());
      setRecipientType("");
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  if (!tourId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>

        {isLoading || templatesLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading email preview...</span>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-hidden">
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
                  <Label>Select Recipients ({selectedBookingIds.size} selected):</Label>
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
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  {allBookingsLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allBookingsData?.map((booking: any) => {
                        const hasAccommodation = booking.hotel_bookings && booking.hotel_bookings.length > 0;
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
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
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
              <Label htmlFor="content">Email Content:</Label>
              <ScrollArea className="h-80 mt-2 border rounded-md">
                <Textarea
                  id="content"
                  value={editedContent}
                  onChange={(e) => {
                    setEditedContent(e.target.value);
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
                disabled={bulkEmailMutation.isPending || isLoading || selectedBookingIds.size === 0 || !editedContent.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {bulkEmailMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  `Send ${selectedBookingIds.size} Email${selectedBookingIds.size !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};