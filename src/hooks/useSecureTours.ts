
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";

export const useSecureDeleteTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async ({ tourId, tourName }: { tourId: string; tourName: string }) => {
      // Log the tour deletion attempt
      logOperation({
        operation_type: 'DELETE_TOUR',
        table_name: 'tours',
        record_id: tourId,
        details: { 
          tour_name: tourName,
          reason: 'Manual deletion by admin user'
        }
      });

      const { error } = await supabase
        .from('tours')
        .delete()
        .eq('id', tourId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      toast({
        title: "Tour Deleted",
        description: "Tour has been successfully deleted and logged for audit.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete tour. Please try again.",
        variant: "destructive",
      });
      console.error('Error deleting tour:', error);
    },
  });
};
