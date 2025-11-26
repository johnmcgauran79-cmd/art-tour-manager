import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useSendRoomingList = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      hotelId, 
      tourId, 
      tourName,
      hotelEmail,
      hotelName,
      fromEmail,
      ccEmail,
      bccEmail,
      subject,
      message
    }: { 
      hotelId: string; 
      tourId: string; 
      tourName: string;
      hotelEmail?: string;
      hotelName: string;
      fromEmail?: string;
      ccEmail?: string;
      bccEmail?: string;
      subject?: string;
      message?: string;
    }) => {
      console.log('Sending rooming list:', { hotelId, tourId, tourName, hotelEmail, fromEmail, ccEmail, bccEmail, subject });
      
      const { data, error } = await supabase.functions.invoke('send-rooming-list', {
        body: { hotelId, tourId, tourName, hotelEmail, hotelName, fromEmail, ccEmail, bccEmail, subject, message }
      });

      console.log('Edge function response:', { data, error });
      if (error) throw error;
      return data;
    },
    onMutate: () => {
      toast({
        title: "Processing...",
        description: "Generating rooming list and preparing email. This may take a moment.",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Email Sent",
        description: `Rooming list sent to ${data.sentTo}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send rooming list email. Please try again.",
        variant: "destructive",
      });
      console.error('Error sending rooming list:', error);
    },
  });
};
