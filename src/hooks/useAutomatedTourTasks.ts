
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
      console.log('Starting regeneration process for tour:', tourId);
      
      // Step 1: Get all automated tasks for this tour
      console.log('Step 1: Fetching existing automated tasks...');
      const { data: allTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, status, is_automated, created_at')
        .eq('tour_id', tourId)
        .eq('is_automated', true);

      if (fetchError) {
        console.error('Error fetching existing tasks:', fetchError);
        throw fetchError;
      }

      console.log(`Found ${allTasks?.length || 0} automated tasks for tour ${tourId}`);
      console.log('All automated tasks:', allTasks?.map(t => ({ 
        id: t.id, 
        title: t.title, 
        status: t.status,
        created_at: t.created_at 
      })));

      // Step 2: Filter tasks to delete (not completed, not cancelled)
      const tasksToDelete = allTasks?.filter(task => 
        task.status !== 'completed' && task.status !== 'cancelled'
      ) || [];

      console.log(`Tasks to delete: ${tasksToDelete.length}`);
      tasksToDelete.forEach(task => {
        console.log(`- Will delete: ${task.title} (${task.id}) - Status: ${task.status}`);
      });

      // Step 3: Delete tasks one by one with detailed logging
      let deletedCount = 0;
      for (const task of tasksToDelete) {
        console.log(`Attempting to delete task: ${task.title} (${task.id})`);
        
        const { error: deleteError, count } = await supabase
          .from('tasks')
          .delete({ count: 'exact' })
          .eq('id', task.id);

        if (deleteError) {
          console.error(`Failed to delete task ${task.id}:`, deleteError);
          throw deleteError;
        }
        
        console.log(`Delete result for ${task.id}: count=${count}`);
        if (count && count > 0) {
          deletedCount++;
          console.log(`✓ Successfully deleted: ${task.title}`);
        } else {
          console.warn(`⚠ No rows deleted for task: ${task.title} (${task.id})`);
        }
      }

      console.log(`Total tasks deleted: ${deletedCount} out of ${tasksToDelete.length}`);

      // Step 4: Verify deletion by checking remaining tasks
      console.log('Step 4: Verifying deletion...');
      const { data: remainingTasks, error: verifyError } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('tour_id', tourId)
        .eq('is_automated', true);

      if (verifyError) {
        console.error('Error verifying deletion:', verifyError);
      } else {
        console.log(`Remaining automated tasks after deletion: ${remainingTasks?.length || 0}`);
        remainingTasks?.forEach(task => {
          console.log(`- Remaining: ${task.title} (${task.status})`);
        });
      }

      // Step 5: Generate new tasks
      console.log('Step 5: Generating new tasks...');
      const { data, error } = await supabase
        .rpc('generate_tour_operation_tasks', {
          p_tour_id: tourId
        });

      if (error) {
        console.error('Error regenerating tour tasks:', error);
        throw error;
      }

      console.log('New tasks generation completed');
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
