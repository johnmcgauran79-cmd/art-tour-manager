import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmailTemplateEngine } from "@/utils/emailTemplateEngine";

export const useBulkBookingEmail = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tourId, recipientType, subjectTemplate, contentTemplate, fromEmail, selectedBookingIds }: { 
      tourId: string; 
      recipientType?: string;
      subjectTemplate?: string; 
      contentTemplate?: string; 
      fromEmail?: string;
      selectedBookingIds?: string[];
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
              deposit_required, final_payment_date, instalment_date, instalment_date, instalment_amount
            ),
            customers!lead_passenger_id (
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
          .neq('status', 'cancelled')
          .not('customers.email', 'is', null);
           
        if (error) throw error;
        
        console.log('[Bulk Email] All fetched bookings:', data?.map(b => ({
          id: b.id,
          name: `${b.customers?.first_name} ${b.customers?.last_name}`,
          hotel_bookings_count: b.hotel_bookings?.length || 0,
          hotel_bookings: b.hotel_bookings
        })));
        
        // Only include bookings that have hotel bookings
        bookings = data?.filter(booking => {
          const hasHotelBookings = booking.hotel_bookings && booking.hotel_bookings.length > 0;
          console.log(`[Bulk Email] ${booking.customers?.first_name} ${booking.customers?.last_name}:`, {
            hasHotelBookings,
            hotel_bookings: booking.hotel_bookings
          });
          return hasHotelBookings;
        });
        
        console.log('[Bulk Email] Filtered bookings with hotel:', bookings?.map(b => 
          `${b.customers?.first_name} ${b.customers?.last_name}`
        ));
      }

      if (!bookings || bookings.length === 0) {
        throw new Error('No bookings with email addresses found for this tour');
      }

      // Process each booking individually with mail merge
      const emailPromises = bookings.map(async (booking) => {
        // Convert booking to merge data format
        const mergeData = EmailTemplateEngine.convertBookingToMergeData(booking);
        
        // Process templates with individual booking data
        const personalizedSubject = subjectTemplate ? 
          EmailTemplateEngine.processTemplate(subjectTemplate, mergeData) : 
          `Email for ${booking.customers?.first_name || 'Customer'}`;
          
        const personalizedContent = contentTemplate ? 
          EmailTemplateEngine.processTemplate(contentTemplate, mergeData) : 
          `Dear ${booking.customers?.first_name || 'Customer'},\n\n\n\nBest regards,\nYour Team`;
        
        const { error } = await supabase.functions.invoke('send-booking-confirmation', {
          body: { 
            bookingId: booking.id,
            customSubject: personalizedSubject,
            customContent: personalizedContent,
            fromEmail
          }
        });
        if (error) throw error;
        return booking;
      });

      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { successful, failed, total: bookings.length };
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