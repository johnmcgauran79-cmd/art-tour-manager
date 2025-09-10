import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useSendBookingConfirmation = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.functions.invoke('send-booking-confirmation', {
        body: { bookingId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Email Sent",
        description: `Booking confirmation sent to ${data.sentTo}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to send booking confirmation email. Please try again.",
        variant: "destructive",
      });
      console.error('Error sending booking confirmation:', error);
    },
  });
};