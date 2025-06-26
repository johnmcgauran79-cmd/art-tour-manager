
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
        description: "Automated tour operation tasks have been created based on the current tour timeline.",
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
      
      // First, manually archive existing automated tasks that haven't been completed
      const { error: archiveError } = await supabase
        .from('tasks')
        .update({ status: 'archived' })
        .eq('tour_id', tourId)
        .eq('is_automated', true)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .neq('status', 'archived');

      if (archiveError) {
        console.error('Error archiving tasks:', archiveError);
        throw archiveError;
      }

      // Generate new tasks based on current tour dates
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
      // Invalidate all task-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['my-tasks'] });
      
      toast({
        title: "Tour Tasks Regenerated",
        description: "Tour operation tasks have been updated to match the current tour timeline. Previous uncompleted automated tasks were archived.",
        duration: 5000,
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

export const useCleanupArchivedTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tourId: string) => {
      console.log('Cleaning up archived automated tasks for:', tourId);
      
      // Delete archived automated tasks for this specific tour
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('tour_id', tourId)
        .eq('is_automated', true)
        .eq('status', 'archived');

      if (error) {
        console.error('Error cleaning up archived tasks:', error);
        throw error;
      }

      console.log('Successfully cleaned up archived tasks for tour:', tourId);
    },
    onSuccess: () => {
      // Force refresh of all task queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['my-tasks'] });
      
      toast({
        title: "Archived Tasks Cleaned",
        description: "Archived automated tasks have been permanently removed.",
        duration: 3000,
      });
    },
    onError: (error) => {
      console.error('Error cleaning up archived tasks:', error);
      toast({
        title: "Error",
        description: "Failed to clean up archived tasks. Please try again.",
        variant: "destructive",
      });
    },
  });
};
