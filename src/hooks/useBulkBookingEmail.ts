import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useBulkBookingEmail = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tourId: string) => {
      // Get all bookings with email addresses for this tour
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          customers:lead_passenger_id (email, first_name, last_name)
        `)
        .eq('tour_id', tourId)
        .not('customers.email', 'is', null);

      if (bookingsError) throw bookingsError;

      if (!bookings || bookings.length === 0) {
        throw new Error('No bookings with email addresses found for this tour');
      }

      // Send emails for each booking
      const emailPromises = bookings.map(async (booking) => {
        const { error } = await supabase.functions.invoke('send-booking-confirmation', {
          body: { bookingId: booking.id }
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