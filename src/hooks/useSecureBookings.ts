
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/hooks/useAuth";

const createNotification = async (userId: string, notification: {
  title: string;
  message: string;
  type: 'task' | 'tour' | 'booking' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_id?: string;
}) => {
  const { error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: userId,
      ...notification,
    });

  if (error) {
    console.error('Error creating notification:', error);
  }
};

export const useSecureDeleteBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get booking details before deletion for notification
      const { data: booking } = await supabase
        .from('bookings')
        .select('group_name, tour_id, tours(name)')
        .eq('id', id)
        .single();

      // Log the deletion attempt
      logOperation({
        operation_type: 'DELETE_BOOKING',
        table_name: 'bookings',
        record_id: id,
        details: { reason: 'Manual deletion by user' }
      });

      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Create notification for the user who deleted it (not via realtime to avoid duplicates)
      if (user?.id && booking) {
        await createNotification(user.id, {
          title: "Booking Deleted",
          message: `${booking.group_name || 'Booking'} for ${booking.tours?.name || 'tour'} deleted`,
          type: 'booking',
          priority: 'medium',
          related_id: booking.tour_id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Booking Deleted",
        description: "Booking has been successfully deleted and logged for audit.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete booking. Please try again.",
        variant: "destructive",
      });
      console.error('Error deleting booking:', error);
    },
  });
};
