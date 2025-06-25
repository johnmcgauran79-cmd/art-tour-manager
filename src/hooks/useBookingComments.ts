
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BookingComment {
  id: string;
  booking_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  is_internal: boolean;
  comment_type: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export const useBookingComments = (bookingId: string) => {
  return useQuery({
    queryKey: ['booking-comments', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_comments')
        .select(`
          *,
          profiles (first_name, last_name)
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as BookingComment[];
    },
  });
};

export const useCreateBookingComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (commentData: {
      booking_id: string;
      comment: string;
      is_internal?: boolean;
      comment_type?: string;
    }) => {
      const { data, error } = await supabase
        .from('booking_comments')
        .insert([{
          booking_id: commentData.booking_id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          comment: commentData.comment,
          is_internal: commentData.is_internal || false,
          comment_type: commentData.comment_type || 'general',
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking-comments', data.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({
        title: "Comment Added",
        description: "Comment has been successfully added to the booking.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating booking comment:', error);
    },
  });
};
