import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";

export const useBulkBookingEmail = (onProgress?: (current: number, total: number) => void) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tourId, recipientType, subjectTemplate, contentTemplate, fromEmail, selectedBookingIds, ccEmails, bccEmails, includeAdditionalPassengers, emailTemplateId }: { 
      tourId: string; 
      recipientType?: string;
      subjectTemplate?: string; 
      contentTemplate?: string; 
      fromEmail?: string;
      selectedBookingIds?: string[];
      ccEmails?: string[];
      bccEmails?: string[];
      includeAdditionalPassengers?: boolean;
      emailTemplateId?: string;
    }) => {
      let bookings;
      
      // If specific bookings are selected, fetch only those
      if (selectedBookingIds && selectedBookingIds.length > 0) {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            tours:tour_id (
              name, location, start_date, end_date, days, nights, pickup_point,
              notes, inclusions, exclusions, tour_host, price_single, price_double,
              deposit_required, final_payment_date, instalment_date, instalment_amount
            ),
            customers!lead_passenger_id (
              id, first_name, last_name, preferred_name, email, phone, city, state, country,
              spouse_name, dietary_requirements, medical_conditions, accessibility_needs,
              emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
              notes
            ),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
            passenger_2:customers!passenger_2_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
            passenger_3:customers!passenger_3_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
            hotel_bookings (
              check_in_date, check_out_date, nights, room_type, bedding,
              room_upgrade, room_requests, confirmation_number,
              hotels (name, address, contact_name, contact_phone, contact_email, extra_night_price)
            ),
            activity_bookings (
              passengers_attending,
              activities (name, activity_date, start_time, end_time, location, contact_name, contact_phone, depart_for_activity, transport_mode, driver_name, driver_phone, transport_company, transport_contact_name, transport_phone, transport_email, activity_journeys (journey_number, pickup_time, pickup_location, destination, sort_order))
            )
          `)
          .in('id', selectedBookingIds)
          .not('customers.email', 'is', null);
           
        if (error) throw error;
        bookings = data;
      } else if (recipientType === "activities_only") {
        // Get bookings without accommodation with full details for mail merge
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            tours:tour_id (
              name, location, start_date, end_date, days, nights, pickup_point,
              notes, inclusions, exclusions, tour_host, price_single, price_double,
              deposit_required, final_payment_date, instalment_date, instalment_amount
            ),
            customers!lead_passenger_id (
              id, first_name, last_name, preferred_name, email, phone, city, state, country,
              spouse_name, dietary_requirements, medical_conditions, accessibility_needs,
              emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
              notes
            ),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
            passenger_2:customers!passenger_2_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
            passenger_3:customers!passenger_3_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
            hotel_bookings (
              check_in_date, check_out_date, nights, room_type, bedding,
              room_upgrade, room_requests, confirmation_number,
              hotels (name, address, contact_name, contact_phone, contact_email, extra_night_price)
            ),
            activity_bookings (
              passengers_attending,
              activities (name, activity_date, start_time, end_time, location, contact_name, contact_phone, depart_for_activity, transport_mode, driver_name, driver_phone, transport_company, transport_contact_name, transport_phone, transport_email, activity_journeys (journey_number, pickup_time, pickup_location, destination, sort_order))
            )
          `)
          .eq('tour_id', tourId)
          .neq('status', 'cancelled')
          .eq('accommodation_required', false)
          .not('customers.email', 'is', null);
           
        if (error) throw error;
        // Filter out any that have hotel bookings
        bookings = data?.filter(booking => 
          !booking.hotel_bookings || booking.hotel_bookings.length === 0
        );
      } else {
        // Get bookings with accommodation with full details for mail merge
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            tours:tour_id (
              name, location, start_date, end_date, days, nights, pickup_point,
              notes, inclusions, exclusions, tour_host, price_single, price_double,
              deposit_required, final_payment_date, instalment_date, instalment_amount
            ),
            customers!lead_passenger_id (
              id, first_name, last_name, preferred_name, email, phone, city, state, country,
              spouse_name, dietary_requirements, medical_conditions, accessibility_needs,
              emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
              notes
            ),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
            passenger_2:customers!passenger_2_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
            passenger_3:customers!passenger_3_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship),
            hotel_bookings (
              check_in_date, check_out_date, nights, room_type, bedding,
              room_upgrade, room_requests, confirmation_number,
              hotels (name, address, contact_name, contact_phone, contact_email, extra_night_price)
            ),
            activity_bookings (
              passengers_attending,
              activities (name, activity_date, start_time, end_time, location, contact_name, contact_phone, depart_for_activity, transport_mode, driver_name, driver_phone, transport_company, transport_contact_name, transport_phone, transport_email, activity_journeys (journey_number, pickup_time, pickup_location, destination, sort_order))
            )
          `)
          .eq('tour_id', tourId)
          .neq('status', 'cancelled')
          .not('customers.email', 'is', null);
           
        if (error) throw error;
        
        console.log('[Bulk Email] All fetched bookings:', data?.map(b => ({
          id: b.id,
          name: `${b.customers?.first_name} ${b.customers?.last_name}`,
          hotel_bookings_count: b.hotel_bookings?.length || 0,
          passenger_2: b.passenger_2?.first_name,
          passenger_3: b.passenger_3?.first_name
        })));
        
        // Only include bookings that have hotel bookings
        bookings = data?.filter(booking => {
          const hasHotelBookings = booking.hotel_bookings && booking.hotel_bookings.length > 0;
          return hasHotelBookings;
        });
      }

      if (!bookings || bookings.length === 0) {
        throw new Error('No bookings with email addresses found for this tour');
      }

      // Process each booking sequentially with delay to avoid Resend rate limit (2 req/sec)
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const results: PromiseSettledResult<any>[] = [];
      const failedDetails: string[] = [];
      
      // Report initial progress
      onProgress?.(0, bookings.length);
      
      console.log(`[Bulk Email] Starting send to ${bookings.length} bookings`);
      
      for (let i = 0; i < bookings.length; i++) {
        const booking = bookings[i];
        const recipientName = `${booking.customers?.first_name} ${booking.customers?.last_name}`;
        
        // Report progress before sending each email
        onProgress?.(i + 1, bookings.length);
        
        try {
          // When including additional passengers, send raw templates to the edge function
          // so it can process them individually for each passenger with their own data.
          // Otherwise, pre-process for the lead passenger only.
          const shouldSendRawTemplates = includeAdditionalPassengers !== false;
          
          let personalizedSubject: string | undefined;
          let personalizedContent: string | undefined;
          
          if (shouldSendRawTemplates) {
            // Send raw templates - edge function will process for each recipient
            personalizedSubject = subjectTemplate;
            personalizedContent = contentTemplate;
          } else {
            // Pre-process for lead passenger only
            const mergeData = EmailTemplateEngine.convertBookingToMergeData(booking);
            personalizedSubject = subjectTemplate ? 
              EmailTemplateEngine.processTemplate(subjectTemplate, mergeData) : 
              undefined;
            personalizedContent = contentTemplate ? 
              EmailTemplateEngine.processTemplate(contentTemplate, mergeData) : 
              undefined;
          }
          
          const { data, error } = await supabase.functions.invoke('send-booking-confirmation', {
            body: { 
              bookingId: booking.id,
              customSubject: personalizedSubject,
              customContent: personalizedContent,
              fromEmail,
              ccEmails,
              bccEmails,
              includeAdditionalPassengers: includeAdditionalPassengers ?? true,
              emailTemplateId
            }
          });
          
          if (error) {
            console.error(`[Bulk Email] Edge function error for ${recipientName}:`, error);
            failedDetails.push(`${recipientName}: ${error.message || 'Unknown error'}`);
            throw error;
          }
          
          if (!data?.success) {
            const errMsg = data?.error || 'No success response from server';
            console.error(`[Bulk Email] Send failed for ${recipientName}:`, errMsg);
            failedDetails.push(`${recipientName}: ${errMsg}`);
            throw new Error(errMsg);
          }
          
          console.log(`[Bulk Email] ✓ Sent to ${recipientName} (${data.sentTo})`);
          results.push({ status: 'fulfilled', value: booking });
        } catch (error: any) {
          console.error(`[Bulk Email] ✗ Failed for ${recipientName}:`, error);
          results.push({ status: 'rejected', reason: error });
        }
        
        // Wait 600ms between requests to stay under 2 req/sec limit
        if (i < bookings.length - 1) {
          await delay(600);
        }
      }

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`[Bulk Email] Complete: ${successful} sent, ${failed} failed out of ${bookings.length}`);
      if (failedDetails.length > 0) {
        console.error('[Bulk Email] Failed details:', failedDetails);
      }

      return { successful, failed, total: bookings.length, failedDetails };
    },
    onSuccess: (data) => {
      if (data.successful === 0) {
        toast({
          title: "⚠️ No Emails Sent",
          description: `All ${data.total} emails failed to send. Check your connection and try again.`,
          variant: "destructive",
        });
      } else if (data.failed > 0) {
        toast({
          title: "⚠️ Partially Sent",
          description: `${data.successful} of ${data.total} emails sent. ${data.failed} failed.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ All Emails Sent Successfully",
          description: `${data.successful} email${data.successful !== 1 ? 's' : ''} sent successfully.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "❌ Email Send Failed",
        description: error.message || "Failed to send bulk emails. Please try again.",
        variant: "destructive",
      });
      console.error('[Bulk Email] Critical error:', error);
    },
  });
};