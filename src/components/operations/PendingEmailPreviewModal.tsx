import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";

interface PendingEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  templateSubject: string;
  templateContent: string;
  templateFrom: string;
  ruleName: string;
}

export const PendingEmailPreviewModal = ({
  open,
  onOpenChange,
  tourId,
  templateSubject,
  templateContent,
  templateFrom,
  ruleName,
}: PendingEmailPreviewModalProps) => {
  // Fetch one non-cancelled booking from the tour with full data for merge
  const { data: booking, isLoading } = useQuery({
    queryKey: ['pending-email-preview-booking', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          tours:tour_id (name, start_date, end_date, days, nights, location, pickup_point, notes, inclusions, exclusions, tour_host, price_single, price_double, deposit_required, final_payment_date, instalment_date, instalment_amount, travel_documents_required, pickup_location_required, tour_type),
          customers!lead_passenger_id (first_name, last_name, email, phone, city, state, country, spouse_name, dietary_requirements, notes, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email),
          secondary_contact:customers!secondary_contact_id (first_name, last_name, email, phone),
          passenger_2:customers!passenger_2_id (first_name, last_name, email, phone, dietary_requirements, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email),
          passenger_3:customers!passenger_3_id (first_name, last_name, email, phone, dietary_requirements, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email),
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
            activities (name, activity_date, start_time, end_time, location, contact_name, contact_phone, depart_for_activity, transport_mode, driver_name, driver_phone, transport_company, transport_contact_name, transport_phone, transport_email, activity_journeys (journey_number, pickup_time, pickup_location, destination, sort_order))
          )
        `)
        .eq('tour_id', tourId)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && !!tourId,
    staleTime: 60 * 1000,
  });

  const mergeData = booking ? EmailTemplateEngine.convertBookingToMergeData(booking) : null;
  const processedSubject = mergeData
    ? EmailTemplateEngine.processTemplate(templateSubject, mergeData)
    : templateSubject;
  const processedContent = mergeData
    ? EmailTemplateEngine.processTemplate(templateContent, mergeData)
    : templateContent;

  const recipientName = booking?.customers
    ? `${booking.customers.first_name ?? ''} ${booking.customers.last_name ?? ''}`.trim()
    : 'Loading...';
  const recipientEmail = booking?.customers?.email || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Email Preview
            <Badge variant="outline" className="text-xs font-normal">Sample Booking</Badge>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading preview...</span>
          </div>
        ) : !booking ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No eligible bookings found for this tour to generate a preview.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Email metadata */}
            <div className="rounded-lg border p-4 space-y-2 text-sm bg-muted/30">
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-16">Rule:</span>
                <span>{ruleName}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-16">From:</span>
                <span>{templateFrom}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-16">To:</span>
                <span>{recipientName} &lt;{recipientEmail}&gt;</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-16">Subject:</span>
                <span className="font-medium">{processedSubject}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic">
              This preview uses data from the booking for <strong>{recipientName}</strong> as a sample. 
              Action buttons (profile update, passport request, etc.) are placeholders and won't generate real links in preview.
            </p>

            {/* Rendered email body */}
            <div
              className="border rounded-lg p-6 bg-background prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
