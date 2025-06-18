
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAutomatedTourTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tourId: string) => {
      console.log('Generating automated tour tasks for:', tourId);
      
      const { data, error } = await supabase
        .rpc('generate_tour_operation_tasks', {
          p_tour_id: tourId
        });

      if (error) {
        console.error('Error generating tour tasks:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast({
        title: "Tour Tasks Generated",
        description: "Automated tour operation tasks have been created based on the tour timeline.",
        duration: 4000,
      });
    },
    onError: (error) => {
      console.error('Error generating tour tasks:', error);
      toast({
        title: "Error",
        description: "Failed to generate automated tour tasks. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useRegenerateTourTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tourId: string) => {
      console.log('Regenerating tour tasks for:', tourId);
      
      // First archive existing automated tasks
      const { error: archiveError } = await supabase
        .from('tasks')
        .update({ status: 'archived' })
        .eq('tour_id', tourId)
        .eq('is_automated', true)
        .like('automated_rule', 'tour_operations_%')
        .not('status', 'in', '(completed,cancelled)');

      if (archiveError) {
        console.error('Error archiving tasks:', archiveError);
        throw archiveError;
      }

      // Generate new tasks
      const { data, error } = await supabase
        .rpc('generate_tour_operation_tasks', {
          p_tour_id: tourId
        });

      if (error) {
        console.error('Error regenerating tour tasks:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast({
        title: "Tour Tasks Regenerated",
        description: "Tour operation tasks have been updated based on the new timeline.",
        duration: 4000,
      });
    },
    onError: (error) => {
      console.error('Error regenerating tour tasks:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate tour tasks. Please try again.",
        variant: "destructive",
      });
    },
  });
};
