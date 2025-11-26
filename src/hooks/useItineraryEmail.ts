import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useSendItinerary = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      tourId,
      itineraryId,
      recipientEmail,
      recipientName,
      subject,
      message,
      fromEmail,
      includeHotels,
      includeTourInfo,
      ccEmails,
      bccEmails,
      pdfBase64
    }: { 
      tourId: string;
      itineraryId: string;
      recipientEmail: string;
      recipientName?: string;
      subject?: string;
      message?: string;
      fromEmail?: string;
      includeHotels?: boolean;
      includeTourInfo?: boolean;
      ccEmails?: string[];
      bccEmails?: string[];
      pdfBase64?: string;
    }) => {
      console.log('Sending itinerary email:', { 
        tourId, 
        itineraryId, 
        recipientEmail, 
        recipientName, 
        subject, 
        fromEmail,
        includeHotels,
        includeTourInfo,
        ccEmails,
        bccEmails
      });
      
      const { data, error } = await supabase.functions.invoke('send-itinerary-email', {
        body: { 
          tourId,
          itineraryId,
          recipientEmail,
          recipientName,
          subject,
          message,
          fromEmail,
          includeHotels,
          includeTourInfo,
          ccEmails,
          bccEmails,
          pdfBase64
        }
      });

      console.log('Edge function response:', { data, error });
      if (error) throw error;
      return data;
    },
    onMutate: () => {
      toast({
        title: "Processing...",
        description: "Generating itinerary and preparing email. This may take a moment.",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Email Sent",
        description: `Itinerary sent to ${data.sentTo}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send itinerary email. Please try again.",
        variant: "destructive",
      });
      console.error('Error sending itinerary:', error);
    },
  });
};
