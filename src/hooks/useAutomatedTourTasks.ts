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
      // Invalidate and refetch all task-related queries
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
      
      // First, get all automated tasks for this tour that haven't been completed
      const { data: existingTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('tour_id', tourId)
        .eq('is_automated', true);

      if (fetchError) {
        console.error('Error fetching existing tasks:', fetchError);
        throw fetchError;
      }

      console.log('Found existing automated tasks:', existingTasks);

      // Filter out completed and cancelled tasks (keep them)
      const tasksToDelete = existingTasks?.filter(task => 
        task.status !== 'completed' && task.status !== 'cancelled'
      ) || [];

      console.log('Tasks to delete:', tasksToDelete.map(t => ({ id: t.id, title: t.title, status: t.status })));

      // Delete each task individually to ensure proper deletion
      if (tasksToDelete.length > 0) {
        for (const task of tasksToDelete) {
          const { error: deleteError } = await supabase
            .from('tasks')
            .delete()
            .eq('id', task.id);

          if (deleteError) {
            console.error(`Error deleting task ${task.id}:`, deleteError);
            throw deleteError;
          }
          
          console.log(`Successfully deleted task: ${task.title} (${task.id})`);
        }
      }

      console.log(`Deleted ${tasksToDelete.length} old automated tasks for tour:`, tourId);

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
      
      toast({
        title: "Tour Tasks Regenerated",
        description: "Tour operation tasks have been updated to match the current tour timeline. Previous uncompleted automated tasks were removed.",
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
