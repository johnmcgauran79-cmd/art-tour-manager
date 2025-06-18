
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

export const useSecureDeleteTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();
  const { user } = useAuth();

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

      // Create notification for all users
      if (user?.id) {
        await createNotification(user.id, {
          title: "Tour Deleted",
          message: `Tour "${tourName}" has been deleted by an administrator.`,
          type: 'tour',
          priority: 'high',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
