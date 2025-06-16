
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";

export const useSecureDeleteBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (id: string) => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
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
