
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/hooks/useAuth";
import { createNotification } from "@/utils/notificationHelpers";
import { useUserDepartments } from "@/hooks/useUserDepartments";

export const useSecureDeleteBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();
  const { user } = useAuth();
  const { data: departments } = useUserDepartments();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get booking details before deletion for audit logging only
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

      // Create notification since realtime subscription isn't working
      if (booking && user?.id) {
        const contactName = booking.group_name || 'Unknown Contact';
        const tourName = booking.tours?.name || 'Unknown Tour';
        
        // Create notification for operations department
        await createNotification(user.id, {
          title: 'Booking Deleted',
          message: `Booking for ${contactName} on tour ${tourName} has been deleted`,
          type: 'booking',
          priority: 'medium',
          related_id: id,
          department: 'operations'
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
