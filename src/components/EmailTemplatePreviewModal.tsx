import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";
import type { EmailTemplate } from "@/utils/emailTemplateEngine";

interface EmailTemplatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
  subjectTemplate?: string;
  contentTemplate?: string;
}

export const EmailTemplatePreviewModal = ({ open, onOpenChange, template, subjectTemplate, contentTemplate }: EmailTemplatePreviewModalProps) => {
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const subject = subjectTemplate || template?.subject_template || "";
  const content = contentTemplate || template?.content_template || "";

  // Fetch active tours for selection
  const { data: tours, isLoading: toursLoading } = useQuery({
    queryKey: ['preview-tours-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('id, name, start_date, status')
        .not('status', 'eq', 'cancelled')
        .order('start_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch first booking from selected tour with full data
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['template-preview-booking', selectedTourId],
    queryFn: async () => {
      if (!selectedTourId) return null;

      const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
          *,
          tours:tour_id (name, start_date, end_date, days, nights, location, pickup_point, notes, inclusions, exclusions, tour_host, price_single, price_double, deposit_required, final_payment_date, instalment_date, instalment_amount, tour_type, capacity, minimum_passengers_required, price_twin, instalment_details, travel_documents_required),
          customers!lead_passenger_id (first_name, last_name, email, phone, city, state, country, spouse_name, dietary_requirements, notes, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
          passenger_2:customers!passenger_2_id (first_name, last_name, email, phone, dietary_requirements, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
          passenger_3:customers!passenger_3_id (first_name, last_name, email, phone, dietary_requirements, preferred_name, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
          hotel_bookings (
            check_in_date, check_out_date, nights, room_type, room_upgrade, bedding, room_requests, confirmation_number,
            hotels (name, address, contact_name, contact_phone, contact_email, extra_night_price)
          ),
          activity_bookings (
            passengers_attending,
            activities (name, activity_date, start_time, end_time, location, contact_name, contact_phone, depart_for_activity, transport_mode, driver_name, driver_phone, transport_company, transport_contact_name, transport_phone, transport_email)
          )
        `)
        .eq('tour_id', selectedTourId)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return booking;
    },
    enabled: !!selectedTourId && showPreview,
    staleTime: 60 * 1000,
  });

  // Fetch general settings for branding
  const { data: generalSettings } = useQuery({
    queryKey: ['preview-general-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('general_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['email_header_image_url', 'theme_email_button_color', 'theme_email_button_text']);
      return data || [];
    },
    enabled: open && showPreview,
    staleTime: 5 * 60 * 1000,
  });

  const getSettingValue = (key: string, fallback: string) => {
    const row = generalSettings?.find((r: any) => r.setting_key === key);
    if (!row) return fallback;
    return typeof row.setting_value === 'string' ? row.setting_value : String(row.setting_value);
  };

  const handleGeneratePreview = () => {
    if (selectedTourId) {
      setShowPreview(true);
    }
  };

  const handleClose = () => {
    setShowPreview(false);
    setSelectedTourId(null);
    onOpenChange(false);
  };

  // Generate rendered email HTML
  const renderedHtml = (() => {
    if (!previewData || !showPreview) return null;

    const mergeData = EmailTemplateEngine.convertBookingToMergeData(previewData);
    
    // Process action placeholders as preview mock-ups
    const btnBg = getSettingValue('theme_email_button_color', '#232628');
    const btnText = getSettingValue('theme_email_button_text', '#F5C518');
    const mockButtonStyle = `display:inline-block;padding:12px 28px;background:${btnBg};color:${btnText};border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px;text-transform:uppercase;`;
    
    mergeData.profile_update_button = `<a href="#" style="${mockButtonStyle}">UPDATE YOUR PROFILE (Preview)</a>`;
    mergeData.profile_update_link = '#preview-profile-update';
    (mergeData as any).travel_docs_button = `<a href="#" style="${mockButtonStyle}">SUBMIT TRAVEL DOCUMENTS (Preview)</a>`;
    (mergeData as any).travel_docs_link = '#preview-travel-docs';
    (mergeData as any).waiver_button = `<a href="#" style="${mockButtonStyle}">SIGN WAIVER (Preview)</a>`;
    (mergeData as any).waiver_link = '#preview-waiver';
    (mergeData as any).pickup_button = `<a href="#" style="${mockButtonStyle}">SELECT PICKUP LOCATION (Preview)</a>`;
    (mergeData as any).pickup_link = '#preview-pickup';
    mergeData.itinerary_button = `<a href="#" style="${mockButtonStyle}">VIEW ITINERARY (Preview)</a>`;
    mergeData.itinerary_link = '#preview-itinerary';
    mergeData.additional_info_blocks = '<div style="padding:12px;border:1px dashed #d1d5db;border-radius:8px;text-align:center;color:#9ca3af;font-size:13px;margin:8px 0;">Additional Info Blocks will appear here (rendered server-side)</div>';

    // Generate tour_details_card preview (hotel-card style)
    const gridLabelStyle = 'padding:4px 0;color:#55575d;font-size:13px;width:140px;';
    const gridValueStyle = 'padding:4px 0 4px 12px;color:#1a2332;font-size:13px;font-weight:500;';
    
    const tourRows: string[] = [];
    if (mergeData.tour_name) tourRows.push(`<tr><td style="${gridLabelStyle}">Tour</td><td style="${gridValueStyle}"><strong>${mergeData.tour_name}</strong></td></tr>`);
    if (mergeData.tour_location) tourRows.push(`<tr><td style="${gridLabelStyle}">Location</td><td style="${gridValueStyle}">${mergeData.tour_location}</td></tr>`);
    if (mergeData.tour_start_date && mergeData.tour_end_date) tourRows.push(`<tr><td style="${gridLabelStyle}">Tour Dates</td><td style="${gridValueStyle}">${mergeData.tour_start_date} - ${mergeData.tour_end_date}</td></tr>`);
    if (mergeData.tour_days || mergeData.tour_nights) tourRows.push(`<tr><td style="${gridLabelStyle}">Duration</td><td style="${gridValueStyle}">${mergeData.tour_days ? mergeData.tour_days + ' days' : ''}${mergeData.tour_days && mergeData.tour_nights ? ', ' : ''}${mergeData.tour_nights ? mergeData.tour_nights + ' nights' : ''}</td></tr>`);
    if (mergeData.tour_host) tourRows.push(`<tr><td style="${gridLabelStyle}">Tour Host</td><td style="${gridValueStyle}">${mergeData.tour_host}</td></tr>`);
    (mergeData as any).tour_details_card = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-hotel-card" style="margin:16px 0 12px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td style="background-color:#f8f9fa;padding:12px 16px;border-bottom:1px solid #e5e7eb;"><strong style="font-size:15px;color:#1a2332;">✈️ Tour Details</strong></td></tr><tr><td style="padding:12px 16px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${tourRows.join('')}</table></td></tr></table>`;

    // Generate passenger_info_card preview (hotel-card style)
    const paxRows: string[] = [];
    const leadName = [mergeData.lead_passenger_first_name, mergeData.lead_passenger_last_name].filter(Boolean).join(' ');
    if (leadName) paxRows.push(`<tr><td style="${gridLabelStyle}">Lead Passenger</td><td style="${gridValueStyle}"><strong>${leadName}</strong></td></tr>`);
    if (mergeData.lead_passenger_preferred_name) paxRows.push(`<tr><td style="${gridLabelStyle}">Preferred Name</td><td style="${gridValueStyle}">${mergeData.lead_passenger_preferred_name}</td></tr>`);
    paxRows.push(`<tr><td style="${gridLabelStyle}">Total Passengers</td><td style="${gridValueStyle}">${mergeData.booking_passenger_count || 1}</td></tr>`);
    if (mergeData.lead_passenger_phone) paxRows.push(`<tr><td style="${gridLabelStyle}">Phone Number</td><td style="${gridValueStyle}">${mergeData.lead_passenger_phone}</td></tr>`);
    paxRows.push(`<tr><td style="${gridLabelStyle}">Dietary</td><td style="${gridValueStyle}">${mergeData.lead_passenger_dietary_requirements && mergeData.lead_passenger_dietary_requirements !== 'N/A' ? mergeData.lead_passenger_dietary_requirements : 'N/A'}</td></tr>`);
    paxRows.push(`<tr><td style="${gridLabelStyle}">Accessibility</td><td style="${gridValueStyle}">${mergeData.lead_passenger_accessibility_needs && mergeData.lead_passenger_accessibility_needs !== 'N/A' ? mergeData.lead_passenger_accessibility_needs : 'N/A'}</td></tr>`);
    const ecName = mergeData.lead_passenger_emergency_contact_name || '';
    const ecPhone2 = mergeData.lead_passenger_emergency_contact_phone || '';
    paxRows.push(`<tr><td style="${gridLabelStyle}">Emergency Contact</td><td style="${gridValueStyle}">${ecName ? `${ecName}${ecPhone2 ? ' ' + ecPhone2 : ''}` : 'Not provided'}</td></tr>`);
    (mergeData as any).passenger_info_card = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-hotel-card" style="margin:16px 0 12px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td style="background-color:#f8f9fa;padding:12px 16px;border-bottom:1px solid #e5e7eb;"><strong style="font-size:15px;color:#1a2332;">👤 Passenger Information</strong></td></tr><tr><td style="padding:12px 16px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${paxRows.join('')}</table></td></tr></table>`;

    const processedSubject = EmailTemplateEngine.processTemplate(subject, mergeData);
    const processedContent = EmailTemplateEngine.processTemplate(content, mergeData);

    const headerImageUrl = getSettingValue('email_header_image_url', 'https://art-tour-manager.lovable.app/images/email-header-default.png');

    // Wrap in branded email shell
    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background-color:#f5f5f5;">
  <div style="max-width:800px;margin:0 auto;padding:20px;">
    <div style="background:#232628;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
      <img src="${headerImageUrl}" alt="Header" style="height:80px;max-width:400px;width:auto;" />
    </div>
    <div style="background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
      ${processedContent}
    </div>
    <div style="text-align:center;padding:20px;color:#666;font-size:12px;">
      <p style="margin:0;">Australian Racing Tours</p>
      <p style="margin:5px 0;">This email was sent regarding your tour booking.</p>
    </div>
  </div>
</body></html>`;

    return { subject: processedSubject, html: fullHtml, recipientName: `${previewData.customers?.first_name || ''} ${previewData.customers?.last_name || ''}`.trim() };
  })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={showPreview && renderedHtml ? "max-w-5xl max-h-[90vh] flex flex-col" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {showPreview ? 'Email Template Preview' : 'Select Tour for Preview'}
          </DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a tour to generate a preview using the first booking's data.
            </p>
            <div>
              <Label>Tour</Label>
              {toursLoading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading tours...
                </div>
              ) : (
                <Select value={selectedTourId || ""} onValueChange={setSelectedTourId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tour..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tours?.map((tour) => (
                      <SelectItem key={tour.id} value={tour.id}>
                        {tour.name} {tour.start_date ? `(${new Date(tour.start_date).toLocaleDateString()})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGeneratePreview} disabled={!selectedTourId}>
                <Eye className="h-4 w-4 mr-2" />
                Generate Preview
              </Button>
            </div>
          </div>
        ) : previewLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-3">Generating preview...</span>
          </div>
        ) : !renderedHtml ? (
          <div className="p-8 text-center text-muted-foreground">
            No bookings found for this tour. Please select a tour with at least one booking.
            <div className="mt-4">
              <Button variant="outline" onClick={() => setShowPreview(false)}>Back</Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center gap-4 text-sm bg-muted/50 rounded-md p-3">
              <div><span className="font-medium">To:</span> {renderedHtml.recipientName}</div>
              <div className="flex-1"><span className="font-medium">Subject:</span> {renderedHtml.subject}</div>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
                Change Tour
              </Button>
            </div>
            <div className="flex-1 overflow-auto border rounded-md bg-[#f5f5f5]">
              <iframe
                srcDoc={renderedHtml.html}
                title="Email Preview"
                className="w-full h-full min-h-[500px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
