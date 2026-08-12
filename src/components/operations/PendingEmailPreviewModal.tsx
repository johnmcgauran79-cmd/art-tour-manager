import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";
import { useBrands, resolveBrand } from "@/hooks/useBrands";
import { recolorCustomCards } from "@/lib/customCardTheme";

interface PendingEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  templateSubject: string;
  templateContent: string;
  templateFrom: string;
  ruleName: string;
  /** When provided, preview this specific booking instead of the first booking in the tour. */
  previewBookingId?: string;
}

export const PendingEmailPreviewModal = ({
  open,
  onOpenChange,
  tourId,
  templateSubject,
  templateContent,
  templateFrom,
  ruleName,
  previewBookingId,
}: PendingEmailPreviewModalProps) => {
  const { data: brands } = useBrands();
  // Fetch one non-cancelled booking with full data for merge.
  // Prefer the explicitly-requested booking; otherwise fall back to the first
  // non-cancelled booking on the tour as a representative sample.
  const { data: booking, isLoading } = useQuery({
    queryKey: ['pending-email-preview-booking', tourId, previewBookingId || 'first'],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          tours:tour_id (brand_id, name, start_date, end_date, days, nights, location, pickup_point, notes, inclusions, exclusions, tour_host, price_single, price_double, deposit_required, final_payment_date, instalment_date, instalment_amount, travel_documents_required, pickup_location_required, tour_type, dates_not_confirmed),
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
            hotels (name, address, contact_name, contact_phone, contact_email, extra_night_price)
          ),
          activity_bookings (
            passengers_attending,
            activities (name, activity_date, start_time, end_time, location, contact_name, contact_phone, depart_for_activity, transport_mode, driver_name, driver_phone, transport_company, transport_contact_name, transport_phone, transport_email, activity_journeys (journey_number, pickup_time, pickup_location, destination, sort_order))
          )
        `);

      if (previewBookingId) {
        query = query.eq('id', previewBookingId);
      } else {
        query = query
          .eq('tour_id', tourId)
          .not('status', 'eq', 'cancelled')
          .order('created_at', { ascending: true })
          .limit(1);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && (!!tourId || !!previewBookingId),
    staleTime: 60 * 1000,
  });

  const mergeData = booking ? EmailTemplateEngine.convertBookingToMergeData(booking) : null;
  const processedSubject = mergeData
    ? EmailTemplateEngine.processTemplate(templateSubject, mergeData)
    : templateSubject;

  // Replace action placeholders with styled mock buttons FIRST, so the mustache
  // processor doesn't strip them as unknown merge fields.
  let processedContent = templateContent;

  const placeholderButtonStyle = 'display:inline-block;padding:10px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;opacity:0.7;cursor:default;';
  const placeholderReplacements: Record<string, string> = {
    '{{profile_update_button}}': `<span style="${placeholderButtonStyle}">📝 Update My Profile (Preview)</span>`,
    '{{profile_update_link}}': '#preview-profile-update',
    '{{pickup_button}}': `<span style="${placeholderButtonStyle}">📍 Select Pickup Location (Preview)</span>`,
    '{{pickup_link}}': '#preview-pickup',
    '{{travel_docs_button}}': `<span style="${placeholderButtonStyle}">🛂 UPDATE PASSPORT DETAILS (Preview)</span>`,
    '{{travel_docs_link}}': '#preview-travel-docs',
    '{{waiver_button}}': `<span style="${placeholderButtonStyle}">📋 Sign Waiver (Preview)</span>`,
    '{{waiver_link}}': '#preview-waiver',
    '{{custom_form_button}}': `<span style="${placeholderButtonStyle}">📝 Complete Form (Preview)</span>`,
    '{{custom_form_link}}': '#preview-custom-form',
    '{{itinerary_button}}': `<span style="${placeholderButtonStyle}">🗺️ View Itinerary (Preview)</span>`,
    '{{itinerary_link}}': '#preview-itinerary',
  };
  for (const [placeholder, replacement] of Object.entries(placeholderReplacements)) {
    processedContent = processedContent.split(placeholder).join(replacement);
  }
  // Handle custom form buttons: {{custom_form_button:Form Title}}
  processedContent = processedContent.replace(
    /\{\{custom_form_button:([^}]+)\}\}/g,
    (_, formTitle) => `<span style="${placeholderButtonStyle}">📝 ${formTitle.trim()} (Preview)</span>`
  );

  // Per-passenger blocks are resolved at send time; show their content in preview.
  processedContent = processedContent
    .replace(/\{\{#is_per_passenger\}\}/g, '')
    .replace(/\{\{\/is_per_passenger\}\}/g, '');

  processedContent = mergeData
    ? EmailTemplateEngine.processTemplate(processedContent, mergeData)
    : processedContent;

  // Recolour custom cards to the tour's brand theme so the preview matches
  // what the client will actually receive.
  const brand = resolveBrand(brands, (booking as any)?.tours?.brand_id ?? null);
  if (brand) {
    processedContent = recolorCustomCards(processedContent, {
      primary: brand.color_primary,
      accent: brand.color_accent,
    });
  }

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

            {/* Rendered email body — mirrors the real sent-email spacing so the
                preview matches what recipients actually receive. */}
            <div className="border rounded-lg p-6 bg-background email-preview-body">
              <style>{`
                .email-preview-body {
                  font-family: Arial, Helvetica, sans-serif;
                  font-size: 14px;
                  line-height: 1.6;
                  color: #55575d;
                }
                .email-preview-body p { margin: 0 0 12px 0; }
                .email-preview-body ul,
                .email-preview-body ol { margin: 0 0 16px 0; padding-left: 24px; }
                .email-preview-body li { margin-bottom: 4px; }
                .email-preview-body h1,
                .email-preview-body h2,
                .email-preview-body h3,
                .email-preview-body h4 { color: #1a2332; line-height: 1.3; }
                .email-preview-body hr { border: none; border-top: 2px solid #e5e7eb; margin: 24px 0; }
              `}</style>
              <div dangerouslySetInnerHTML={{ __html: processedContent }} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
