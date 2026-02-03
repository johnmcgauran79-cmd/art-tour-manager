import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";

export const useBulkBookingEmail = (onProgress?: (current: number, total: number) => void) => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tourId, recipientType, subjectTemplate, contentTemplate, fromEmail, selectedBookingIds, ccEmails, bccEmails, includeAdditionalPassengers }: { 
      tourId: string; 
      recipientType?: string;
      subjectTemplate?: string; 
      contentTemplate?: string; 
      fromEmail?: string;
      selectedBookingIds?: string[];
      ccEmails?: string[];
      bccEmails?: string[];
      includeAdditionalPassengers?: boolean;
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
              hotels (name, address, contact_name, contact_phone, contact_email)
            ),
            activity_bookings (
              passengers_attending,
              activities (name, activity_date, start_time, end_time, pickup_time, location, contact_name, contact_phone)
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
              hotels (name, address, contact_name, contact_phone, contact_email)
            ),
            activity_bookings (
              passengers_attending,
              activities (name, activity_date, start_time, end_time, pickup_time, location, contact_name, contact_phone)
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
              hotels (name, address, contact_name, contact_phone, contact_email)
            ),
            activity_bookings (
              passengers_attending,
              activities (name, activity_date, start_time, end_time, pickup_time, location, contact_name, contact_phone)
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
      
      // Report initial progress
      onProgress?.(0, bookings.length);
      
      for (let i = 0; i < bookings.length; i++) {
        const booking = bookings[i];
        
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
          
          const { error } = await supabase.functions.invoke('send-booking-confirmation', {
            body: { 
              bookingId: booking.id,
              customSubject: personalizedSubject,
              customContent: personalizedContent,
              fromEmail,
              ccEmails,
              bccEmails,
              includeAdditionalPassengers: includeAdditionalPassengers ?? true
            }
          });
          
          if (error) throw error;
          results.push({ status: 'fulfilled', value: booking });
        } catch (error) {
          results.push({ status: 'rejected', reason: error });
        }
        
        // Wait 600ms between requests to stay under 2 req/sec limit
        if (i < bookings.length - 1) {
          await delay(600);
        }
      }

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { successful, failed, total: bookings.length };
    },
    onMutate: () => {
      toast({
        title: "Processing...",
        description: "Preparing and sending bulk emails. This may take a few moments.",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Emails Sent",
        description: `Successfully sent ${data.successful} emails. ${data.failed > 0 ? `${data.failed} failed.` : ''}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send bulk emails. Please try again.",
        variant: "destructive",
      });
      console.error('Error sending bulk emails:', error);
    },
  });
};