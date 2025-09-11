import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useBulkBookingEmail = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tourId, recipientType, customSubject, customContent, fromEmail }: { 
      tourId: string; 
      recipientType?: string;
      customSubject?: string; 
      customContent?: string; 
      fromEmail?: string;
    }) => {
      let bookings;
      
      if (recipientType === "activities_only") {
        // Get bookings without accommodation
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            accommodation_required,
            customers:lead_passenger_id (email, first_name, last_name),
            hotel_bookings (id)
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
        // Get bookings with accommodation (default)
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            customers:lead_passenger_id (email, first_name, last_name),
            hotel_bookings!inner (id)
          `)
          .eq('tour_id', tourId)
          .neq('status', 'cancelled')
          .not('customers.email', 'is', null);
          
        if (error) throw error;
        bookings = data;
      }

      if (!bookings || bookings.length === 0) {
        throw new Error('No bookings with email addresses found for this tour');
      }

      // Send emails for each booking
      const emailPromises = bookings.map(async (booking) => {
        const { error } = await supabase.functions.invoke('send-booking-confirmation', {
          body: { 
            bookingId: booking.id,
            customSubject,
            customContent,
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